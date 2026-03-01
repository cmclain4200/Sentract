import { jsPDF } from 'jspdf';
import { calculateAegisScore, buildRemediationOptions } from './aegisScore';
import { REPORT_TEMPLATES } from './reportTemplates';
import { fetchAllUserSubjects, detectOverlaps } from './crosswire';
import {
  COLORS, FONT, LAYOUT,
  getRiskColor, getSeverityColor, scoreColor,
  stripMarkdown, wrapText,
  drawPageBackground, drawHeader, drawSectionTitle,
  drawTable, drawBadge, drawProgressBar, drawGaugeRing,
  drawCard, checkPageBreak,
} from './pdfStyles';

const M = LAYOUT.margin;
const CW = LAYOUT.contentWidth;

function headerOpts(title, subject, caseData) {
  return { title, classification: 'CONFIDENTIAL', subjectName: subject?.name, caseName: caseData?.name };
}

function buildKeyExposures(profileData) {
  if (!profileData) return [];
  const exposures = [];
  const socials = profileData.digital?.social_accounts || [];
  for (const acct of socials) {
    if (acct.visibility === 'public' && acct.followers && acct.followers > 1000) {
      exposures.push({ text: `Public ${acct.platform || 'social'} account with ${acct.followers.toLocaleString()} followers`, severity: 'red' });
    } else if (acct.visibility === 'public' && acct.platform) {
      exposures.push({ text: `Public ${acct.platform} profile discoverable via OSINT`, severity: 'amber' });
    }
  }
  const brokers = profileData.digital?.data_broker_listings || [];
  const activeBrokers = brokers.filter((b) => b.status === 'active');
  if (activeBrokers.length > 0) exposures.push({ text: `${activeBrokers.length} active data broker listing${activeBrokers.length > 1 ? 's' : ''} exposing PII`, severity: 'red' });
  const breaches = profileData.breaches?.records || [];
  const highBreaches = breaches.filter((b) => b.severity === 'high' || b.severity === 'critical');
  if (highBreaches.length > 0) exposures.push({ text: `${highBreaches.length} high-severity breach${highBreaches.length > 1 ? 'es' : ''}`, severity: 'red' });
  else if (breaches.length > 0) exposures.push({ text: `${breaches.length} breach record${breaches.length > 1 ? 's' : ''} on file`, severity: 'amber' });
  const routines = profileData.behavioral?.routines || [];
  const predictable = routines.filter((r) => r.consistency != null && (r.consistency > 0.8 || r.consistency > 80));
  if (predictable.length > 0) exposures.push({ text: `${predictable.length} highly predictable routine${predictable.length > 1 ? 's' : ''}`, severity: 'amber' });
  const observations = profileData.behavioral?.observations || [];
  const highObs = observations.filter((o) => o.exploitability === 'high');
  if (highObs.length > 0) exposures.push({ text: `${highObs.length} high-exploitability observation${highObs.length > 1 ? 's' : ''}`, severity: 'red' });
  const family = profileData.network?.family_members || [];
  const familyWithSocial = family.filter((f) => f.social_media && f.social_media.length > 0);
  if (familyWithSocial.length > 0) exposures.push({ text: `${familyWithSocial.length} family member${familyWithSocial.length > 1 ? 's' : ''} with exposed social media`, severity: 'red' });
  return exposures;
}

// ── COVER PAGE ──

