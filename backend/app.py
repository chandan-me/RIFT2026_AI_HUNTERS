import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timezone
from risk_engine import evaluate_risk, recommendation
from llm_explain import explain
from drug_gene_map import DRUG_GENE_MAP
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
CORS(app, origins="*")

# Config

UPLOAD_FOLDER  = "uploads"
MAX_FILE_BYTES = 5 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_BYTES
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

PHENO_DISPLAY = {
    "Poor_Metabolizer": "PM",
    "Intermediate":     "IM",
    "Normal":           "NM",
    "Ultrarapid":       "URM",
    "Reduced_Function": "RF",
}

PHENO_SEVERITY = {
    "Poor_Metabolizer": 5,
    "Ultrarapid":       4,
    "Reduced_Function": 3,
    "Intermediate":     2,
    "Normal":           1,
}

# Gene-drug interaction pairs

GENE_DRUG_INTERACTIONS = [
    (
        "CYP2D6", "CODEINE", "TRAMADOL",
        "Both CODEINE and TRAMADOL are CYP2D6 substrates. "
        "Co-administration amplifies risk in Poor and Ultrarapid metabolisers."
    ),
    (
        "CYP2C19", "CLOPIDOGREL", "OMEPRAZOLE",
        "OMEPRAZOLE inhibits CYP2C19, further reducing clopidogrel activation "
        "and increasing cardiovascular risk."
    ),
    (
        "CYP2C9", "WARFARIN", "FLUCONAZOLE",
        "FLUCONAZOLE is a strong CYP2C9 inhibitor. Combined with warfarin it "
        "significantly raises bleeding risk."
    ),
    (
        "TPMT", "AZATHIOPRINE", "MERCAPTOPURINE",
        "Both are TPMT substrates. Concurrent use multiplies myelosuppression risk."
    ),
]

# Allele → Phenotype map

ALLELE_PHENOTYPE_MAP = {
    "CYP2D6": {
        "*1": "Normal", "*2": "Normal", "*35": "Normal",
        "*3": "Poor_Metabolizer", "*4": "Poor_Metabolizer",
        "*5": "Poor_Metabolizer", "*6": "Poor_Metabolizer",
        "*10": "Intermediate", "*17": "Intermediate",
        "*41": "Reduced_Function",
    },
    "CYP2C19": {
    "*1":  "Normal",
    "*2":  "Poor_Metabolizer",
    "*3":  "Poor_Metabolizer",
    "*17": "Ultrarapid",
    "*4":  "Poor_Metabolizer",   
    "*6":  "Poor_Metabolizer",   
    "*9":  "Intermediate",       
    },
    "CYP2C9": {
        "*1": "Normal",
        "*2": "Intermediate", "*3": "Poor_Metabolizer",
    },
    "SLCO1B1": {
        "*1": "Normal", "*1A": "Normal", "*1B": "Normal",
        "*5": "Poor_Metabolizer", "*15": "Intermediate",
    },
    "TPMT": {
        "*1": "Normal",
        "*2": "Poor_Metabolizer", "*3A": "Poor_Metabolizer",
        "*3B": "Intermediate",   "*3C": "Intermediate",
    },
    "DPYD": {
        "*1": "Normal",
        "*2A": "Poor_Metabolizer", "*13": "Poor_Metabolizer",
    },
}


def infer_phenotype(gene: str, star_allele: str) -> str:
    return ALLELE_PHENOTYPE_MAP.get(gene.upper(), {}).get(star_allele.strip(), "Normal")


def build_diplotype(variants: list) -> str:
    if not variants:
        return "wt/wt"
    sorted_v = sorted(
        variants,
        key=lambda v: PHENO_SEVERITY.get(v.get("phenotype", "Normal"), 1),
        reverse=True,
    )
    alleles = [v["allele"] for v in sorted_v[:2]]
    if len(alleles) == 1:
        return f"{alleles[0]}/wt"
    return f"{alleles[0]}/{alleles[1]}"


def select_primary_variant(variants: list) -> dict | None:
    if not variants:
        return None
    return max(
        variants,
        key=lambda v: PHENO_SEVERITY.get(v.get("phenotype", "Normal"), 1),
    )


def check_interactions(drug_list: list) -> list:
    drug_set = set(drug_list)
    warnings = []
    for gene, drug_a, drug_b, message in GENE_DRUG_INTERACTIONS:
        if drug_a in drug_set and drug_b in drug_set:
            warnings.append({
                "gene":    gene,
                "drugs":   [drug_a, drug_b],
                "message": message,
            })
    return warnings


# VCF Parser

