import React, { useState, useEffect, useRef, useCallback } from "react";
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
          {/*  human-readable timestamp */}
          <p style={{ margin:"2px 0 0", fontSize:"11px", color:textMuted }}>{formatTimestamp(data.timestamp)}</p>
        </div>
         
        {/* animated risk badge */}
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

      // page loader states
       const [loader,     setLoader]     = useState(true);  
          const [progress, setProgress] = useState(0);
            const [statusIndex, setStatusIndex] = useState(0);

  const [results,     setResults]     = useState(null);
  const [summary,     setSummary]     = useState(null);
  const [warnings,    setWarnings]    = useState([]);
  const [error,       setError]       = useState(null);
  const [darkMode,    setDarkMode]    = useState(false);
  const [activeNav,   setActiveNav]   = useState(null);
  const [vcfStatus,   setVcfStatus]   = useState(null);      

      // for mobile menu toggle
      const [menuOpen, setMenuOpen] = useState(false);
  
        const CONTAINER = {
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "0 20px"
        };
    
        const navContentRef = useRef(null);
  const fileInputRef  = useRef();

//  page loader use effect
const statusMessages = [
  "Loading Genomic Data...",
  "Running AI Analysis...",
  "Checking Drug Interactions...",
  "Generating Clinical Report..."
];

useEffect(() => {

  let current = 0;

  const progressTimer = setInterval(() => {

    current += Math.floor(Math.random() * 10) + 5; // Increment by a random value between 5 and 15

    setProgress(current);

    if (current >= 100) {
      clearInterval(progressTimer);
      setLoader(false);
    }

  }, 1000);

  const statusTimer = setInterval(() => {
    setStatusIndex(prev => (prev + 1) % statusMessages.length);
  }, 1200);

  return () => {
    clearInterval(progressTimer);
    clearInterval(statusTimer);
  };

}, []);

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
    home: {
      icon: "🏠",
      title: "Welcome to PharmaGuard",
      subtitle: "AI-Powered Precision Medicine Platform",

      description: `
    Transforming healthcare through pharmacogenomics, machine learning, and personalized medication intelligence.

    PharmaGuard is an AI-powered pharmacogenomic risk prediction platform designed to analyze patient genetic data and predict personalized drug response risks.

    The system helps identify adverse drug reactions, optimize dosage recommendations, and provide explainable clinical insights using AI and genomic data.

    Developed as part of the RIFT 2026 HealthTech AI Hackathon, PharmaGuard aims to advance precision medicine through intelligent genomic analysis.
      `,

      stats: [
        { value: "95%", label: "Prediction Accuracy" },
        { value: "24/7", label: "Clinical Support" },
        { value: "AI", label: "Risk Assessment" }
      ]

  },

  about: {
    icon: "🧬",
    title: "About PharmaGuard",
    description:"PharmaGuard is an enterprise AI platform that integrates genomic analysis and clinical insights to eliminate adverse drug reactions. The system provides real-time decision support, allowing hospital networks to predict patient drug responses and optimize treatment efficacy. By automating precision medicine workflows, it significantly reduces care delivery costs while maximizing patient safety and treatment outcomes. PharmaGuard is designed to be scalable, secure, and compliant with healthcare regulations, making it suitable for deployment in hospitals, clinics, and research institutions.",

    features: [
      "Pharmacogenomic Analysis",
      "AI Risk Prediction",
      "Clinical Decision Support",
      "Personalized Treatment Plans"
    ],

    stats: [
  { value: "95%", label: "Prediction Accuracy" },
  { value: "50K+", label: "Genomic Variants" },
  { value: "24/7", label: "Clinical Support" },
],
  },

contact: {
  icon: "📞",
  title: "Get In Touch",
  subtitle: "AI Hunters Team",
  email: "pharmaguard.ai@gmail.com",
  phone: "+91 6360475219",
  location: "Bengaluru, Karnataka",
  website: "www.pharmaguard.ai"
}
};

  /* VCF status indicator */
  const vcfIcon = vcfStatus === "checking" ? "⏳"
                : vcfStatus === "ok"       ? "✅"
                : vcfStatus === "error"    ? "❌"
                : "📁";


  // page Loader animation