function drawCover(doc, subject, caseData, now, template) {
  drawPageBackground(doc);

  // Teal accent bar
  doc.setFillColor(...COLORS.accent);
  doc.rect(M, 55, 2, 50, 'F');

  // SENTRACT wordmark with letter-spacing
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...COLORS.textPrimary);
  const wordmark = 'SENTRACT';
  let wx = M + 8;
  for (const ch of wordmark) {
    doc.text(ch, wx, 78);
    wx += doc.getTextWidth(ch) + 2.2;
  }

  // Report type subtitle
  const subtitle = REPORT_TEMPLATES[template]?.subtitle || 'INTELLIGENCE REPORT';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.accent);
  doc.text(subtitle, M + 8, 88);

  // Horizontal accent line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(M + 8, 94, 140, 94);

  // Subject name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(subject?.name || 'Unknown Subject', M + 8, 110);

  // 2-column metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const metaY = 122;
  const col1X = M + 8;
  const col2X = M + 80;

  doc.setTextColor(...COLORS.textDim);
  doc.text('Case', col1X, metaY);
  doc.text('Type', col2X, metaY);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text(caseData?.name || 'Untitled', col1X, metaY + 6);
  doc.text(caseData?.type || 'Unknown', col2X, metaY + 6);

  doc.setTextColor(...COLORS.textDim);
  doc.text('Generated', col1X, metaY + 16);
  doc.text('Classification', col2X, metaY + 16);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, col1X, metaY + 22);

  // CONFIDENTIAL badge
  doc.setFillColor(...COLORS.confidential);
  doc.roundedRect(col2X, metaY + 17, 32, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CONFIDENTIAL', col2X + 3, metaY + 22);

  // Footer disclaimer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDim);
  doc.text('This document contains sensitive intelligence data.', M + 8, 256);
  doc.text('Handle in accordance with organizational security policies.', M + 8, 261);
  doc.text('Generated by Sentract Intelligence Platform.', M + 8, 266);
}

// ── EXECUTIVE SUMMARY ──

function drawExecutiveSummary(doc, aegis, exposures, pageNum, subject, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Executive Summary', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Executive Summary', M, y);
  y += 12;

  // Gauge ring for composite score
  const gaugeX = M + 22;
  const gaugeY = y + 18;
  const riskCol = getRiskColor(aegis.riskLevel);
  drawGaugeRing(doc, { cx: gaugeX, cy: gaugeY, radius: 16, lineWidth: 3, value: aegis.composite, max: 100, color: riskCol });

  // Risk level label below gauge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(riskCol[0], riskCol[1], riskCol[2]);
  doc.text(aegis.riskLevel, gaugeX, gaugeY + 24, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDim);
  doc.text('AEGIS COMPOSITE', gaugeX, gaugeY + 30, { align: 'center' });

  // Factor bars (right of gauge)
  const barX = M + 55;
  const barW = 60;
  let barY = y + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDim);
  doc.text('FACTOR BREAKDOWN', barX, barY);
  barY += 7;

  for (const [, factor] of Object.entries(aegis.factors)) {
    const fc = scoreColor(factor.score);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.text(factor.label, barX, barY);

    // Progress bar
    drawProgressBar(doc, { x: barX + 45, y: barY - 3, w: barW, h: 3.5, value: factor.score, max: 100, color: fc });

    // Score text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(fc[0], fc[1], fc[2]);
    doc.text(`${factor.score}`, barX + 45 + barW + 3, barY);

    // Weight
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.textDim);
    doc.text(`${factor.weight}%`, barX + 45 + barW + 14, barY);

    barY += 9;
  }

  y = Math.max(gaugeY + 36, barY) + 6;

  // Key Exposures
  y = drawSectionTitle(doc, 'Key Exposures', y);

  if (exposures.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.body.size);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('No significant exposures identified.', M + 5, y);
  } else {
    for (const exp of exposures.slice(0, 10)) {
      if (y > 268) break;
      const sc = getSeverityColor(exp.severity);
      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.circle(M + 3, y - 1, 1.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT.body.size);
      doc.setTextColor(...COLORS.textSecondary);
      doc.text(exp.text, M + 8, y);
      y += 6;
    }
  }
}

// ── SUBJECT OVERVIEW ──

