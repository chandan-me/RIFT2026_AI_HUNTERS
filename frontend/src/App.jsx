import { useState, useRef, useCallback } from "react";

/*  CONSTANTS */
const API = "https://rift2026-ai-hunters-ss4e.onrender.com/";

const SUPPORTED_DRUGS = [
  "WARFARIN","CODEINE","CLOPIDOGREL",
  "SIMVASTATIN","AZATHIOPRINE","FLUOROURACIL",
];

const RISK_META = {
  Safe:            { color:"#10b981", bg:"#d1fae5", border:"#6ee7b7", icon:"✓" },
  "Adjust Dosage": { color:"#f59e0b", bg:"#fef3c7", border:"#fcd34d", icon:"⚠" },
  Toxic:           { color:"#ef4444", bg:"#fee2e2", border:"#fca5a5", icon:"✕" },
  Ineffective:     { color:"#8b5cf6", bg:"#ede9fe", border:"#c4b5fd", icon:"∅" },
};
const getRisk = (label) =>
  RISK_META[label] || { color:"#6b7280", bg:"#f3f4f6", border:"#d1d5db", icon:"?" };

/*  PDF REPORT GENERATOR */
function generatePDF(results, summary, patientId) {
  const now    = new Date().toLocaleString();
  const riskColor = { Safe:"#10b981", "Adjust Dosage":"#f59e0b", Toxic:"#ef4444", Ineffective:"#8b5cf6" };

  const drugRows = results.map(r => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600">${r.drug}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">
        <span style="color:${riskColor[r.risk_assessment.risk_label]||"#374151"};font-weight:700">
          ${r.risk_assessment.risk_label}
        </span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${Math.round(r.risk_assessment.confidence_score*100)}%</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-transform:capitalize">${r.risk_assessment.severity}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${r.pharmacogenomic_profile.primary_gene}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${r.pharmacogenomic_profile.diplotype}</td>
    </tr>`).join("");

  const detailSections = results.map(r => `
    <div style="margin-bottom:32px;padding:24px;border:1px solid #e2e8f0;border-radius:12px;border-left:4px solid ${riskColor[r.risk_assessment.risk_label]||"#374151"}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:20px;color:#0f172a">${r.drug}</h3>
        <span style="background:${getRisk(r.risk_assessment.risk_label).bg};color:${riskColor[r.risk_assessment.risk_label]};padding:6px 16px;border-radius:99px;font-weight:700;font-size:14px">
          ${r.risk_assessment.risk_label}
        </span>
      </div>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Clinical Recommendation</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#1e293b">${r.clinical_recommendation.recommendation_text}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Clinical Explanation</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#1e293b">${r.llm_generated_explanation.summary}</p>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>PharmaGuard Report — ${patientId}</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:40px;color:#0f172a;background:#fff}
    @media print{body{padding:20px}}
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:28px">🧬</span>
        <span style="font-size:22px;font-weight:800;color:#0f172a">PharmaGuard</span>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b">AI-Powered Pharmacogenomic Risk Report</p>
    </div>
    <div style="text-align:right">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b">Generated</p>
      <p style="margin:0;font-size:13px;font-weight:600;color:#0f172a">${now}</p>
    </div>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:32px">
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Patient Information</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <div><p style="margin:0;font-size:11px;color:#94a3b8">Patient ID</p><p style="margin:2px 0 0;font-size:15px;font-weight:700">${patientId}</p></div>
      <div><p style="margin:0;font-size:11px;color:#94a3b8">Drugs Analysed</p><p style="margin:2px 0 0;font-size:15px;font-weight:700">${summary.total_drugs_analysed}</p></div>
      <div><p style="margin:0;font-size:11px;color:#94a3b8">High Risk Findings</p><p style="margin:2px 0 0;font-size:15px;font-weight:700;color:#ef4444">${summary.high_risk_count}</p></div>
    </div>
  </div>

  <h2 style="font-size:18px;font-weight:700;margin:0 0 16px;color:#0f172a">Risk Summary</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;font-size:14px">
    <thead>
      <tr style="background:#f8fafc">
        ${["Drug","Risk","Confidence","Severity","Primary Gene","Diplotype"].map(h=>`<th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e2e8f0">${h}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${drugRows}</tbody>
  </table>

  <h2 style="font-size:18px;font-weight:700;margin:0 0 16px;color:#0f172a">Detailed Results</h2>
  ${detailSections}

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;font-size:12px;color:#94a3b8">Generated by PharmaGuard · RIFT 2026 Hackathon · AI Hunters Team</p>
    <p style="margin:4px 0 0;font-size:11px;color:#94a3b8">This report is for informational purposes only. Always consult a qualified clinician before making prescribing decisions.</p>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

/*  FORMAT TIMESTAMP   */
function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day:"2-digit", month:"short", year:"numeric",
      hour:"2-digit", minute:"2-digit",
    });
  } catch { return iso; }
}

/*  RISK SUMMARY DASHBOARD  */
function RiskSummaryDashboard({ summary, darkMode }) {
  const cardBg = darkMode ? "#1e2530" : "#ffffff";
  const border = darkMode ? "#2e3a4e" : "#e2e8f0";
  const textMain  = darkMode ? "#f1f5f9" : "#0f172a";
  const textMuted = darkMode ? "#94a3b8" : "#64748b";

  const bars = summary.drug_summary || [];
  const total = bars.length || 1;

  return (
    <div style={{
      background: cardBg, border: `1px solid ${border}`,
      borderRadius: "20px", padding: "24px", marginBottom: "20px",
      animation: "fadeSlideIn 0.4s ease",
    }}>
      <p style={{ margin:"0 0 16px", fontSize:"12px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>
        Analysis Summary · {summary.patient_id}
      </p>

      {/* Count pills */}
      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginBottom:"20px" }}>
        {[
          { label:"Toxic / High Risk", count: summary.high_risk_count,    color:"#ef4444", bg: darkMode?"#2d1b1b":"#fee2e2" },
          { label:"Adjust Dosage",     count: summary.moderate_risk_count, color:"#f59e0b", bg: darkMode?"#2d2010":"#fef3c7" },
          { label:"Safe",              count: summary.safe_count,          color:"#10b981", bg: darkMode?"#0f2b1f":"#d1fae5" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} style={{
            background: bg, border: `1px solid ${color}40`,
            borderRadius: "12px", padding: "10px 16px",
            display:"flex", alignItems:"center", gap:"10px",
          }}>
            <span style={{ fontSize:"22px", fontWeight:800, color, lineHeight:1 }}>{count}</span>
            <span style={{ fontSize:"12px", fontWeight:600, color, opacity:0.85 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Per-drug mini bar chart */}
      <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
        {bars.map(({ drug, risk, confidence, severity }) => {
          const rm = getRisk(risk);
          return (
            <div key={drug} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ width:"120px", fontSize:"12px", fontWeight:600, color:textMain, flexShrink:0 }}>{drug}</span>
              <div style={{ flex:1, height:"8px", borderRadius:"99px", background: darkMode?"#2e3a4e":"#e2e8f0", overflow:"hidden" }}>
                <div style={{
                  height:"100%", borderRadius:"99px",
                  width:`${Math.round(confidence*100)}%`,
                  background: rm.color,
                  transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
              <span style={{ width:"28px", fontSize:"11px", fontWeight:700, color: rm.color, textAlign:"right", flexShrink:0 }}>
                {Math.round(confidence*100)}%
              </span>
              <span style={{
                width:"90px", fontSize:"11px", fontWeight:700,
                color: rm.color, background: rm.bg,
                border:`1px solid ${rm.border}`, borderRadius:"99px",
                padding:"2px 8px", textAlign:"center", flexShrink:0,
              }}>
                {risk}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/*  INTERACTION WARNING BANNER   */
function InteractionBanner({ warnings, darkMode }) {
  const [open, setOpen] = useState(true);
  if (!warnings?.length || !open) return null;
  return (
    <div style={{
      background: darkMode?"#2d1f0a":"#fffbeb",
      border:"1.5px solid #f59e0b", borderRadius:"14px",
      padding:"16px 18px", marginBottom:"20px",
      animation:"fadeSlideIn 0.4s ease",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <p style={{ margin:"0 0 6px", fontSize:"13px", fontWeight:700, color:"#92400e", textTransform:"uppercase", letterSpacing:"0.08em" }}>
            ⚠ Drug Interaction Warning{warnings.length > 1 ? "s" : ""}
          </p>
          {warnings.map((w, i) => (
            <p key={i} style={{ margin:"4px 0 0", fontSize:"13px", lineHeight:"1.6", color: darkMode?"#fcd34d":"#78350f" }}>
              <strong>{w.drugs.join(" + ")}</strong> — {w.message}
            </p>
          ))}
        </div>
        <button onClick={() => setOpen(false)} style={{
          background:"none", border:"none", cursor:"pointer",
          color:"#92400e", fontSize:"16px", padding:"0 0 0 12px", flexShrink:0,
        }}>✕</button>
      </div>
    </div>
  );
}

/*  RESULT CARD   */
function ResultCard({ data, darkMode, index }) {
  const [expanded,  setExpanded]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [copiedRec, setCopiedRec] = useState(false);

  const risk       = getRisk(data.risk_assessment?.risk_label);
  const confidence = Math.round((data.risk_assessment?.confidence_score ?? 0) * 100);
  const profile    = data.pharmacogenomic_profile  ?? {};
  const rec        = data.clinical_recommendation  ?? {};
  const llm        = data.llm_generated_explanation ?? {};
  const noVariants = data.no_variants_detected;

  const cardBg    = darkMode ? "#1e2530" : "#ffffff";
  const subBg     = darkMode ? "#252d3a" : "#f8fafc";
  const border    = darkMode ? "#2e3a4e" : "#e2e8f0";
  const textMain  = darkMode ? "#f1f5f9" : "#0f172a";
  const textMuted = darkMode ? "#94a3b8" : "#64748b";

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `PharmaGuard_${data.patient_id}_${data.drug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  //  copying just the recommendation text
  const copyRec = () => {
    navigator.clipboard.writeText(rec.recommendation_text || "");
    setCopiedRec(true);
    setTimeout(() => setCopiedRec(false), 2000);
  };

  return (
    // staggered entrance animation
    <div style={{
      background: cardBg, border: `1px solid ${border}`,
      borderRadius: "20px", padding: "28px",
      boxShadow: darkMode ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)",
      marginBottom: "16px",
      animation: `fadeSlideIn 0.4s ease ${index * 0.08}s both`,
    }}>

      {/* zero-variant state */}
      {noVariants && (
        <div style={{
          background: darkMode?"#1a2535":"#f0f9ff",
          border:`1px solid ${darkMode?"#2e3a4e":"#bae6fd"}`,
          borderRadius:"10px", padding:"10px 14px",
          marginBottom:"16px", fontSize:"13px",
          color: darkMode?"#7dd3fc":"#0369a1", fontWeight:500,
        }}>
          ℹ No relevant variants detected — standard dosing assumed
        </div>
      )}

      {/* Header row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"20px" }}>
        <div>
          <p style={{ margin:0, fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.1em" }}>Drug</p>
          <h3 style={{ margin:"2px 0 0", fontSize:"22px", fontWeight:800, color:textMain, letterSpacing:"-0.02em" }}>{data.drug}</h3>
          {/* #8 — human-readable timestamp */}
          <p style={{ margin:"2px 0 0", fontSize:"11px", color:textMuted }}>{formatTimestamp(data.timestamp)}</p>
        </div>
         
        {/* #12 — animated risk badge */}
        <div style={{
          display:"flex", alignItems:"center", gap:"8px",
          background: risk.bg, border:`1.5px solid ${risk.border}`,
          borderRadius:"40px", padding:"8px 18px",
          animation:"badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
          animationDelay:`${index * 0.08 + 0.2}s`,
        }}>
          <span style={{ fontSize:"15px", color:risk.color, fontWeight:700 }}>{risk.icon}</span>
          <span style={{ fontSize:"14px", fontWeight:700, color:risk.color }}>{data.risk_assessment?.risk_label}</span>
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom:"20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
          <span style={{ fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>Confidence</span>
          <span style={{ fontSize:"13px", fontWeight:700, color:risk.color }}>{confidence}%</span>
        </div>
        <div style={{ height:"8px", borderRadius:"99px", background:darkMode?"#2e3a4e":"#e2e8f0", overflow:"hidden" }}>
          <div style={{
            height:"100%", borderRadius:"99px",
            width:`${confidence}%`,
            background:`linear-gradient(90deg,${risk.color}cc,${risk.color})`,
            transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>
      </div>

      {/* Chips */}
      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginBottom:"20px" }}>
        {[
          ["Severity",    data.risk_assessment?.severity ?? "—"],
          ["Patient",     data.patient_id ?? "—"],
          ["Gene",        profile.primary_gene ?? "—"],
          ["Diplotype",   profile.diplotype ?? "—"],
          ["Phenotype",   profile.phenotype ?? "—"],
        ].map(([label, val]) => (
          <div key={label} style={{
            background:subBg, border:`1px solid ${border}`,
            borderRadius:"10px", padding:"7px 12px",
          }}>
            <p style={{ margin:0, fontSize:"10px", color:textMuted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</p>
            <p style={{ margin:"2px 0 0", fontSize:"13px", fontWeight:600, color:textMain }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Expandable */}
      {expanded && (
        <div style={{ display:"flex", flexDirection:"column", gap:"14px", marginBottom:"20px" }}>

          {/* Variants table */}
          {profile.detected_variants?.length > 0 && (
            <div style={{ background:subBg, border:`1px solid ${border}`, borderRadius:"14px", padding:"16px" }}>
              <p style={{ margin:"0 0 10px", fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                🧬 Detected Variants ({profile.detected_variants.length})
              </p>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                  <thead>
                    <tr>
                      {["Gene","Allele","RSID","Phenotype"].map(h => (
                        <th key={h} style={{ textAlign:"left", padding:"6px 8px", color:textMuted, fontWeight:700, borderBottom:`1px solid ${border}`, textTransform:"uppercase", letterSpacing:"0.06em", fontSize:"10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.detected_variants.map((v, i) => (
                      <tr key={i}>
                        <td style={{ padding:"7px 8px", color:textMain, fontWeight:600, borderBottom:`1px solid ${border}` }}>{v.gene}</td>
                        <td style={{ padding:"7px 8px", color:risk.color, fontWeight:700, borderBottom:`1px solid ${border}` }}>{v.allele}</td>
                        <td style={{ padding:"7px 8px", color:textMuted, borderBottom:`1px solid ${border}` }}>{v.rsid || "—"}</td>
                        <td style={{ padding:"7px 8px", color:textMuted, borderBottom:`1px solid ${border}` }}>{v.phenotype?.replace(/_/g," ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Clinical recommendation */}
          <div style={{
            background: darkMode?"#1a2535":risk.bg,
            border:`1px solid ${risk.border}`,
            borderRadius:"14px", padding:"16px",
            borderLeft:`4px solid ${risk.color}`,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}>
              <div style={{ flex:1 }}>
                <p style={{ margin:"0 0 6px", fontSize:"11px", fontWeight:700, color:risk.color, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                  💊 Clinical Recommendation
                </p>
                <p style={{ margin:0, fontSize:"14px", lineHeight:"1.7", color:textMain }}>
                  {rec.recommendation_text || "No recommendation available."}
                </p>
              </div>
              {/* #11 — copy recommendation */}
              <button onClick={copyRec} title="Copy recommendation" style={{
                padding:"6px 12px", borderRadius:"8px", border:`1px solid ${border}`,
                background:copiedRec?(darkMode?"#0f2b1f":"#d1fae5"):"transparent",
                color:copiedRec?"#10b981":textMuted,
                fontSize:"11px", fontWeight:600, cursor:"pointer",
                transition:"all 0.2s", flexShrink:0, whiteSpace:"nowrap",
              }}>
                {copiedRec ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>
          </div>

          {/* Clinical explanation */}
          <div style={{ background:subBg, border:`1px solid ${border}`, borderRadius:"14px", padding:"16px" }}>
            <p style={{ margin:"0 0 6px", fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              🤖 Clinical Explanation
            </p>
            <p style={{ margin:0, fontSize:"14px", lineHeight:"1.8", color:textMain }}>
              {llm.summary || "No explanation available."}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
        <button onClick={() => setExpanded(!expanded)} style={{
          padding:"8px 16px", borderRadius:"99px", border:`1px solid ${border}`,
          background:"transparent", color:textMain, fontSize:"12px", fontWeight:600,
          cursor:"pointer", transition:"all 0.2s",
        }}>
          {expanded ? "Hide Details" : "Show Details"}
        </button>
        <button onClick={copyJSON} style={{
          padding:"8px 16px", borderRadius:"99px", border:"none",
          background:copied?"#10b981":(darkMode?"#2e3a4e":"#1e293b"),
          color:"#fff", fontSize:"12px", fontWeight:600, cursor:"pointer", transition:"all 0.3s",
        }}>
          {copied ? "✓ Copied!" : "📋 Copy JSON"}
        </button>
        <button onClick={downloadJSON} style={{
          padding:"8px 16px", borderRadius:"99px", border:"none",
          background:`linear-gradient(135deg,${risk.color}dd,${risk.color})`,
          color:"#fff", fontSize:"12px", fontWeight:600, cursor:"pointer",
        }}>
          🡻 Download
        </button>
      </div>
    </div>
  );
}

/*  SKELETON */
function Skeleton({ darkMode }) {
  const sh = darkMode ? "#2e3a4e" : "#e2e8f0";
  const bg = darkMode ? "#1e2530" : "#ffffff";
  return (
    <div style={{ background:bg, border:`1px solid ${darkMode?"#2e3a4e":"#e2e8f0"}`, borderRadius:"20px", padding:"28px", marginBottom:"16px" }}>
      {[100,160,80,200,120].map((w,i)=>(
        <div key={i} style={{
          height:i===0?"24px":"12px", width:`${w}px`, borderRadius:"6px", marginBottom:"14px",
          background:`linear-gradient(90deg,${sh} 25%,${darkMode?"#374151":"#f1f5f9"} 50%,${sh} 75%)`,
          backgroundSize:"400px 100%", animation:"shimmer 1.4s ease-in-out infinite",
        }}/>
      ))}
    </div>
  );
}

/*  MAIN APP */
export default function App() {
  const [file,        setFile]        = useState(null);
  const [drug,        setDrug]        = useState("");
  const [patientId,   setPatientId]   = useState("");           
  const [dragActive,  setDragActive]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [results,     setResults]     = useState(null);
  const [summary,     setSummary]     = useState(null);
  const [warnings,    setWarnings]    = useState([]);
  const [error,       setError]       = useState(null);
  const [darkMode,    setDarkMode]    = useState(false);
  const [activeNav,   setActiveNav]   = useState(null);
  const [vcfStatus,   setVcfStatus]   = useState(null);        
  const fileInputRef  = useRef();

  /* dark theme */
  const bg        = darkMode ? "linear-gradient(135deg,#0d1117,#161d27,#1a2433)" : "linear-gradient(135deg,#f0f4f8,#e8eef4,#dde5ef)";
  const navBg     = darkMode ? "#0d1117" : "#ffffff";
  const textMain  = darkMode ? "#f1f5f9" : "#0f172a";
  const textMuted = darkMode ? "#94a3b8" : "#64748b";
  const inputBg   = darkMode ? "#1e2530" : "#ffffff";
  const inputBdr  = darkMode ? "#2e3a4e" : "#cbd5e1";
  const cardBg    = darkMode ? "#1e2530" : "#ffffff";
  const cardBdr   = darkMode ? "#2e3a4e" : "#e2e8f0";

  /* VCF validation on file pick  */
  const validateFile = useCallback(async (f) => {
    setVcfStatus("checking");
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res  = await fetch(`${API}/api/validate`, { method:"POST", body:fd });
      const data = await res.json();
      // Only block on hard errors — empty file or unreadable.
      // Annotation-format warnings are fine; the full parser handles them.
      const hardErrors = (data.errors || []).filter(e =>
        e.includes("empty") ||
        e.includes("Could not read") ||
        e.includes("No data lines")
      );
      if (hardErrors.length > 0) {
        setVcfStatus("error");
        setError(hardErrors[0]);
      } else {
        setVcfStatus("ok");
        setError(null);
      }
    } catch {
      setVcfStatus("ok"); 
    }
  }, []);

  const handleFilePick = (f) => {
    if (!f) return;
    if (!f.name.endsWith(".vcf")) { setError("Please upload a .vcf file."); return; }
    setFile(f);
    setError(null);
    validateFile(f);
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    handleFilePick(e.dataTransfer.files?.[0]);
  };

  /* Drug chip toggle */
  const toggleDrug = (d) => {
    const existing = drug.split(",").map(x=>x.trim()).filter(Boolean);
    if (existing.includes(d)) {
      setDrug(existing.filter(x=>x!==d).join(", "));
    } else {
      setDrug(existing.length ? `${drug.trim()}, ${d}` : d);
    }
  };

  /* Analyse  */
  const handleAnalyze = async () => {
    if (!file)        return setError("Please upload a VCF file.");
    if (!drug.trim()) return setError("Please enter a drug name.");
    if (vcfStatus === "error") return setError("Please fix the VCF file before analysing.");
    setError(null); setResults(null); setSummary(null); setWarnings([]);
    setLoading(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("drug", drug);
    if (patientId.trim()) fd.append("patient_id", patientId.trim());

    try {
      const res  = await fetch(`${API}/api/analyze`, { method:"POST", body:fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `Server error (${res.status})`); return; }

      // Backend always returns { results, summary, interaction_warnings }
      setResults(data.results || [data]);
      setSummary(data.summary || null);
      setWarnings(data.interaction_warnings || []);
    } catch {
      setError("Unable to reach the backend. Is Flask running on port 5000?");
    } finally {
      setLoading(false);
    }
  };

  const NAV_CONTENT = {
    home:    { title:"Welcome to PharmaGuard", body:"An AI-powered pharmacogenomic risk prediction platform helping clinicians make safer, personalised medication decisions based on each patient's unique genetic profile." },
    about:   { title:"About PharmaGuard", body:"Built for RIFT 2026 Hackathon, PharmaGuard integrates genomics, risk modelling, and explainable clinical recommendations to enable precision medicine at the point of care." },
    contact: { title:"Contact", body:"📧 pharmaguard@rift2026.ai   📍 Bengaluru, India   🤖 Built by AI Hunters Team" },
  };

  /* VCF status indicator */
  const vcfIcon = vcfStatus === "checking" ? "⏳"
                : vcfStatus === "ok"       ? "✅"
                : vcfStatus === "error"    ? "❌"
                : "📁";

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", minHeight:"100vh", background:bg, color:textMain, transition:"all 0.4s ease", overflowX:"hidden" }}>

      {/*  NAVBAR  */}
      <nav style={{
        position:"sticky", top:0, zIndex:100,
        background:navBg, borderBottom:`1px solid ${cardBdr}`,
        padding:"0 32px", height:"64px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        boxShadow: darkMode?"0 1px 0 #2e3a4e":"0 1px 0 #e2e8f0",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"26px" }}>🧬</span>
          <span style={{ fontSize:"17px", fontWeight:700, letterSpacing:"-0.02em" }}>Pharma Guard</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          {["home","about","contact"].map(item=>(
            <button key={item} onClick={()=>setActiveNav(activeNav===item?null:item)} style={{
              padding:"7px 14px", borderRadius:"8px", border:"none",
              background:activeNav===item?(darkMode?"#2e3a4e":"#f1f5f9"):"transparent",
              color:textMuted, fontSize:"14px", fontWeight:500,
              cursor:"pointer", textTransform:"capitalize", transition:"all 0.2s",
            }}>{item}</button>
          ))}
          <div style={{ width:"1px", height:"24px", background:cardBdr, margin:"0 6px" }}/>
          <button onClick={()=>window.open("https://drive.google.com/file/d/1605SsCNf5HbA3b-QvoE650QvXEtTDz2b/view?usp=sharing","_blank")} style={{
            padding:"8px 14px", borderRadius:"99px", border:"none",
            background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff",
            fontSize:"13px", fontWeight:600, cursor:"pointer",
          }}>🡻 Dataset</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{
            padding:"8px 14px", borderRadius:"99px", border:`1px solid ${cardBdr}`,
            background:darkMode?"#f1f5f9":"#1e293b",
            color:darkMode?"#1e293b":"#f1f5f9",
            fontSize:"13px", fontWeight:600, cursor:"pointer", marginLeft:"4px",
          }}>{darkMode?"☀ Light":"🌙 Dark"}</button>
        </div>
      </nav>

      {/* Nav dropdown */}
      <div style={{ maxHeight:activeNav?"120px":"0", overflow:"hidden", transition:"max-height 0.4s ease", background:darkMode?"#111827":"#f8fafc", borderBottom:activeNav?`1px solid ${cardBdr}`:"none" }}>
        {activeNav && NAV_CONTENT[activeNav] && (
          <div style={{ padding:"20px 40px", maxWidth:"800px", margin:"0 auto" }}>
            <p style={{ margin:"0 0 4px", fontWeight:700, fontSize:"15px", color:textMain }}>{NAV_CONTENT[activeNav].title}</p>
            <p style={{ margin:0, fontSize:"14px", color:textMuted, lineHeight:"1.6" }}>{NAV_CONTENT[activeNav].body}</p>
          </div>
        )}
      </div>

      {/* HERO section */}
      <div style={{ textAlign:"center", padding:"64px 20px 40px", position:"relative" }}>
        <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:"600px", height:"300px", background:darkMode?"radial-gradient(ellipse,rgba(59,130,246,0.15) 0%,transparent 70%)":"radial-gradient(ellipse,rgba(59,130,246,0.10) 0%,transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:darkMode?"#1e2530":"#eff6ff", border:`1px solid ${darkMode?"#2e3a4e":"#bfdbfe"}`, borderRadius:"99px", padding:"6px 16px", marginBottom:"20px" }}>
          <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#10b981", display:"inline-block" }}/>
          <span style={{ fontSize:"11px", fontWeight:700, color:darkMode?"#60a5fa":"#1d4ed8", letterSpacing:"0.06em" }}>PHARMACOGENOMICS · AI-POWERED RISK ANALYSIS</span>
        </div>
        <h1 style={{ fontSize:"clamp(36px,6vw,64px)", fontWeight:800, letterSpacing:"-0.03em", margin:"0 0 16px", lineHeight:1.1 }}>Pharma Guard</h1>
        <p style={{ fontSize:"clamp(15px,2vw,19px)", color:textMuted, maxWidth:"540px", margin:"0 auto", lineHeight:"1.6" }}>
          AI-powered pharmacogenomic risk prediction for precision medicine and safer prescriptions.
        </p>
      </div>

      {/* MAIN CARD section*/}
      <div style={{ display:"flex", justifyContent:"center", padding:"0 20px 60px" }}>
        <div style={{ width:"100%", maxWidth:"660px", background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:"24px", padding:"36px", boxShadow:darkMode?"0 8px 40px rgba(0,0,0,0.5)":"0 8px 40px rgba(0,0,0,0.10)" }}>

          {/* Patient ID  */}
          <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>Patient ID</p>
          <input type="text" placeholder="e.g. PAT-2024-001 (optional)"
            value={patientId} onChange={e=>setPatientId(e.target.value)}
            style={{ width:"100%", padding:"11px 14px", borderRadius:"10px", border:`1.5px solid ${inputBdr}`, background:inputBg, color:textMain, fontSize:"14px", outline:"none", boxSizing:"border-box", marginBottom:"18px", fontFamily:"inherit", transition:"border-color 0.2s" }}
            onFocus={e=>e.target.style.borderColor="#3b82f6"}
            onBlur={e=>e.target.style.borderColor=inputBdr}
          />

          {/* Upload  (live vcf status) */}
          <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>Genetic File</p>
          <label onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            style={{
              display:"block", padding:"26px 20px", borderRadius:"14px",
              border:`2px dashed ${dragActive?"#3b82f6":vcfStatus==="ok"?"#10b981":vcfStatus==="error"?"#ef4444":inputBdr}`,
              background:dragActive?(darkMode?"#1e3a5f":"#eff6ff"):vcfStatus==="ok"?(darkMode?"#0f2b1f":"#f0fdf4"):vcfStatus==="error"?(darkMode?"#2d1b1b":"#fff1f2"):(darkMode?"#141b24":"#f8fafc"),
              textAlign:"center", cursor:"pointer", transition:"all 0.3s", marginBottom:"18px",
            }}>
            <span style={{ fontSize:"26px", display:"block", marginBottom:"6px" }}>{vcfIcon}</span>
            <span style={{ fontSize:"13px", fontWeight:file?600:400, color:vcfStatus==="ok"?"#10b981":vcfStatus==="error"?"#ef4444":textMuted }}>
              {file
                ? vcfStatus==="checking" ? `Validating ${file.name}…`
                  : vcfStatus==="ok"   ? `✓ ${file.name}`
                  : vcfStatus==="error"? `✕ ${file.name} — invalid VCF`
                  : file.name
                : "Drag & drop .vcf file here, or click to browse"}
            </span>
            {file && (
              <button onClick={e=>{e.preventDefault();setFile(null);setVcfStatus(null);}} style={{ display:"block", margin:"6px auto 0", fontSize:"11px", color:textMuted, background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
                Remove
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".vcf" onChange={e=>handleFilePick(e.target.files[0])} style={{ display:"none" }}/>
          </label>

          {/* Drug dropdown  */}
          <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>Drug Name</p>
          <select value="" onChange={e=>{ if(e.target.value) toggleDrug(e.target.value); }}
            style={{ width:"100%", padding:"11px 14px", borderRadius:"10px", border:`1.5px solid ${inputBdr}`, background:inputBg, color:drug?textMain:textMuted, fontSize:"14px", outline:"none", boxSizing:"border-box", marginBottom:"10px", fontFamily:"inherit", cursor:"pointer", transition:"border-color 0.2s" }}
            onFocus={e=>e.target.style.borderColor="#3b82f6"}
            onBlur={e=>e.target.style.borderColor=inputBdr}
          >
            <option value="" disabled>Select a drug to add…</option>
            {SUPPORTED_DRUGS.map(d=>(
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Selected drug chips */}
          {drug && (
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"16px" }}>
              {drug.split(",").map(d=>d.trim()).filter(Boolean).map(d=>(
                <div key={d} style={{
                  display:"flex", alignItems:"center", gap:"6px",
                  background:darkMode?"#1e3a5f":"#eff6ff",
                  border:"1px solid #bfdbfe", borderRadius:"99px",
                  padding:"4px 12px", fontSize:"12px", fontWeight:700, color:"#1d4ed8",
                }}>
                  {d}
                  <button onClick={()=>toggleDrug(d)} style={{ background:"none", border:"none", cursor:"pointer", color:"#93c5fd", fontSize:"14px", padding:0, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background:darkMode?"#2d1b1b":"#fee2e2", border:"1px solid #fca5a5", borderRadius:"10px", padding:"12px 16px", marginBottom:"16px", fontSize:"13px", color:"#dc2626", fontWeight:500 }}>
              ⚠ {error}
            </div>
          )}

          {/* Analyse button */}
          <button onClick={handleAnalyze} disabled={loading} style={{
            width:"100%", padding:"15px", borderRadius:"12px", border:"none",
            background:loading?(darkMode?"#2e3a4e":"#e2e8f0"):"linear-gradient(135deg,#3b82f6,#1d4ed8)",
            color:loading?textMuted:"#fff",
            fontSize:"15px", fontWeight:700, cursor:loading?"not-allowed":"pointer",
            transition:"all 0.3s", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px",
          }}>
            {loading && <span style={{ width:"16px", height:"16px", borderRadius:"50%", border:"2.5px solid #ffffff50", borderTopColor:"#fff", display:"inline-block", animation:"spin 0.8s linear infinite" }}/>}
            {loading ? "Analysing…" : "Analyse →"}
          </button>

          {/* Loading skeletons */}
          {loading && (
            <div style={{ marginTop:"28px" }}>
              {[0,1,2].map(i=><Skeleton key={i} darkMode={darkMode}/>)}
            </div>
          )}

          {/* Results */}
          {results && !loading && (
            <div style={{ marginTop:"28px" }}>

              {/* Summary dashboard  */}
              {summary && results.length > 1 && (
                <RiskSummaryDashboard summary={summary} darkMode={darkMode}/>
              )}

              {/* Interaction warnings */}
              <InteractionBanner warnings={warnings} darkMode={darkMode}/>

              {/* PDF report button */}
              {summary && (
                <button onClick={()=>generatePDF(results, summary, patientId||"PATIENT_001")} style={{
                  width:"100%", padding:"12px", borderRadius:"12px", border:`1px solid ${cardBdr}`,
                  background:"transparent", color:textMain, fontSize:"13px", fontWeight:600,
                  cursor:"pointer", marginBottom:"16px", transition:"all 0.2s",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
                }}>
                  🖨 Generate PDF Report
                </button>
              )}

              <p style={{ margin:"0 0 12px", fontSize:"11px", fontWeight:700, color:textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                {results.length > 1 ? `${results.length} Drug Results` : "Analysis Result"}
              </p>

              {results.map((r, i) => (
                <ResultCard key={i} data={r} darkMode={darkMode} index={i}/>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FEATURES  */}
      <div style={{ background:darkMode?"#111827":"#ffffff", padding:"72px 20px", textAlign:"center" }}>
        <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:700, color:"#3b82f6", letterSpacing:"0.1em", textTransform:"uppercase" }}>Why Choose Us</p>
        <h2 style={{ fontSize:"clamp(28px,4vw,40px)", fontWeight:800, letterSpacing:"-0.02em", margin:"0 0 48px" }}>Why Pharma Guard?</h2>
        <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:"24px", maxWidth:"1000px", margin:"0 auto" }}>
          {[
            { emoji:"🤖", title:"AI Prediction",      color:"#3b82f6", text:"Advanced models analyse genomic variants to predict drug response risks, helping clinicians avoid adverse reactions before treatment begins." },
            { emoji:"🧬", title:"Precision Medicine",  color:"#10b981", text:"Tailors medication recommendations based on individual genetic profiles, enabling safer, more effective personalised healthcare decisions." },
            { emoji:"📊", title:"Clinical Insights",   color:"#f59e0b", text:"Actionable pharmacogenomic insights support clinical decision-making with clear risk assessment, dosage guidance, and evidence-based recommendations." },
          ].map(item=>(
            <div key={item.title} style={{
              width:"280px", padding:"28px",
              background:cardBg, border:`1px solid ${cardBdr}`,
              borderRadius:"20px", textAlign:"left",
              boxShadow:darkMode?"0 4px 20px rgba(0,0,0,0.3)":"0 4px 20px rgba(0,0,0,0.06)",
              transition:"transform 0.3s, box-shadow 0.3s", cursor:"default",
            }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow=darkMode?"0 12px 32px rgba(0,0,0,0.5)":"0 12px 32px rgba(0,0,0,0.12)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=darkMode?"0 4px 20px rgba(0,0,0,0.3)":"0 4px 20px rgba(0,0,0,0.06)";}}
            >
              <div style={{ width:"44px", height:"44px", borderRadius:"12px", background:`${item.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", marginBottom:"14px" }}>{item.emoji}</div>
              <h3 style={{ margin:"0 0 8px", fontSize:"16px", fontWeight:700, color:item.color }}>{item.title}</h3>
              <p style={{ margin:0, fontSize:"13px", lineHeight:"1.7", color:textMuted }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background:darkMode?"#0d1117":"#f8fafc", borderTop:`1px solid ${cardBdr}`, padding:"20px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ fontSize:"18px" }}>🧬</span>
          <span style={{ fontSize:"13px", fontWeight:600, color:textMuted }}>Pharma Guard</span>
        </div>
        <span style={{ fontSize:"12px", color:textMuted }}>Built for RIFT 2026 Hackathon · AI Hunters Team</span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        body{margin:0}
        input::placeholder,select{color:#94a3b8}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes badgePop{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}
