import { jsPDF } from "jspdf";
import { calculateAegisScore, buildRemediationOptions } from "./aegisScore";
import { REPORT_TEMPLATES } from "./reportTemplates";
import { fetchAllUserSubjects, detectOverlaps } from "./crosswire";

function stripMarkdown(md) {
  if (!md) return "";
  return md.replace(/#{1,6}\s+/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/^[-*]\s+/gm, "- ").replace(/\n{3,}/g, "\n\n").trim();
}

function wrapText(doc, text, maxWidth) {
  if (!text) return [];
  return doc.splitTextToSize(text, maxWidth);
}

function drawHeader(doc, title, pageNum) {
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("SENTRACT INTELLIGENCE REPORT", 20, 15);
  doc.text(`Page ${pageNum}`, 190, 15, { align: "right" });
  doc.setDrawColor(40);
  doc.line(20, 18, 190, 18);
}

function drawCover(doc, subject, caseData, now) {
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(0, 212, 170);
  doc.rect(20, 60, 4, 40, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(255);
  doc.text("SENTRACT", 30, 78);
  doc.setFontSize(12);
  doc.setTextColor(0, 212, 170);
  doc.text("INTELLIGENCE REPORT", 30, 88);
  doc.setFontSize(14);
  doc.setTextColor(255);
  doc.text(subject?.name || "Unknown Subject", 30, 110);
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Case: ${caseData?.name || "Untitled"}`, 30, 120);
  doc.text(`Type: ${caseData?.type || "Unknown"}`, 30, 128);
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 30, 136);
  doc.text("Classification: CONFIDENTIAL", 30, 144);
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("This document contains sensitive intelligence data.", 30, 260);
  doc.text("Handle in accordance with organizational security policies.", 30, 266);
}

function buildKeyExposures(profileData) {
  if (!profileData) return [];
  const exposures = [];
  const socials = profileData.digital?.social_accounts || [];
  for (const acct of socials) {
    if (acct.visibility === "public" && acct.followers && acct.followers > 1000) {
      exposures.push({ text: `Public ${acct.platform || "social"} account with ${acct.followers.toLocaleString()} followers`, severity: "red" });
    } else if (acct.visibility === "public" && acct.platform) {
      exposures.push({ text: `Public ${acct.platform} profile discoverable via OSINT`, severity: "amber" });
    }
  }
  const brokers = profileData.digital?.data_broker_listings || [];
  const activeBrokers = brokers.filter((b) => b.status === "active");
  if (activeBrokers.length > 0) exposures.push({ text: `${activeBrokers.length} active data broker listing${activeBrokers.length > 1 ? "s" : ""} exposing PII`, severity: "red" });
  const breaches = profileData.breaches?.records || [];
  const highBreaches = breaches.filter((b) => b.severity === "high" || b.severity === "critical");
  if (highBreaches.length > 0) exposures.push({ text: `${highBreaches.length} high-severity breach${highBreaches.length > 1 ? "es" : ""}`, severity: "red" });
  else if (breaches.length > 0) exposures.push({ text: `${breaches.length} breach record${breaches.length > 1 ? "s" : ""} on file`, severity: "amber" });
  const routines = profileData.behavioral?.routines || [];
  const predictable = routines.filter((r) => r.consistency != null && (r.consistency > 0.8 || r.consistency > 80));
  if (predictable.length > 0) exposures.push({ text: `${predictable.length} highly predictable routine${predictable.length > 1 ? "s" : ""}`, severity: "amber" });
  const observations = profileData.behavioral?.observations || [];
  const highObs = observations.filter((o) => o.exploitability === "high");
  if (highObs.length > 0) exposures.push({ text: `${highObs.length} high-exploitability observation${highObs.length > 1 ? "s" : ""}`, severity: "red" });
  const family = profileData.network?.family_members || [];
  const familyWithSocial = family.filter((f) => f.social_media && f.social_media.length > 0);
  if (familyWithSocial.length > 0) exposures.push({ text: `${familyWithSocial.length} family member${familyWithSocial.length > 1 ? "s" : ""} with exposed social media`, severity: "red" });
  return exposures;
}

export async function generateReportV2({ subject, caseData, profileData, supabase, template = "full" }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const contentWidth = 170;
  const aegis = calculateAegisScore(profileData);
  const exposures = buildKeyExposures(profileData);
  const now = new Date();
  const pages = REPORT_TEMPLATES[template]?.pages || REPORT_TEMPLATES.full.pages;

  let pageNum = 0;

  // ── COVER ──
  if (pages.includes("cover")) {
    drawCover(doc, subject, caseData, now);
    pageNum++;
  }

  // ── EXECUTIVE SUMMARY ──
  if (pages.includes("executive_summary")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Executive Summary", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Executive Summary", margin, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 212, 170);
    doc.text("AEGIS COMPOSITE SCORE", margin, y);
    y += 8;
    doc.setFontSize(28);
    doc.setTextColor(255);
    doc.text(`${aegis.composite}`, margin, y);
    doc.setFontSize(11);
    const riskColors = { CRITICAL: [239, 68, 68], HIGH: [245, 158, 11], MODERATE: [59, 130, 246], LOW: [16, 185, 129] };
    const rc = riskColors[aegis.riskLevel] || [150, 150, 150];
    doc.setTextColor(rc[0], rc[1], rc[2]);
    doc.text(`  ${aegis.riskLevel}`, margin + 20, y);
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Factor Breakdown:", margin, y);
    y += 6;
    for (const [, factor] of Object.entries(aegis.factors)) {
      doc.setTextColor(200);
      doc.setFont("helvetica", "normal");
      doc.text(`${factor.label} (${factor.weight}%): ${factor.score}/100`, margin + 4, y);
      y += 5;
    }
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 212, 170);
    doc.text("KEY EXPOSURES", margin, y);
    y += 8;
    if (exposures.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("No significant exposures identified.", margin + 4, y);
    } else {
      const sevColors = { red: [239, 68, 68], amber: [245, 158, 11], blue: [59, 130, 246] };
      for (const exp of exposures.slice(0, 10)) {
        const sc = sevColors[exp.severity] || [150, 150, 150];
        doc.setFillColor(sc[0], sc[1], sc[2]);
        doc.circle(margin + 2, y - 1.2, 1.5, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(200);
        doc.text(exp.text, margin + 8, y);
        y += 6;
        if (y > 270) break;
      }
    }
  }

  // ── SUBJECT OVERVIEW ──
  if (pages.includes("subject_overview")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Subject Overview", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Subject Overview", margin, y);
    y += 14;
    const id = profileData?.identity || {};
    const pro = profileData?.professional || {};
    const fields = [
      ["Full Name", id.full_name],
      ["Aliases", (id.aliases || []).join(", ")],
      ["DOB", id.date_of_birth],
      ["Age", id.age],
      ["Nationality", id.nationality],
      ["Title", pro.title],
      ["Organization", pro.organization],
      ["Industry", pro.industry],
    ];
    for (const [label, val] of fields) {
      if (!val) continue;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 212, 170);
      doc.text(label + ":", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200);
      doc.text(String(val), margin + 40, y);
      y += 6;
    }
    y += 6;
    const contacts = [];
    (profileData?.contact?.phone_numbers || []).forEach((p) => contacts.push(`Phone (${p.type}): ${p.number}`));
    (profileData?.contact?.email_addresses || []).forEach((e) => contacts.push(`Email (${e.type}): ${e.address}`));
    if (contacts.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 212, 170);
      doc.text("CONTACT", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(200);
      for (const c of contacts) {
        doc.text(`- ${c}`, margin + 4, y);
        y += 5;
      }
    }
  }

  // ── DIGITAL EXPOSURE ──
  if (pages.includes("digital_exposure")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Digital Exposure", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Digital Exposure", margin, y);
    y += 14;
    const socials = profileData?.digital?.social_accounts || [];
    if (socials.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 212, 170);
      doc.text("SOCIAL ACCOUNTS", margin, y);
      y += 7;
      for (const s of socials) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(200);
        doc.text(`- ${s.platform}: ${s.handle || s.url || "N/A"} (${s.visibility || "unknown"})`, margin + 4, y);
        y += 5;
        if (y > 270) break;
      }
      y += 4;
    }
    const breaches = profileData?.breaches?.records || [];
    if (breaches.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 212, 170);
      doc.text("BREACH RECORDS", margin, y);
      y += 7;
      for (const b of breaches) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(200);
        doc.text(`- ${b.breach_name || "Unknown"}: ${(b.data_types || []).join(", ")} [${b.severity || "unknown"}]`, margin + 4, y);
        y += 5;
        if (y > 270) break;
      }
    }
  }

  // ── BEHAVIORAL ANALYSIS ──
  if (pages.includes("behavioral_analysis")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Behavioral Analysis", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Behavioral Analysis", margin, y);
    y += 14;
    const routines = profileData?.behavioral?.routines || [];
    if (routines.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 212, 170);
      doc.text("ROUTINES", margin, y);
      y += 7;
      for (const r of routines) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(200);
        const consistency = r.consistency != null ? Math.round(r.consistency * (r.consistency <= 1 ? 100 : 1)) + "%" : "unknown";
        doc.text(`- ${r.name || "Unnamed"}: ${r.schedule || "no schedule"} (${consistency} consistency)`, margin + 4, y);
        y += 5;
        if (y > 270) break;
      }
      y += 4;
    }
    const observations = profileData?.behavioral?.observations || [];
    if (observations.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 212, 170);
      doc.text("OBSERVATIONS", margin, y);
      y += 7;
      for (const o of observations) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const expColor = o.exploitability === "high" ? [239, 68, 68] : o.exploitability === "medium" ? [245, 158, 11] : [150, 150, 150];
        doc.setTextColor(expColor[0], expColor[1], expColor[2]);
        doc.text(`[${(o.exploitability || "unknown").toUpperCase()}]`, margin + 4, y);
        doc.setTextColor(200);
        doc.text(o.description || "", margin + 24, y);
        y += 5;
        if (y > 270) break;
      }
    }
  }

  // ── AEGIS DETAIL ──
  if (pages.includes("aegis_detail")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Aegis Score Detail", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Aegis Score Detail", margin, y);
    y += 14;
    doc.setFillColor(20, 20, 20);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 212, 170);
    doc.text("FACTOR", margin + 4, y);
    doc.text("SCORE", margin + 90, y);
    doc.text("WEIGHT", margin + 115, y);
    doc.text("WEIGHTED", margin + 140, y);
    y += 8;
    for (const [, factor] of Object.entries(aegis.factors)) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(200);
      doc.text(factor.label, margin + 4, y);
      doc.text(`${factor.score}`, margin + 90, y);
      doc.text(`${factor.weight}%`, margin + 115, y);
      doc.text(`${Math.round(factor.score * factor.weight / 100)}`, margin + 140, y);
      doc.setDrawColor(30);
      doc.line(margin, y + 2, margin + contentWidth, y + 2);
      y += 8;
    }
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 212, 170);
    doc.text("RISK DRIVERS", margin, y);
    y += 8;
    for (const driver of aegis.drivers) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(200);
      doc.text(`- ${driver.text}`, margin + 4, y);
      doc.setTextColor(100);
      doc.text(`(impact: ${driver.impact})`, margin + 130, y);
      y += 6;
      if (y > 270) break;
    }
  }

  // ── RECON MIRROR ──
  if (pages.includes("recon_mirror")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Recon Mirror", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Recon Mirror Assessment", margin, y);
    y += 12;
    let reconAssessment = null;
    if (subject?.id) {
      const { data } = await supabase.from("assessments").select("*").eq("subject_id", subject.id).eq("module", "recon_mirror").order("created_at", { ascending: false }).limit(1);
      if (data && data.length > 0) reconAssessment = data[0];
    }
    if (reconAssessment) {
      const narrative = reconAssessment.narrative_output || reconAssessment.score_data?.narrative_output || "";
      if (narrative) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(180);
        const lines = wrapText(doc, stripMarkdown(narrative), contentWidth);
        for (const line of lines) {
          if (y > 275) break;
          doc.text(line, margin, y);
          y += 4;
        }
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("No Recon Mirror assessment has been generated for this subject.", margin, y);
    }
  }

  // ── RECOMMENDATIONS ──
  if (pages.includes("recommendations")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Recommendations", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Remediation Recommendations", margin, y);
    y += 14;
    const options = buildRemediationOptions(profileData);
    if (options.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("No remediation actions identified. Add more profile data to generate recommendations.", margin, y);
    } else {
      for (let i = 0; i < Math.min(options.length, 15); i++) {
        const opt = options[i];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 212, 170);
        doc.text(`${i + 1}. ${opt.label}`, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150);
        const descLines = wrapText(doc, opt.description, contentWidth - 10);
        for (const line of descLines) {
          doc.text(line, margin + 6, y);
          y += 4;
        }
        doc.setTextColor(100);
        doc.text(`Score reduction: -${opt.scoreReduction}`, margin + 6, y);
        y += 7;
        if (y > 265) break;
      }
    }
  }

  // ── PATTERN ANALYSIS ──
  if (pages.includes("pattern_analysis")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Pattern Analysis", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Behavioral Pattern Analysis", margin, y);
    y += 12;
    let patternNarrative = null;
    if (subject?.id) {
      const { data } = await supabase.from("assessments").select("narrative_output").eq("subject_id", subject.id).eq("module", "pattern_lens").order("created_at", { ascending: false }).limit(1);
      if (data && data.length > 0) patternNarrative = data[0].narrative_output;
    }
    if (patternNarrative) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(180);
      const lines = wrapText(doc, stripMarkdown(patternNarrative), contentWidth);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); pageNum++; drawHeader(doc, "Pattern Analysis", pageNum); y = 28; }
        doc.text(line, margin, y);
        y += 4;
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("No Pattern Lens assessment has been generated for this subject.", margin, y);
    }
  }

  // ── CROSSWIRE SUMMARY ──
  if (pages.includes("crosswire_summary")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "CrossWire Summary", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Cross-Case Connection Analysis", margin, y);
    y += 14;
    let overlaps = [];
    try {
      const allSubs = await fetchAllUserSubjects();
      if (subject && allSubs.length > 1) {
        overlaps = detectOverlaps(subject, allSubs);
      }
    } catch {}
    if (overlaps.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("No cross-case overlaps detected.", margin, y);
    } else {
      const highPriority = overlaps.some((o) => o.matchCount >= 3 || o.matches.some((m) => m.type === "phone" || m.type === "email" || m.type === "direct_link"));
      if (highPriority) {
        doc.setFillColor(239, 68, 68);
        doc.rect(margin, y - 4, contentWidth, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255);
        doc.text("HIGH-PRIORITY MATCHES DETECTED", margin + 4, y + 2);
        y += 14;
      }
      // Table header
      doc.setFillColor(20, 20, 20);
      doc.rect(margin, y - 4, contentWidth, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 212, 170);
      doc.text("SUBJECT", margin + 4, y);
      doc.text("CASE", margin + 60, y);
      doc.text("MATCHES", margin + 115, y);
      doc.text("TYPES", margin + 138, y);
      y += 8;
      for (const o of overlaps) {
        if (y > 270) break;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(200);
        doc.text((o.subject.name || "Unknown").slice(0, 25), margin + 4, y);
        doc.text((o.caseName || "").slice(0, 25), margin + 60, y);
        doc.text(String(o.matchCount), margin + 115, y);
        const types = [...new Set(o.matches.map((m) => m.type))].join(", ");
        doc.text(types.slice(0, 30), margin + 138, y);
        doc.setDrawColor(30);
        doc.line(margin, y + 2, margin + contentWidth, y + 2);
        y += 7;
      }
    }
  }

  // ── METHODOLOGY ──
  if (pages.includes("methodology")) {
    doc.addPage();
    pageNum++;
    drawHeader(doc, "Methodology", pageNum);
    let y = 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text("Methodology & Disclaimer", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180);
    const methodText = "The Aegis Exposure Score is a composite metric calculated from five weighted factors that assess an individual's vulnerability surface across digital, physical, behavioral, and network dimensions.\n\nEach factor is scored from 0-100 based on quantifiable indicators derived from open-source intelligence (OSINT) data, breach databases, behavioral pattern analysis, and network mapping.\n\nFactor Weights:\n- Digital Footprint (25%)\n- Breach Exposure (20%)\n- Behavioral Predictability (25%)\n- Physical OPSEC (15%)\n- Network Exposure (15%)";
    const lines = wrapText(doc, methodText, contentWidth);
    for (const line of lines) {
      if (y > 220) break;
      doc.text(line, margin, y);
      y += 4;
    }
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 212, 170);
    doc.text("DISCLAIMER", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180);
    const disclaimerLines = wrapText(doc, "This report is generated for authorized intelligence and security assessment purposes only. Distribution should be limited to authorized personnel. Generated by Sentract Intelligence Platform.", contentWidth);
    for (const line of disclaimerLines) {
      doc.text(line, margin, y);
      y += 4;
    }
  }

  const filename = `Sentract_${(subject?.name || "Report").replace(/\s+/g, "_")}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