function drawSubjectOverview(doc, profileData, pageNum, subject, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Subject Overview', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Subject Overview', M, y);
  y += 12;

  const id = profileData?.identity || {};
  const pro = profileData?.professional || {};
  const contact = profileData?.contact || {};

  // Identity card
  const cardW = 80;
  const cardGap = 10;

  // Card 1: Identity
  drawCard(doc, { x: M, y, w: cardW, h: 52 });
  let cy = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.accent);
  doc.text('IDENTITY', M + 4, cy);
  cy += 7;

  const idFields = [
    ['Name', id.full_name],
    ['Aliases', (id.aliases || []).join(', ')],
    ['DOB', id.date_of_birth],
    ['Age', id.age],
    ['Nationality', id.nationality],
  ];
  for (const [label, val] of idFields) {
    if (!val) continue;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    doc.text(label, M + 4, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.text(String(val), M + 28, cy);
    cy += 6;
  }

  // Card 2: Professional
  const card2X = M + cardW + cardGap;
  drawCard(doc, { x: card2X, y, w: cardW, h: 52 });
  cy = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.accent);
  doc.text('PROFESSIONAL', card2X + 4, cy);
  cy += 7;

  const proFields = [
    ['Title', pro.title],
    ['Org', pro.organization],
    ['Industry', pro.industry],
  ];
  for (const [label, val] of proFields) {
    if (!val) continue;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    doc.text(label, card2X + 4, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.text(String(val), card2X + 28, cy);
    cy += 6;
  }

  y += 58;

  // Contact section
  const phones = contact.phone_numbers || [];
  const emails = contact.email_addresses || [];
  if (phones.length > 0 || emails.length > 0) {
    drawCard(doc, { x: M, y, w: CW, h: 6 + (phones.length + emails.length) * 6 + 4 });
    cy = y + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.accent);
    doc.text('CONTACT', M + 4, cy);
    cy += 7;

    for (const p of phones) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textSecondary);
      doc.text(p.number || '', M + 4, cy);
      if (p.type) drawBadge(doc, { text: p.type, x: M + 50, y: cy - 3, color: COLORS.accent });
      cy += 6;
    }
    for (const e of emails) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textSecondary);
      doc.text(e.address || '', M + 4, cy);
      if (e.type) drawBadge(doc, { text: e.type, x: M + 80, y: cy - 3, color: COLORS.accent });
      cy += 6;
    }
  }
}

// ── DIGITAL EXPOSURE ──

function drawDigitalExposure(doc, profileData, pageNum, subject, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Digital Exposure', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Digital Exposure', M, y);
  y += 12;

  // Social Accounts Table
  const socials = profileData?.digital?.social_accounts || [];
  if (socials.length > 0) {
    y = drawSectionTitle(doc, 'Social Accounts', y);

    // Summary banner
    const publicCount = socials.filter((s) => s.visibility === 'public').length;
    const privateCount = socials.filter((s) => s.visibility === 'private').length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    doc.text(`${socials.length} accounts | ${publicCount} public | ${privateCount} private`, M + 5, y);
    y += 6;

    const rows = socials.map((s) => [
      s.platform || 'Unknown',
      s.handle || s.url || 'N/A',
      { badge: true, text: (s.visibility || 'unknown').toUpperCase(), color: s.visibility === 'public' ? COLORS.high : COLORS.low },
      (s.notes || '').slice(0, 30),
    ]);
    y = drawTable(doc, {
      headers: ['PLATFORM', 'HANDLE', 'VISIBILITY', 'NOTES'],
      rows,
      y,
      colWidths: [35, 50, 35, 50],
    });
    y += 6;
  }

  // Breach Records Table
  const breaches = profileData?.breaches?.records || [];
  if (breaches.length > 0) {
    const pb = checkPageBreak(doc, y, 30, pageNum, headerOpts('Digital Exposure', subject, caseData));
    y = pb.y;
    pageNum = pb.pageNum;

    y = drawSectionTitle(doc, 'Breach Records', y);

    // Summary banner
    const highCount = breaches.filter((b) => b.severity === 'high' || b.severity === 'critical').length;
    const pwExposed = breaches.filter((b) => b.data_types?.some((dt) => dt.toLowerCase().includes('password'))).length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    doc.text(`${breaches.length} breaches | ${highCount} high severity | ${pwExposed} passwords exposed`, M + 5, y);
    y += 6;

    const rows = breaches.map((b) => [
      (b.breach_name || 'Unknown').slice(0, 20),
      (b.email || '').slice(0, 25),
      (b.data_types || []).join(', ').slice(0, 30),
      { badge: true, text: (b.severity || 'unknown').toUpperCase(), color: getSeverityColor(b.severity) },
    ]);
    y = drawTable(doc, {
      headers: ['BREACH', 'EMAIL', 'DATA TYPES', 'SEVERITY'],
      rows,
      y,
      colWidths: [40, 45, 50, 35],
    });
  }

  return pageNum;
}

