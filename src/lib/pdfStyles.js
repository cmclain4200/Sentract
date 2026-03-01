// ── Shared PDF Styles & Drawing Primitives ──

export const COLORS = {
  pageBg: [10, 10, 10],
  surfaceBg: [20, 20, 20],
  cardBg: [18, 18, 18],
  accent: [9, 188, 138],
  accentLight: [0, 212, 170],
  critical: [239, 68, 68],
  high: [245, 158, 11],
  moderate: [59, 130, 246],
  low: [16, 185, 129],
  textPrimary: [255, 255, 255],
  textSecondary: [200, 200, 200],
  textMuted: [150, 150, 150],
  textDim: [100, 100, 100],
  border: [40, 40, 40],
  rowAlt: [15, 15, 15],
  headerRow: [25, 25, 25],
  confidential: [180, 30, 30],
};

export const FONT = {
  h1: { size: 16, style: 'bold' },
  h2: { size: 11, style: 'bold' },
  h3: { size: 10, style: 'bold' },
  body: { size: 9, style: 'normal' },
  small: { size: 8, style: 'normal' },
  caption: { size: 7, style: 'normal' },
  metric: { size: 28, style: 'bold' },
};

export const LAYOUT = {
  margin: 20,
  contentWidth: 170,
  contentStartY: 28,
  pageBreakThreshold: 270,
  footerY: 285,
};

export function getRiskColor(level) {
  const map = { CRITICAL: COLORS.critical, HIGH: COLORS.high, MODERATE: COLORS.moderate, LOW: COLORS.low };
  return map[level] || COLORS.textMuted;
}

export function getSeverityColor(severity) {
  const map = {
    critical: COLORS.critical, high: COLORS.critical,
    medium: COLORS.high, moderate: COLORS.high,
    low: COLORS.moderate, info: COLORS.low,
    red: COLORS.critical, amber: COLORS.high, blue: COLORS.moderate, green: COLORS.low,
  };
  return map[(severity || '').toLowerCase()] || COLORS.textMuted;
}

export function stripMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function wrapText(doc, text, maxWidth) {
  if (!text) return [];
  return doc.splitTextToSize(text, maxWidth);
}

// ── Drawing Primitives ──

export function drawPageBackground(doc) {
  doc.setFillColor(...COLORS.pageBg);
  doc.rect(0, 0, 210, 297, 'F');
}

export function drawHeader(doc, { title, pageNum, classification, subjectName, caseName }) {
  // Wordmark top-left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDim);
  const letters = 'SENTRACT'.split('');
  let lx = LAYOUT.margin;
  for (const ch of letters) {
    doc.text(ch, lx, 10);
    lx += doc.getTextWidth(ch) + 0.8;
  }

  // Classification badge top-right
  if (classification) {
    const badgeW = doc.getTextWidth(classification) + 6;
    doc.setFillColor(...COLORS.confidential);
    doc.roundedRect(190 - badgeW, 6, badgeW, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text(classification, 190 - badgeW + 3, 10);
  }

  // Accent line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.3);
  doc.line(LAYOUT.margin, 14, 190, 14);

  // Section title
  if (title) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.textDim);
    doc.text(title.toUpperCase(), LAYOUT.margin, 18);
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textDim);
  const footerLeft = [caseName, subjectName].filter(Boolean).join(' | ');
  if (footerLeft) doc.text(footerLeft, LAYOUT.margin, LAYOUT.footerY);
  if (pageNum != null) doc.text(`${pageNum}`, 190, LAYOUT.footerY, { align: 'right' });

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.15);
  doc.line(LAYOUT.margin, LAYOUT.footerY - 3, 190, LAYOUT.footerY - 3);
}

export function drawSectionTitle(doc, title, y) {
  // Teal left accent bar
  doc.setFillColor(...COLORS.accent);
  doc.rect(LAYOUT.margin, y - 3.5, 1.5, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.h2.size);
  doc.setTextColor(...COLORS.accent);
  doc.text(title.toUpperCase(), LAYOUT.margin + 5, y);
  return y + 8;
}