def parse_vcf(filepath: str) -> list:
    variants = []
    try:
        with open(filepath, "r", errors="replace") as f:
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                cols = line.strip().split("\t")
                if len(cols) < 8:
                    continue
                rsid = cols[2] if len(cols) > 2 else "."
                info = cols[7]

                if "GENE=" in info.upper() and "STAR=" in info.upper():
                    fields = {}
                    for item in info.split(";"):
                        if "=" in item:
                            k, v = item.split("=", 1)
                            fields[k.strip().upper()] = v.strip()
                    gene = fields.get("GENE", "").upper()
                    star = fields.get("STAR", "")
                    if gene and star:
                        variants.append({
                            "gene":      gene,
                            "allele":    star,
                            "rsid":      rsid,
                            "phenotype": infer_phenotype(gene, star),
                        })
                    continue

                if "ANN=" in info:
                    ann_block = info.split("ANN=", 1)[1].split(";")[0]
                    for entry in ann_block.split(","):
                        parts = entry.split("|")
                        if len(parts) >= 4:
                            gene   = parts[3].strip().upper()
                            allele = parts[0].strip() or "."
                            if gene:
                                variants.append({
                                    "gene":      gene,
                                    "allele":    allele,
                                    "rsid":      rsid,
                                    "phenotype": infer_phenotype(gene, allele),
                                })
                    continue

                if "CSQ=" in info:
                    csq_block = info.split("CSQ=", 1)[1].split(";")[0]
                    for entry in csq_block.split(","):
                        parts = entry.split("|")
                        if len(parts) >= 2:
                            allele = parts[0].strip()
                            gene   = parts[1].strip().upper()
                            if gene:
                                variants.append({
                                    "gene":      gene,
                                    "allele":    allele,
                                    "rsid":      rsid,
                                    "phenotype": infer_phenotype(gene, allele),
                                })
    except Exception as e:
        app.logger.error(f"VCF parse error: {e}")
    return variants


# VCF Validator

def validate_vcf_content(filepath: str) -> dict:
    errors   = []
    warnings = []
    has_format_header = False
    data_lines        = 0
    parseable_lines   = 0

    try:
        with open(filepath, "r", errors="replace") as f:
            for i, line in enumerate(f):
                if i > 2000:
                    break
                line = line.rstrip()
                if not line:
                    continue
                if line.startswith("##fileformat=VCF"):
                    has_format_header = True
                    continue
                if line.startswith("#"):
                    continue
                data_lines += 1
                cols = line.split("\t")
                if len(cols) < 8:
                    warnings.append(f"Line {i+1}: fewer than 8 columns.")
                    continue
                info = cols[7]
                if (
                    ("GENE=" in info.upper() and "STAR=" in info.upper())
                    or "ANN=" in info
                    or "CSQ=" in info
                ):
                    parseable_lines += 1
    except Exception as e:
        errors.append(f"Could not read file: {e}")
        return {"valid": False, "errors": errors, "warnings": warnings, "stats": {}}

    if not has_format_header:
        warnings.append("Missing ##fileformat=VCFv4.x header.")
    if data_lines == 0:
        errors.append("No data lines found. File appears empty or header-only.")
    if parseable_lines == 0 and data_lines > 0:
        errors.append(
            "No parseable pharmacogenomic variants found. "
            "INFO fields must contain GENE=/STAR=, ANN=, or CSQ= annotations."
        )

    return {
        "valid":    len(errors) == 0,
        "errors":   errors,
        "warnings": warnings,
        "stats": {
            "total_data_lines":   data_lines,
            "parseable_variants": parseable_lines,
        },
    }


# Response builder

def build_response(drug: str, all_variants: list, patient_id: str) -> dict:
    relevant_genes = DRUG_GENE_MAP.get(drug, [])
    v_subset       = [v for v in all_variants if v["gene"] in relevant_genes]
    no_variants    = len(v_subset) == 0

    risk_data = evaluate_risk(v_subset, drug)
    advice    = recommendation(risk_data["risk"])

    severity_map = {
        "Toxic":         "high",
        "Adjust Dosage": "moderate",
        "Safe":          "none",
        "Ineffective":   "moderate",
    }

    primary      = select_primary_variant(v_subset)
    primary_gene = primary["gene"]      if primary else (relevant_genes[0] if relevant_genes else "Unknown")
    allele       = primary["allele"]    if primary else None
    phenotype    = primary["phenotype"] if primary else "Normal"
    pheno_code   = PHENO_DISPLAY.get(phenotype, "NM")

    gene_variants = [v for v in v_subset if v["gene"] == primary_gene]
    diplotype     = build_diplotype(gene_variants)

    if primary:
        explanation = explain(
            gene      = primary_gene,
            variant   = allele or "wt",
            drug      = drug,
            risk      = risk_data["risk"],
            phenotype = phenotype,
        )
    else:
        explanation = (
            f"No pharmacogenomic variants relevant to {drug} were detected in this VCF file. "
            f"Standard metabolic function is assumed for this patient. "
            f"Standard dosing guidelines apply."
        )

    return {
        "patient_id": patient_id,
        "drug":       drug,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "no_variants_detected": no_variants,

        "risk_assessment": {
            "risk_label":       risk_data["risk"],
            "confidence_score": risk_data["confidence"],
            "severity":         severity_map.get(risk_data["risk"], "none"),
        },

        "pharmacogenomic_profile": {
            "primary_gene":      primary_gene,
            "diplotype":         diplotype,
            "phenotype":         pheno_code,
            "detected_variants": v_subset,
        },

        "clinical_recommendation": {
            "recommendation_text": advice,
        },

        "llm_generated_explanation": {
            "summary": explanation,
        },

        "quality_metrics": {
            "vcf_parsing_success":     True,
            "relevant_variants_found": len(v_subset),
        },

        "analysis_status": "complete",
    }