// ── BEHAVIORAL ANALYSIS ──

function drawBehavioralAnalysis(doc, profileData, pageNum, subject, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Behavioral Analysis', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Behavioral Analysis', M, y);
  y += 12;

  const routines = profileData?.behavioral?.routines || [];
  if (routines.length > 0) {
    y = drawSectionTitle(doc, 'Routines', y);

    for (const r of routines) {
      if (y > 255) break;
      const cVal = r.consistency != null ? (r.consistency > 1 ? r.consistency : Math.round(r.consistency * 100)) : null;

      drawCard(doc, { x: M, y, w: CW, h: 18 });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textPrimary);
      doc.text(r.name || 'Unnamed Routine', M + 4, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(r.schedule || 'No schedule', M + 4, y + 12);

      // Consistency bar
      if (cVal != null) {
        const predColor = cVal > 80 ? COLORS.critical : cVal > 60 ? COLORS.high : COLORS.low;
        drawProgressBar(doc, { x: M + 90, y: y + 3.5, w: 50, h: 3, value: cVal, max: 100, color: predColor });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(predColor[0], predColor[1], predColor[2]);
        doc.text(`${cVal}%`, M + 143, y + 6);

        // Predictability label
        const predLabel = cVal > 80 ? 'HIGH' : cVal > 60 ? 'MODERATE' : 'LOW';
        drawBadge(doc, { text: predLabel, x: M + 152, y: y + 2, color: predColor });
      }

      y += 22;
    }
    y += 4;
  }

  // Observations (Bug 2 fix: proper text wrapping)
  const observations = profileData?.behavioral?.observations || [];
  if (observations.length > 0) {
    const pb = checkPageBreak(doc, y, 20, pageNum, headerOpts('Behavioral Analysis', subject, caseData));
    y = pb.y;
    pageNum = pb.pageNum;

    y = drawSectionTitle(doc, 'Observations', y);

    for (const o of observations) {
      if (y > 260) break;
      const pb2 = checkPageBreak(doc, y, 16, pageNum, headerOpts('Behavioral Analysis', subject, caseData));
      y = pb2.y;
      pageNum = pb2.pageNum;

      // Exploitability badge
      const expColor = o.exploitability === 'high' ? COLORS.critical : o.exploitability === 'medium' ? COLORS.high : COLORS.textDim;
      drawBadge(doc, { text: (o.exploitability || 'unknown').toUpperCase(), x: M, y: y - 3, color: expColor });

      // Wrapped description text (Bug 2 fix)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT.body.size);
      doc.setTextColor(...COLORS.textSecondary);
      const descLines = wrapText(doc, o.description || '', CW - 28);
      for (const line of descLines) {
        doc.text(line, M + 24, y);
        y += 4.5;
      }
      y += 4;
    }
  }

  return pageNum;
}

// ── AEGIS DETAIL ──