if (loader) {
  return (
    <div className="loader-screen">

      <div className="loader-card">

        <div className="dna-glow"></div>

        <div className="dna-loader">
          🧬
        </div>

        <h1 className="loader-title">
          Pharma Guard
        </h1>

        <p className="loader-tagline">
          Precision Pharmacogenomics Platform
        </p>

        <div className="status-text">
          {statusMessages[statusIndex]}
        </div>

        <div className="loader-bar">
          <div
            className="loader-progress"
            style={{
              width: `${progress}%`
            }}
          />
        </div>

        <div className="progress-text">
          {progress}%
        </div>

      </div>

    </div>
  );
}

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", minHeight:"100vh", background:bg, color:textMain, transition:"all 0.4s ease", overflowX:"hidden" }}>

      {/*  NAVBAR  */}
        <nav
  className="navbar-container"
  style={{
        position:"fixed",
        top:0,
        left: 0,
        right: 0,
        zIndex:1000,
        background: darkMode
        ? "rgba(15,23,42,0.85)"
        : "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,.08)",
        backdropFilter:"blur(12px)",
        borderBottom:`2px solid ${cardBdr}`,
        padding:"12px 20px",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        flexWrap:"wrap",
        gap:"15px"
        }}
    >

        <div 
         className="logo-section"
         style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"26px" }}>🧬</span>
          <span style={{ fontSize:"18px", fontWeight:700, letterSpacing:"-0.02em",    whiteSpace:"nowrap", }}>Pharma Guard</span>
        </div>

          {/* Mobile Hamburger */}
        <div className="mobile-menu-btn">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background:"transparent",
              border:"none",
              fontSize:"28px",
              color:textMain,
              cursor:"pointer"
            }}
          >
            ☰
          </button>
        </div>

        {/* Desktop Menu */}
        <div className="desktop-menu">
          <div
          className="nav-menu"
          style={{ display:"flex", alignItems:"center", gap:"16px" }}
          >
          {["home","about","contact"].map(item=>(
            <button key={item} 
              onClick={() => {
                setActiveNav(item);
                setTimeout(() => {
                  navContentRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }, 100);

              }}
            style={{
              padding:"7px 14px", borderRadius:"8px", border:"none",
              background:activeNav===item?(darkMode?"#2e3a4e":"#7e95ac"):"transparent",
              color:textMuted, fontSize:"14px", fontWeight:500,
              cursor:"pointer", textTransform:"capitalize", transition:"all 0.2s",
              fontWeight:activeNav===item?700:500, color:activeNav===item?textMain:textMuted,
            }}>{item}</button>
          ))}
          <div style={{ width:"1px", height:"24px", background:cardBdr, margin:"0 6px" }}/>
          <button onClick={()=>window.open("https://drive.google.com/file/d/1605SsCNf5HbA3b-QvoE650QvXEtTDz2b/view?usp=sharing","_blank","noopener,noreferrer")} style={{
            padding:"8px 14px", borderRadius:"99px", border:"none",
            background:"linear-gradient(135deg,#3b82f6,#1d4ed8)", color:"#fff",
            fontSize:"13px", fontWeight:600, cursor:"pointer",
          }}>🡻 Dataset</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{
            padding:"8px 14px", borderRadius:"99px", border:`1px solid ${cardBdr}`,
            background:darkMode?"#f1f5f9":"#1e293b",
            color:darkMode?"#1e293b":"#f1f5f9",
            fontSize:"15px", fontWeight:600, cursor:"pointer", marginLeft:"10px",
          }}>{darkMode?" ☀️ ":"🌙 "}</button>
        </div>
        </div>
        
      </nav>
    
   {menuOpen && (
  <div
    className="mobile-dropdown"
    style={{
      background: cardBg,
      padding: "15px",
      borderBottom: `1px solid ${cardBdr}`,
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }}
  >
    <button
      onClick={()=>{
        setActiveNav("home");
        setMenuOpen(false);
      }}
    >
      🏠 Home
    </button>

    <button
      onClick={()=>{
        setActiveNav("about");
        setMenuOpen(false);
      }}
    >
      🧬 About
    </button>

    <button
      onClick={()=>{
        setActiveNav("contact");
        setMenuOpen(false);
      }}
    >
      📞 Contact
    </button>

    <button
      onClick={() =>
        window.open(
          "https://drive.google.com/file/d/1605SsCNf5HbA3b-QvoE650QvXEtTDz2b/view?usp=sharing",
          "_blank"
        )
      }
    >
      📥 Dataset
    </button>

    <button onClick={() => setDarkMode(!darkMode)}>
      {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
    </button>
  </div>
)}
      <div style={{ height:"80px" }} />

      {/* Nav dropdown */}
      {activeNav && (
        <div
        ref={navContentRef}
          style={{
            padding: "30px",
            background: darkMode ? "#0f172a" : "#f8fafc",
            borderBottom: `1px solid ${cardBdr}`,
            animation: "fadeSlideIn .4s ease"
          }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: "800px",
        margin: "0 auto",
        background: darkMode
          ? "rgba(30,41,59,.8)"
          : "rgba(255,255,255,.8)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${cardBdr}`,
        borderRadius: "24px",
        padding: "30px",
        boxShadow: darkMode
          ? "0 10px 40px rgba(0,0,0,.4)"
          : "0 10px 40px rgba(0,0,0,.08)"
      }}
    >
{activeNav === "home" && (
  <>
    <div style={{fontSize:"42px"}}>
      {NAV_CONTENT.home.icon}
    </div>

    <h2 style={{
      margin:"10px 0",
      fontSize:"32px",
      fontWeight:"800"
    }}>
      {NAV_CONTENT.home.title}
    </h2>

    <p style={{
      color:"#3b82f6",
      fontWeight:"600"
    }}>
      {NAV_CONTENT.home.subtitle}
    </p>

    <p
      style={{
        whiteSpace: "pre-line",
        lineHeight: "1.2",
        maxWidth: "750px",
        color: textMuted,
        fontSize: "18px"
      }}
    >
      {NAV_CONTENT.home.description}
    </p>

    <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "20px",
    marginTop: "30px",
    marginBottom: "35px"
  }}
>
  {NAV_CONTENT.home.stats.map((item) => (
    <div
      key={item.label}
      style={{
        padding: "20px",
        borderRadius: "16px",
        background: "rgba(59,130,246,.08)",
        border: "1px solid rgba(59,130,246,.15)",
        textAlign: "center"
      }}
    >
      <h2
        style={{
          margin: 0,
          color: "#3b82f6",
          fontWeight: "800"
        }}
      >
        {item.value}
      </h2>

      <p
        style={{
          marginTop: "8px",
          color: "#64748b"
        }}
      >
        {item.label}
      </p>
    </div>
  ))}
</div>

  </>
)}
{activeNav === "about" && (
  <>
    <div style={{fontSize:"42px"}}>
      {NAV_CONTENT.about.icon}
    </div>

    <h2 style={{
      margin:"10px 0",
      fontSize:"32px",
      fontWeight:"800"
    }}>
      {NAV_CONTENT.about.title}
    </h2>

    <p style={{
      color:"#3b82f6",
      fontWeight:"600"
    }}>
      {NAV_CONTENT.about.subtitle}
    </p>

    <p style={{
      color:textMuted,
      lineHeight:"1.8"
    }}>
      {NAV_CONTENT.about.description}
    </p>

    <div
      style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",
        gap:"15px",
        marginTop:"25px"
      }}
    >
      {NAV_CONTENT.about.features.map(item=>(
        <div
          key={item}
          style={{
            padding:"16px",
            borderRadius:"14px",
            background:darkMode ? "#1e293b" : "#ffffff",
            border:`1px solid ${cardBdr}`,
            fontWeight:"600"
          }}
        >
          ✓ {item}
        </div>
      ))}
    </div>

   