# Routes

@app.route("/")
def home():
    return {"status": "PharmaGuard Backend is Running", "version": "3.0"}, 200


@app.route("/api/health")
def health():
    return jsonify({"status": "healthy"}), 200


@app.route("/api/drugs")
def list_drugs():
    return jsonify({"supported_drugs": sorted(DRUG_GENE_MAP.keys())}), 200


@app.route("/api/validate", methods=["POST"])
def validate_vcf():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename.lower().endswith(".vcf"):
        return jsonify({"error": "File must be a .vcf"}), 400

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_BYTES:
        return jsonify({"error": "File exceeds 5 MB limit"}), 413

    # UUID filename for safety
    filepath = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4().hex}.vcf")
    file.save(filepath)
    try:
        result = validate_vcf_content(filepath)
    finally:
        try:
            os.remove(filepath)
        except OSError:
            pass

    return jsonify(result), 200 if result["valid"] else 422


@app.route("/api/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No VCF file uploaded"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    if not file.filename.lower().endswith(".vcf"):
        return jsonify({"error": "Invalid file type. Please upload a .vcf file."}), 400

    file.seek(0, 2)
    if file.tell() > MAX_FILE_BYTES:
        return jsonify({"error": "File too large. Maximum allowed size is 5 MB."}), 413
    file.seek(0)

    drug_input = request.form.get("drug", "").strip()
    if not drug_input:
        return jsonify({"error": "Drug name is required."}), 400

    target_drugs = [d.strip().upper() for d in drug_input.split(",") if d.strip()]
    if not target_drugs:
        return jsonify({"error": "No valid drug names provided."}), 400

    unsupported = [d for d in target_drugs if d not in DRUG_GENE_MAP]
    if unsupported:
        return jsonify({
            "error":           f"Unsupported drug(s): {', '.join(unsupported)}",
            "supported_drugs": sorted(DRUG_GENE_MAP.keys()),
        }), 400

    # this will Accept patient ID from form — fallback to generic ID
    patient_id = request.form.get("patient_id", "").strip() or "PATIENT_001"

    # by this code off lines UUID filename — no path traversal possible
    filepath = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4().hex}.vcf")
    file.save(filepath)

    try:
        all_variants = parse_vcf(filepath)
        results      = [build_response(drug, all_variants, patient_id) for drug in target_drugs]
    finally:
        try:
            os.remove(filepath)
        except OSError:
            pass

    interactions = check_interactions(target_drugs)

    # Always return consistent structure regardless of drug count
    summary = {
        "total_drugs_analysed": len(results),
        "high_risk_count":      sum(1 for r in results if r["risk_assessment"]["severity"] == "high"),
        "moderate_risk_count":  sum(1 for r in results if r["risk_assessment"]["severity"] == "moderate"),
        "safe_count":           sum(1 for r in results if r["risk_assessment"]["severity"] == "none"),
        "patient_id":           patient_id,
        "drug_summary": [
            {
                "drug":       r["drug"],
                "risk":       r["risk_assessment"]["risk_label"],
                "confidence": r["risk_assessment"]["confidence_score"],
                "severity":   r["risk_assessment"]["severity"],
            }
            for r in results
        ],
    }

    return jsonify({
        "results":              results,
        "summary":              summary,
        "interaction_warnings": interactions,
    }), 200


# Error handlers

@app.errorhandler(HTTPException)
def handle_http_error(e):
    return jsonify({"error": e.name, "details": e.description}), e.code

@app.errorhandler(Exception)
def handle_server_error(e):
    app.logger.exception("Unhandled server error")
    return jsonify({"error": "Internal server error", "details": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