function drawAegisDetail(doc, aegis, pageNum, subject, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Aegis Score Detail', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Aegis Score Detail', M, y);
  y += 12;

  // Factor table with inline progress bars
  y = drawSectionTitle(doc, 'Factor Scores', y);

  // Table header
  doc.setFillColor(...COLORS.headerRow);
  doc.rect(M, y - 4, CW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.accent);
  doc.text('FACTOR', M + 3, y);
  doc.text('SCORE', M + 60, y);
  doc.text('', M + 80, y); // bar area
  doc.text('WEIGHT', M + 130, y);
  doc.text('WEIGHTED', M + 150, y);
  y += 7;

  for (const [, factor] of Object.entries(aegis.factors)) {
    const fc = scoreColor(factor.score);
    if (Math.floor((y - LAYOUT.contentStartY) / 8) % 2 === 1) {
      doc.setFillColor(...COLORS.rowAlt);
      doc.rect(M, y - 4, CW, 8, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.text(factor.label, M + 3, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(fc[0], fc[1], fc[2]);
    doc.text(`${factor.score}`, M + 60, y);

    // Inline mini progress bar
    drawProgressBar(doc, { x: M + 75, y: y - 2.5, w: 50, h: 3, value: factor.score, max: 100, color: fc });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`${factor.weight}%`, M + 130, y);

    doc.setTextColor(...COLORS.textSecondary);
    doc.text(`${Math.round(factor.score * factor.weight / 100)}`, M + 150, y);

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.1);
    doc.line(M, y + 3.5, M + CW, y + 3.5);
    y += 8;
  }

  y += 10;

  // Risk Drivers
  y = drawSectionTitle(doc, 'Risk Drivers', y);

  const categories = { digital: 'Digital', breach: 'Breach', behavioral: 'Behavioral', physical: 'Physical' };
  const grouped = {};
  for (const d of aegis.drivers) {
    const cat = d.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(d);
  }

  let driverIdx = 0;
  for (const [cat, catDrivers] of Object.entries(grouped)) {
    if (y > 255) break;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    doc.text((categories[cat] || cat).toUpperCase(), M + 2, y);
    y += 6;

    for (const driver of catDrivers) {
      if (y > 265) break;
      const isTop3 = driverIdx < 3;

      if (isTop3) {
        doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
        doc.setGState(new doc.GState({ opacity: 0.06 }));
        doc.rect(M, y - 4, CW, 8, 'F');
        doc.setGState(new doc.GState({ opacity: 1 }));
        doc.setDrawColor(...COLORS.accent);
        doc.setLineWidth(0.5);
        doc.line(M, y - 4, M, y + 4);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textSecondary);
      doc.text(driver.text, M + 4, y);

      // Impact bar
      drawProgressBar(doc, { x: M + 130, y: y - 2.5, w: 30, h: 3, value: driver.impact, max: 20, color: scoreColor(driver.impact * 5) });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textDim);
      doc.text(`${driver.impact}`, M + 163, y);

      y += 8;
      driverIdx++;
    }
    y += 2;
  }

  return pageNum;
}

// ── RECON MIRROR ──

async function drawReconMirror(doc, subject, supabase, pageNum, caseData) {
  // Bug 4 fix: fetch data first, only add page if data exists
  let reconAssessment = null;
  if (subject?.id) {
    const { data } = await supabase.from('assessments').select('*').eq('subject_id', subject.id).eq('module', 'recon_mirror').order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) reconAssessment = data[0];
  }
  if (!reconAssessment) return { drawn: false, pageNum };

  doc.addPage();
  pageNum++;
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Recon Mirror', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Recon Mirror Assessment', M, y);
  y += 12;

  // Tinted callout card
  const narrative = reconAssessment.narrative_output || reconAssessment.score_data?.narrative_output || '';
  if (narrative) {
    const cleanText = stripMarkdown(narrative);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.body.size);
    const lines = wrapText(doc, cleanText, CW - 8);

    const cardH = Math.min(lines.length * 4.5 + 12, 230);
    drawCard(doc, { x: M, y, w: CW, h: cardH, bgColor: [15, 22, 20] });

    let ty = y + 8;
    doc.setTextColor(...COLORS.textSecondary);
    for (const line of lines) {
      if (ty > 272) {
        doc.addPage();
        pageNum++;
        drawPageBackground(doc);
        drawHeader(doc, { ...headerOpts('Recon Mirror', subject, caseData), pageNum });
        ty = LAYOUT.contentStartY;
      }
      doc.text(line, M + 4, ty);
      ty += 4.5;
    }
  }

  // Assessment metadata row
  const scoreData = reconAssessment.score_data || {};
  const metaItems = [
    scoreData.adversary_type && `Adversary: ${scoreData.adversary_type}`,
    scoreData.objective && `Objective: ${scoreData.objective}`,
    scoreData.sophistication && `Sophistication: ${scoreData.sophistication}`,
  ].filter(Boolean);

  if (metaItems.length > 0) {
    y = Math.min(y + (narrative ? 10 : 0) + 230, 265);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    doc.text(metaItems.join('  |  '), M, y);
  }

  return { drawn: true, pageNum, reconNarrative: narrative };
}

