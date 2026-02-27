import { jsPDF } from "jspdf";
import { calculateAegisScore } from "./aegisScore";

// Strip markdown to plain text
function stripMarkdown(md) {
  if (!md) return "";
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Wrap text to fit width, return array of lines
function wrapText(doc, text, maxWidth) {
  if (!text) return [];
  return doc.splitTextToSize(text, maxWidth);
}

// Draw page header
function drawHeader(doc, title, pageNum, totalPages) {
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("SENTRACT INTELLIGENCE REPORT", 20, 15);
  doc.text(`${pageNum} / ${totalPages}`, 190, 15, { align: "right" });
  doc.setDrawColor(40);
  doc.line(20, 18, 190, 18);
}

export async function generateReport({ subject, caseData, profileData, supabase }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210; // page width
  const margin = 20;
  const contentWidth = pw - margin * 2;

  // Compute scores
  const aegis = calculateAegisScore(profileData);

  // Compute key exposures (inline version of generateKeyExposures from Profile.jsx)
  const exposures = buildKeyExposures(profileData);

  // Fetch latest recon mirror assessment
  let reconAssessment = null;
  if (subject?.id) {
    const { data } = await supabase
      .from("assessments")
      .select("*")
      .eq("subject_id", subject.id)
      .eq("module", "recon_mirror")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) reconAssessment = data[0];
  }

  const totalPages = 5;
  const now = new Date();

  // ── PAGE 1: Cover ──
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pw, 297, "F");

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
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 30, 128);
  doc.text(`Classification: CONFIDENTIAL`, 30, 136);

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("This document contains sensitive intelligence data.", 30, 260);
  doc.text("Handle in accordance with organizational security policies.", 30, 266);

  // ── PAGE 2: Executive Summary ──
  doc.addPage();
  drawHeader(doc, "Executive Summary", 2, totalPages);

  let y = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255);
  doc.text("Executive Summary", margin, y);
  y += 12;

  // Aegis composite
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

  // Factor breakdown
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Factor Breakdown:", margin, y);
  y += 6;

  for (const [key, factor] of Object.entries(aegis.factors)) {
    doc.setTextColor(200);
    doc.setFont("helvetica", "normal");
    doc.text(`${factor.label} (${factor.weight}%): ${factor.score}/100`, margin + 4, y);
    y += 5;
  }
  y += 8;

  // Key Exposures
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
    for (const exp of exposures) {
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

  // ── PAGE 3: Recon Mirror Assessment ──
  doc.addPage();
  drawHeader(doc, "Recon Mirror", 3, totalPages);

  y = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255);
  doc.text("Recon Mirror Assessment", margin, y);
  y += 12;

  if (reconAssessment) {
    const params = reconAssessment.parameters || reconAssessment.score_data?.parameters || {};
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 212, 170);
    doc.text("PARAMETERS", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200);
    if (params.adversaryType) { doc.text(`Adversary Type: ${params.adversaryType}`, margin + 4, y); y += 5; }
    if (params.objective) { doc.text(`Objective: ${params.objective}`, margin + 4, y); y += 5; }
    if (params.sophistication) { doc.text(`Sophistication: ${params.sophistication}`, margin + 4, y); y += 5; }
    y += 6;

    const narrative = reconAssessment.narrative_output || reconAssessment.score_data?.narrative_output || "";
    if (narrative) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 212, 170);
      doc.text("NARRATIVE", margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(180);
      const plainNarrative = stripMarkdown(narrative);
      const lines = wrapText(doc, plainNarrative, contentWidth);
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

  // ── PAGE 4: Aegis Score Detail ──
  doc.addPage();
  drawHeader(doc, "Aegis Score Detail", 4, totalPages);

  y = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255);
  doc.text("Aegis Score Detail", margin, y);
  y += 14;

  // Factor table header
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

  for (const [key, factor] of Object.entries(aegis.factors)) {
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

  // Risk drivers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 212, 170);
  doc.text("RISK DRIVERS", margin, y);
  y += 8;

  if (aegis.drivers.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("No significant risk drivers identified.", margin + 4, y);
  } else {
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

  // ── PAGE 5: Methodology & Disclaimer ──
  doc.addPage();
  drawHeader(doc, "Methodology", 5, totalPages);

  y = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255);
  doc.text("Methodology & Disclaimer", margin, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 212, 170);
  doc.text("SCORING METHODOLOGY", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180);

  const methodText = `The Aegis Exposure Score is a composite metric calculated from five weighted factors that assess an individual's vulnerability surface across digital, physical, behavioral, and network dimensions.

Each factor is scored from 0-100 based on quantifiable indicators derived from open-source intelligence (OSINT) data, breach databases, behavioral pattern analysis, and network mapping.

Factor Weights:
- Digital Footprint (25%): Social media visibility, data broker listings, online presence
- Breach Exposure (20%): Known data breaches, credential exposure, severity assessment
- Behavioral Predictability (25%): Routine consistency, GPS tracking exposure, pattern regularity
- Physical OPSEC (15%): Address confirmation, property records, physical security posture
- Network Exposure (15%): Family member visibility, associate connections, social graph analysis

The composite score is a weighted average of all factors, classified into risk levels: LOW (0-34), MODERATE (35-54), HIGH (55-74), CRITICAL (75-100).

Recon Mirror assessments simulate adversary reconnaissance approaches based on configurable threat parameters including adversary type, objective, and sophistication level.`;

  const methodLines = wrapText(doc, methodText, contentWidth);
  for (const line of methodLines) {
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

  const disclaimerText = `This report is generated for authorized intelligence and security assessment purposes only. The information contained herein is derived from open-source intelligence gathering, proprietary analysis algorithms, and user-provided data.

This report does not constitute legal advice and should not be used as the sole basis for security decisions. All data should be independently verified before action is taken. The accuracy of scoring depends on the completeness and quality of input data.

Distribution of this report should be limited to authorized personnel with a legitimate need-to-know. Unauthorized disclosure may compromise ongoing intelligence operations and subject privacy.

Generated by Sentract Intelligence Platform.`;

  const disclaimerLines = wrapText(doc, disclaimerText, contentWidth);
  for (const line of disclaimerLines) {
    if (y > 280) break;
    doc.text(line, margin, y);
    y += 4;
  }

  // Save
  const filename = `Sentract_${(subject?.name || "Report").replace(/\s+/g, "_")}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

// Inline key exposures generator (mirrors Profile.jsx logic)
function buildKeyExposures(profileData) {
  if (!profileData) return [];
  const exposures = [];

  const socials = profileData.digital?.social_accounts || [];
  for (const acct of socials) {
    if (acct.visibility === "public" && acct.followers && acct.followers > 1000) {
      exposures.push({ text: `Public ${acct.platform || "social"} account with ${acct.followers.toLocaleString()} followers`, severity: "red", category: "digital" });
    } else if (acct.visibility === "public" && acct.platform) {
      exposures.push({ text: `Public ${acct.platform} profile discoverable via OSINT`, severity: "amber", category: "digital" });
    }
  }

  const brokers = profileData.digital?.data_broker_listings || [];
  const activeBrokers = brokers.filter((b) => b.status === "active");
  if (activeBrokers.length > 0) {
    exposures.push({ text: `${activeBrokers.length} active data broker listing${activeBrokers.length > 1 ? "s" : ""} exposing PII`, severity: "red", category: "digital" });
  }

  const breaches = profileData.breaches?.records || [];
  const highBreaches = breaches.filter((b) => b.severity === "high" || b.severity === "critical");
  if (highBreaches.length > 0) {
    exposures.push({ text: `${highBreaches.length} high-severity breach${highBreaches.length > 1 ? "es" : ""}`, severity: "red", category: "breaches" });
  } else if (breaches.length > 0) {
    exposures.push({ text: `${breaches.length} breach record${breaches.length > 1 ? "s" : ""} on file`, severity: "amber", category: "breaches" });
  }

  const routines = profileData.behavioral?.routines || [];
  const predictable = routines.filter((r) => r.consistency != null && (r.consistency > 0.8 || r.consistency > 80));
  if (predictable.length > 0) {
    exposures.push({ text: `${predictable.length} highly predictable routine${predictable.length > 1 ? "s" : ""}`, severity: "amber", category: "behavioral" });
  }

  const family = profileData.network?.family_members || [];
  if (family.length > 0) {
    const withSocial = family.filter((f) => f.social_media && f.social_media.length > 0);
    if (withSocial.length > 0) {
      exposures.push({ text: `${withSocial.length} family member${withSocial.length > 1 ? "s" : ""} with exposed social media`, severity: "red", category: "network" });
    } else {
      exposures.push({ text: `${family.length} family member${family.length > 1 ? "s" : ""} identified`, severity: "blue", category: "network" });
    }
  }

  return exposures;
}