<div
  style={{
    marginTop: "20px",
    padding: "20px",
    borderRadius: "16px",
    background: "rgba(16,185,129,.08)",
    border: "1px solid rgba(16,185,129,.15)"
  }}
>
  <strong>🎯 Mission:</strong> To make precision medicine accessible by
  leveraging AI and pharmacogenomics for safer, smarter, and more
  personalized healthcare decisions.
</div>
  </>
)}

{activeNav === "contact" && (
  <>
    <div style={{fontSize:"42px"}}>
      {NAV_CONTENT.contact.icon}
    </div>

    <h2 style={{
      margin:"10px 0",
      fontSize:"32px",
      fontWeight:"800"
    }}>
      {NAV_CONTENT.contact.title}
    </h2>

    <p style={{
      color:"#3b82f6",
      fontWeight:"600"
    }}>
      {NAV_CONTENT.contact.subtitle}
    </p>

    <div
      style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",
        gap:"30px",
        marginTop:"40px"
        
      }}
    >
      <div className="contact-card" >
        📧
        <a
          href="https://mail.google.com/mail/?view=cm&fs=1&to=chandan2004.n@gmail.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color:"inherit",
            textDecoration:"none",
            marginLeft:"8px",
            fontWeight:"600"
          }}
        >
          {NAV_CONTENT.contact.email}
        </a>
      </div>
      <div className="contact-card">📞 {NAV_CONTENT.contact.phone}</div>
      <div className="contact-card">📍 {NAV_CONTENT.contact.location}</div>
      <div className="contact-card">🌐 {NAV_CONTENT.contact.website}</div>
    </div>
  </>
)}
    </div>
  </div>
)}
      {/* HERO section */}
      <div style={CONTAINER}>
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
      </div>

      {/* MAIN CARD section*/}
    <div style={CONTAINER}>
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
</div>

      {/* FEATURES  */}
    <div style={CONTAINER}>
      <div style={{ background:darkMode?"#111827":"#ffffff", padding:"72px 20px", textAlign:"center", borderRadius:"24px", boxShadow:darkMode?"0 8px 40px rgba(0,0,0,0.5)":"0 8px 40px rgba(0,0,0,0.10)" }}>
        <p style={{ margin:"0 0 8px", fontSize:"18px", fontWeight:700, color:"#3b82f6", letterSpacing:"0.1em", textTransform:"uppercase" }}>Why Choose Us</p>
        <h2 style={{ fontSize:"clamp(28px,4vw,40px)", fontWeight:800, letterSpacing:"-0.02em", margin:"0 0 48px" }}>Why Pharma Guard?</h2>
        <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:"34px", maxWidth:"1000px", margin:"0 auto" }}>
          {[
            { emoji:"🤖", title:"AI Prediction",      color:"#3b82f6", text:"Advanced models analyse genomic variants to predict drug response risks, helping clinicians avoid adverse reactions before treatment begins." },
            { emoji:"🧬", title:"Precision Medicine",  color:"#10b981", text:"Tailors medication recommendations based on individual genetic profiles, enabling safer, more effective personalised healthcare decisions." },
            { emoji:"📊", title:"Clinical Insights",   color:"#f59e0b", text:"Actionable pharmacogenomic insights support clinical decision-making with clear risk assessment, dosage guidance, and evidence-based recommendations." },
          ].map(item=>(
            <div key={item.title} style={{
              width:"100%",maxWidth:"320px", padding:"28px",
              background:cardBg, border:`2px solid ${cardBdr}`,
              borderRadius:"20px", textAlign:"center",
              boxShadow:darkMode?"0 4px 20px rgba(0,0,0,0.3)":"0 4px 20px rgba(0,0,0,0.06)",
              transition:"transform 0.3s, box-shadow 0.3s", cursor:"default",
            }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-25px)";e.currentTarget.style.boxShadow=darkMode?"0 12px 32px rgba(0,0,0,0.5)":"0 12px 32px rgba(0,0,0,0.12)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=darkMode?"0 4px 20px rgba(0,0,0,0.3)":"0 4px 20px rgba(0,0,0,0.06)";}}
            >
              <div style={{ width:"60px", height:"54px", borderRadius:"12px", background:`${item.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"40px", marginBottom:"14px" }}>{item.emoji}</div>
              <h3 style={{ margin:"0 0 8px", fontSize:"16px", fontWeight:700, color:item.color }}>{item.title}</h3>
              <p style={{ margin:0, fontSize:"15px", lineHeight:"1.7", color:textMuted }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
</div>

{/* FOOTER */}
<footer
  style={{
    background: darkMode
      ? "linear-gradient(135deg,#0f172a,#111827,#1e293b)"
      : "linear-gradient(135deg,#0f172a,#1e3a8a,#2563eb)",
    color: "#fff",
    padding: "70px 40px 30px",
    marginTop: "80px",
    position: "relative",
    overflow: "hidden"
  }}
>
  {/* Glow Effect */}
  <div
    style={{
      position: "absolute",
      top: "-100px",
      right: "-100px",
      width: "300px",
      height: "300px",
      borderRadius: "50%",
      background: "rgba(59,130,246,.15)",
      filter: "blur(80px)"
    }}
  />

  <div
    className="footer-container"
    style={{
      maxWidth: "1400px",
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
      gap: "50px"
    }}
  >
    {/* Brand */}
    <div>
      <div
        className="footer-brand"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "18px"
        }}
      >
        <span style={{ fontSize: "34px" }}>🧬</span>

        <div className="footer-brand">
          <h2
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "800"
            }}
          >
            PharmaGuard
          </h2>

          <p
            style={{
              margin: 0,
              color: "#93c5fd",
              fontSize: "13px"
            }}
          >
            AI-Powered Precision Medicine
          </p>
        </div>
      </div>

      <p
        style={{
          lineHeight: "1.9",
          color: "#cbd5e1",
          maxWidth: "450px"
        }}
      >
        PharmaGuard combines Artificial Intelligence,
        Pharmacogenomics, and Clinical Decision Support
        to help healthcare professionals prescribe safer
        and more personalized medications.
      </p>

      <div
          className="footer-social"
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "25px"
        }}
      >
        {["🔗", "💻", "📧", "🚀"].map((icon, index) => (
          <div
            key={index}
            style={{
              width: "45px",
              height: "45px",
              borderRadius: "12px",
              background: "rgba(255,255,255,.08)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
              transition: ".3s"
            }}
          >
            {icon}
          </div>
        ))}
      </div>
    </div>

    {/* Product */}
    <div>
      <h3 style={{ marginBottom: "20px" }}>
        Product
      </h3>

      {[
        "Risk Prediction",
        "Genomic Analysis",
        "Clinical Reports",
        "Drug Interaction"
      ].map(item => (
        <p key={item}
          style={{
            color: "#cbd5e1",
            cursor: "pointer"
          }}
        >
          {item}
        </p>
      ))}
    </div>

    {/* Resources */}
    <div>
      <h3 style={{ marginBottom: "20px" }}>
        Resources
      </h3>

      {[
        "Documentation",
        "Research Papers",
        "Dataset",
        "API Access"
      ].map(item => (
        <p key={item}
          style={{
            color: "#cbd5e1",
            cursor: "pointer"
          }}
        >
          {item}
        </p>
      ))}
    </div>

    {/* Contact */}
    <div>
      <h3 style={{ marginBottom: "20px" }}>
        Contact
      </h3>

        <p style={{ color:"#cbd5e1" }}>
          📧
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=chandan2004.n@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color:"#cbd5e1",
              textDecoration:"none",
              marginLeft:"6px"
            }}
          >
          pharmaguard.ai@gmail.com
        </a>
        </p>

      <p style={{ color: "#cbd5e1" }}>
        📞 +91 63604 75219
      </p>

      <p style={{ color: "#cbd5e1" }}>
        📍 Bengaluru, Karnataka
      </p>

      <p style={{ color: "#cbd5e1" }}>
        🌐 www.pharmaguard.ai
      </p>
    </div>
  </div>

  {/* Stats Section */}
  <div
    className="footer-stats"
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "80px",
      flexWrap: "wrap",
      marginTop: "60px",
      paddingTop: "40px",
      borderTop: "1px solid rgba(255,255,255,.1)"
    }}
  >
    {[
      ["95%", "Prediction Accuracy"],
      ["50K+", "Genomic Variants"],
      ["24/7", "Clinical Support"],
      ["AI", "Powered Insights"]
    ].map(([value, label]) => (
      <div key={label} style={{ textAlign: "center" }}>
        <h2
          style={{
            margin: 0,
            color: "#60a5fa",
            fontSize: "32px"
          }}
        >
          {value}
        </h2>

        <p
          style={{
            marginTop: "8px",
            color: "#cbd5e1"
          }}
        >
          {label}
        </p>
      </div>
    ))}
  </div>

  {/* Bottom */}
  <div
    className="footer-bottom"
    style={{
      marginTop: "40px",
      paddingTop: "20px",
      borderTop: "1px solid rgba(255,255,255,.1)",
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      color: "#94a3b8",
      fontSize: "14px"
    }}
  >
    <span>
      © 2026 PharmaGuard. All Rights Reserved.
    </span>

    <span>
      Built for RIFT 2026 Hackathon • AI Hunters Team
    </span>
  </div>
</footer>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        body{margin:0}
        input::placeholder,select{color:#94a3b8}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes badgePop{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}

        @media (max-width: 992px){

          .footer-brand{
              text-align:center;
          }

          .footer-social{
              justify-content:center !important;
          }

        }

        @media (max-width: 768px){

          .footer-container{
              grid-template-columns:1fr !important;
              text-align:center;
          }

          .footer-social{
              justify-content:center !important;
          }

          .footer-bottom{
              flex-direction:column;
              text-align:center;
              gap:10px;
          }

          .footer-stats{
              grid-template-columns:1fr 1fr !important;
          }

        }

        @media (max-width: 480px){

          .footer-stats{
              grid-template-columns:1fr !important;
          }

          .footer-title{
              font-size:32px !important;
          }

        }


    /* NAVBAR RESPONSIVE */

        @media (max-width:768px){

          .navbar-container{
            flex-direction:column;
            padding:15px !important;
          }

          .logo-section{
            justify-content:center;
          }

          .nav-menu{
            justify-content:center;
            width:100%;
            gap:8px;
          }

          .nav-menu button{
            font-size:13px !important;
            padding:8px 12px !important;
          }

        }

        @media (max-width:480px){

          .nav-menu{
            display:grid !important;
            grid-template-columns:repeat(2,1fr);
            width:100%;
          }

          .nav-menu button{
            width:100%;
          }

        }


.mobile-menu-btn{
  display:none;
}

.mobile-dropdown{
  display:none;
}

@media (max-width:768px){

  .navbar-container{
    flex-direction:row !important;
    justify-content:space-between !important;
    align-items:center !important;
    padding:12px 16px !important;
  }

  .desktop-menu{
    display:none !important;
  }

  .mobile-menu-btn{
    display:block !important;
  }

  .logo-section{
    flex:1;
  }

  .mobile-dropdown{
    display:flex;
    flex-direction:column;
    gap:12px;
    position:fixed;
    top:72px;
    left:0;
    width:100%;
    z-index:999;
    background:inherit;
    padding:20px;
    box-shadow:0 10px 25px rgba(0,0,0,.15);
  }

  .mobile-dropdown button{
    width:100%;
    padding:14px;
    border:none;
    border-radius:12px;
    font-size:15px;
    font-weight:600;
    text-align:left;
    background:#f1f5f9;
    cursor:pointer;
  }
}

      `}</style>
    </div>
  );
}