// ── PATTERN ANALYSIS ──

async function drawPatternAnalysis(doc, subject, supabase, pageNum, caseData) {
  // Bug 4 fix: fetch data first, only add page if data exists
  let patternNarrative = null;
  if (subject?.id) {
    const { data } = await supabase.from('assessments').select('narrative_output').eq('subject_id', subject.id).eq('module', 'pattern_lens').order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) patternNarrative = data[0].narrative_output;
  }
  if (!patternNarrative) return { drawn: false, pageNum };

  doc.addPage();
  pageNum++;
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Pattern Analysis', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Behavioral Pattern Analysis', M, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT.body.size);
  doc.setTextColor(...COLORS.textSecondary);
  const lines = wrapText(doc, stripMarkdown(patternNarrative), CW);
  for (const line of lines) {
    if (y > 272) {
      doc.addPage();
      pageNum++;
      drawPageBackground(doc);
      drawHeader(doc, { ...headerOpts('Pattern Analysis', subject, caseData), pageNum });
      y = LAYOUT.contentStartY;
    }
    doc.text(line, M, y);
    y += 4.5;
  }

  return { drawn: true, pageNum };
}

// ── RECOMMENDATIONS ──

function drawRecommendations(doc, profileData, aegis, pageNum, subject, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Recommendations', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Remediation Recommendations', M, y);
  y += 12;

  const options = buildRemediationOptions(profileData);
  if (options.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.body.size);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('No remediation actions identified. Add more profile data to generate recommendations.', M, y);
    return pageNum;
  }

  // Summary banner
  const totalReduction = options.reduce((s, o) => s + o.scoreReduction, 0);
  const projected = Math.max(0, aegis.composite - totalReduction);
  drawCard(doc, { x: M, y, w: CW, h: 10, bgColor: [15, 25, 22] });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.accent);
  doc.text(`${options.length} recommendations  |  Potential reduction: -${totalReduction} pts  |  Projected: ${projected}`, M + 4, y + 6);
  y += 16;

  // Group into tiers
  const critical = options.filter((o) => o.scoreReduction >= 10);
  const high = options.filter((o) => o.scoreReduction >= 5 && o.scoreReduction < 10);
  const moderate = options.filter((o) => o.scoreReduction < 5);

  const tiers = [
    { label: 'CRITICAL', items: critical, color: COLORS.critical },
    { label: 'HIGH', items: high, color: COLORS.high },
    { label: 'MODERATE', items: moderate, color: COLORS.moderate },
  ];

  let idx = 1;
  for (const tier of tiers) {
    if (tier.items.length === 0) continue;
    if (y > 260) break;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(tier.color[0], tier.color[1], tier.color[2]);
    doc.text(`${tier.label} PRIORITY`, M, y);
    y += 6;

    for (const opt of tier.items) {
      if (y > 258) break;
      const pb = checkPageBreak(doc, y, 24, pageNum, headerOpts('Recommendations', subject, caseData));
      y = pb.y;
      pageNum = pb.pageNum;

      // Priority number circle
      doc.setFillColor(tier.color[0], tier.color[1], tier.color[2]);
      doc.setGState(new doc.GState({ opacity: 0.15 }));
      doc.circle(M + 4, y, 4, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(tier.color[0], tier.color[1], tier.color[2]);
      doc.text(`${idx}`, M + 4, y + 1, { align: 'center' });

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textPrimary);
      doc.text(opt.label.slice(0, 70), M + 12, y);
      y += 5;

      // Description (wrapped)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textMuted);
      const descLines = wrapText(doc, opt.description, CW - 20);
      for (const line of descLines.slice(0, 3)) {
        doc.text(line, M + 12, y);
        y += 4;
      }

      // Score reduction bar + affected factor badge
      drawProgressBar(doc, { x: M + 12, y: y - 1, w: 30, h: 2.5, value: opt.scoreReduction, max: 20, color: tier.color });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.textDim);
      doc.text(`-${opt.scoreReduction} pts`, M + 45, y + 1);

      if (opt.affectedFactor) {
        const factorLabel = (opt.affectedFactor || '').replace(/_/g, ' ');
        drawBadge(doc, { text: factorLabel, x: M + 62, y: y - 3, color: COLORS.textDim });
      }

      y += 8;
      idx++;
    }
    y += 4;
  }

  return pageNum;
}