export function drawTable(doc, { headers, rows, y, colWidths, startX }) {
  const x0 = startX || LAYOUT.margin;
  const rowH = 7;
  const cellPad = 3;

  // Header row
  doc.setFillColor(...COLORS.headerRow);
  doc.rect(x0, y - 4, LAYOUT.contentWidth, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.accent);
  let cx = x0;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx + cellPad, y);
    cx += colWidths[i];
  }
  y += rowH;

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    if (y > LAYOUT.pageBreakThreshold) break;
    if (r % 2 === 1) {
      doc.setFillColor(...COLORS.rowAlt);
      doc.rect(x0, y - 4, LAYOUT.contentWidth, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    cx = x0;
    for (let i = 0; i < rows[r].length; i++) {
      const cell = rows[r][i];
      if (typeof cell === 'object' && cell.badge) {
        drawBadge(doc, { text: cell.text, x: cx + cellPad, y: y - 2.5, color: cell.color || COLORS.textDim });
      } else {
        const val = String(cell ?? '');
        const maxW = colWidths[i] - cellPad * 2;
        doc.text(val.length > maxW / 2 ? val.slice(0, Math.floor(maxW / 2)) : val, cx + cellPad, y);
      }
      cx += colWidths[i];
    }
    // Row separator
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.1);
    doc.line(x0, y + 3, x0 + LAYOUT.contentWidth, y + 3);
    y += rowH;
  }
  return y;
}

export function drawBadge(doc, { text, x, y, color, bgAlpha }) {
  const c = color || COLORS.textDim;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  const tw = doc.getTextWidth(text) + 5;
  const h = 5;
  // Background
  doc.setFillColor(c[0], c[1], c[2]);
  doc.setGState(new doc.GState({ opacity: bgAlpha || 0.15 }));
  doc.roundedRect(x, y, tw, h, 1.5, 1.5, 'F');
  doc.setGState(new doc.GState({ opacity: 1 }));
  // Text
  doc.setTextColor(c[0], c[1], c[2]);
  doc.text(text, x + 2.5, y + 3.5);
}

export function drawProgressBar(doc, { x, y, w, h, value, max, color }) {
  const pct = Math.min(1, Math.max(0, (value || 0) / (max || 100)));
  // Background track
  doc.setFillColor(...COLORS.border);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  // Fill
  if (pct > 0) {
    const c = color || COLORS.accent;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(x, y, Math.max(h, w * pct), h, h / 2, h / 2, 'F');
  }
}

export function drawGaugeRing(doc, { cx, cy, radius, lineWidth, value, max, color }) {
  const segments = 80;
  const lw = lineWidth || 3;
  const pct = Math.min(1, Math.max(0, (value || 0) / (max || 100)));

  // Background circle (muted)
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(lw);
  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;
    doc.line(
      cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius,
      cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius,
    );
  }

  // Foreground arc (from -90deg clockwise)
  if (pct > 0) {
    const c = color || COLORS.accent;
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(lw);
    const arcSegments = Math.ceil(segments * pct);
    const startAngle = -Math.PI / 2;
    for (let i = 0; i < arcSegments; i++) {
      const a1 = startAngle + (i / segments) * Math.PI * 2;
      const a2 = startAngle + ((i + 1) / segments) * Math.PI * 2;
      doc.line(
        cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius,
        cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius,
      );
    }
  }

  // Score number centered
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.metric.size);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(String(value ?? 0), cx, cy + 4, { align: 'center' });
}

export function drawCard(doc, { x, y, w, h, bgColor }) {
  const c = bgColor || COLORS.cardBg;
  doc.setFillColor(c[0], c[1], c[2]);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
}

export function checkPageBreak(doc, y, needed, pageNum, headerOpts) {
  if (y + needed > LAYOUT.pageBreakThreshold) {
    doc.addPage();
    pageNum++;
    drawPageBackground(doc);
    if (headerOpts) drawHeader(doc, { ...headerOpts, pageNum });
    return { y: LAYOUT.contentStartY, pageNum };
  }
  return { y, pageNum };
}

export function scoreColor(score) {
  if (score >= 75) return COLORS.critical;
  if (score >= 55) return COLORS.high;
  if (score >= 35) return COLORS.moderate;
  return COLORS.low;
}