// ── CROSSWIRE SUMMARY ──

async function drawCrosswire(doc, subject, supabase, pageNum, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('CrossWire Summary', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Cross-Case Connection Analysis', M, y);
  y += 12;

  let overlaps = [];
  try {
    const allSubs = await fetchAllUserSubjects();
    if (subject && allSubs.length > 1) {
      overlaps = detectOverlaps(subject, allSubs);
    }
  } catch { /* noop */ }

  if (overlaps.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.body.size);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('No cross-case overlaps detected.', M, y);
    return pageNum;
  }

  // Summary header
  const caseCount = new Set(overlaps.map((o) => o.caseName)).size;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDim);
  doc.text(`${overlaps.length} connections across ${caseCount} cases`, M + 5, y);
  y += 6;

  // High priority banner
  const highPriority = overlaps.some((o) => o.matchCount >= 3 || o.matches.some((m) => m.type === 'phone' || m.type === 'email' || m.type === 'direct_link'));
  if (highPriority) {
    drawCard(doc, { x: M, y, w: CW, h: 9, bgColor: [40, 15, 15] });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.critical);
    doc.text('HIGH-PRIORITY MATCHES DETECTED', M + 4, y + 6);
    y += 14;
  }

  // Table
  const rows = overlaps.map((o) => {
    const types = [...new Set(o.matches.map((m) => m.type))];
    return [
      (o.subject.name || 'Unknown').slice(0, 25),
      (o.caseName || '').slice(0, 22),
      { badge: true, text: String(o.matchCount), color: o.matchCount >= 3 ? COLORS.critical : COLORS.accent },
      types.slice(0, 3).join(', '),
    ];
  });

  y = drawTable(doc, {
    headers: ['SUBJECT', 'CASE', 'MATCHES', 'TYPES'],
    rows,
    y,
    colWidths: [50, 45, 30, 45],
  });

  return pageNum;
}

// ── METHODOLOGY & DISCLAIMER ──

function drawMethodology(doc, pageNum, subject, caseData) {
  drawPageBackground(doc);
  drawHeader(doc, { ...headerOpts('Methodology', subject, caseData), pageNum });
  let y = LAYOUT.contentStartY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h1.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('Methodology & Disclaimer', M, y);
  y += 12;

  // Factor weights table
  y = drawSectionTitle(doc, 'Factor Weights', y);
  y = drawTable(doc, {
    headers: ['FACTOR', 'WEIGHT', 'DESCRIPTION'],
    rows: [
      ['Digital Footprint', '25%', 'Social media, data brokers, online presence'],
      ['Breach Exposure', '20%', 'Compromised credentials and data leaks'],
      ['Behavioral Predictability', '25%', 'Routine patterns, GPS data, observations'],
      ['Physical OPSEC', '15%', 'Address exposure, property records'],
      ['Network Exposure', '15%', 'Family and associate digital presence'],
    ],
    y,
    colWidths: [50, 25, 95],
  });

  y += 8;

  // Risk thresholds
  y = drawSectionTitle(doc, 'Risk Thresholds', y);
  const thresholds = [
    { label: 'CRITICAL', range: '75-100', color: COLORS.critical },
    { label: 'HIGH', range: '55-74', color: COLORS.high },
    { label: 'MODERATE', range: '35-54', color: COLORS.moderate },
    { label: 'LOW', range: '0-34', color: COLORS.low },
  ];

  for (const t of thresholds) {
    doc.setFillColor(t.color[0], t.color[1], t.color[2]);
    doc.setGState(new doc.GState({ opacity: 0.1 }));
    doc.rect(M, y - 3.5, CW, 7, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(t.color[0], t.color[1], t.color[2]);
    doc.text(t.label, M + 4, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textMuted);
    doc.text(t.range, M + 40, y);

    y += 8;
  }

  y += 8;

  // Disclaimer card
  y = drawSectionTitle(doc, 'Disclaimer', y);
  drawCard(doc, { x: M, y, w: CW, h: 28 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textMuted);
  const disclaimerLines = wrapText(doc, 'This report is generated for authorized intelligence and security assessment purposes only. The Aegis Exposure Score is a quantitative estimate based on available open-source data and may not reflect the complete threat landscape. Distribution should be limited to authorized personnel with appropriate security clearance. Generated by Sentract Intelligence Platform.', CW - 8);
  let dy = y + 5;
  for (const line of disclaimerLines) {
    doc.text(line, M + 4, dy);
    dy += 3.5;
  }
}

// ── MAIN EXPORT ──

export async function generateReportV2({ subject, caseData, profileData, supabase, template = 'full' }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const aegis = calculateAegisScore(profileData);
  const exposures = buildKeyExposures(profileData);
  const now = new Date();
  const pages = REPORT_TEMPLATES[template]?.pages || REPORT_TEMPLATES.full.pages;

  let pageNum = 0;
  let reconNarrative = null;

  // ── COVER ──
  if (pages.includes('cover')) {
    drawCover(doc, subject, caseData, now, template);
    pageNum++;
  }

  // ── EXECUTIVE SUMMARY ──
  if (pages.includes('executive_summary')) {
    doc.addPage();
    pageNum++;
    drawExecutiveSummary(doc, aegis, exposures, pageNum, subject, caseData);
  }

  // ── SUBJECT OVERVIEW ──
  if (pages.includes('subject_overview')) {
    doc.addPage();
    pageNum++;
    drawSubjectOverview(doc, profileData, pageNum, subject, caseData);
  }

  // ── DIGITAL EXPOSURE ──
  if (pages.includes('digital_exposure')) {
    doc.addPage();
    pageNum++;
    pageNum = drawDigitalExposure(doc, profileData, pageNum, subject, caseData);
  }

  // ── BEHAVIORAL ANALYSIS ──
  if (pages.includes('behavioral_analysis')) {
    doc.addPage();
    pageNum++;
    pageNum = drawBehavioralAnalysis(doc, profileData, pageNum, subject, caseData);
  }

  // ── PATTERN ANALYSIS (Bug 4: conditional page) ──
  if (pages.includes('pattern_analysis')) {
    const result = await drawPatternAnalysis(doc, subject, supabase, pageNum, caseData);
    pageNum = result.pageNum;
  }

  // ── AEGIS DETAIL ──
  if (pages.includes('aegis_detail')) {
    doc.addPage();
    pageNum++;
    pageNum = drawAegisDetail(doc, aegis, pageNum, subject, caseData);
  }

  // ── RECON MIRROR (Bug 4: conditional page) ──
  if (pages.includes('recon_mirror')) {
    const result = await drawReconMirror(doc, subject, supabase, pageNum, caseData);
    pageNum = result.pageNum;
    if (result.reconNarrative) reconNarrative = result.reconNarrative;
  }

  // ── RECOMMENDATIONS ──
  if (pages.includes('recommendations')) {
    doc.addPage();
    pageNum++;
    pageNum = drawRecommendations(doc, profileData, aegis, pageNum, subject, caseData);
  }

  // ── CROSSWIRE SUMMARY ──
  if (pages.includes('crosswire_summary')) {
    doc.addPage();
    pageNum++;
    pageNum = await drawCrosswire(doc, subject, supabase, pageNum, caseData);
  }

  // ── METHODOLOGY ──
  if (pages.includes('methodology')) {
    doc.addPage();
    pageNum++;
    drawMethodology(doc, pageNum, subject, caseData);
  }

  const filename = `Sentract_${(subject?.name || 'Report').replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);

  return { reconNarrative };
}
