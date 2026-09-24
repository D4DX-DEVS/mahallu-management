import jsPDF from 'jspdf';
import { NOC } from '@/services/registrationService';

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const getCertNumber = (id: string, year: string): string => {
  const suffix = id.slice(-6).toUpperCase();
  return `NOC-${year}-${suffix}`;
};

const loadLogo = async (): Promise<string | null> => {
  try {
    const response = await fetch('/Logo-512x512.png');
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Failed to load logo for NOC PDF:', err);
    return null;
  }
};

/** Draw a double-line decorative border around the page */
const drawBorder = (doc: jsPDF, pageWidth: number, pageHeight: number) => {
  // Outer border
  doc.setDrawColor(34, 100, 60);
  doc.setLineWidth(1.5);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  // Inner border (inset by 3mm)
  doc.setLineWidth(0.4);
  doc.rect(13, 13, pageWidth - 26, pageHeight - 26);
};

/** Draw a label/value row and return the new y position */
const drawRow = (doc: jsPDF, label: string, value: string, y: number, pageWidth: number): number => {
  const labelX = 25;
  const valueX = 75;
  const maxValueWidth = pageWidth - valueX - 25;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(label, labelX, y);

  doc.setFont('times', 'normal');
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(value, maxValueWidth);
  lines.forEach((line: string, i: number) => {
    doc.text(line, valueX, y + i * 6.5);
  });

  return y + Math.max(1, lines.length) * 6.5 + 3;
};

export const downloadNocPdf = async (noc: NOC, filename = 'noc-certificate') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logo = await loadLogo();

  // ── Decorative border ──────────────────────────────────────────────────────
  drawBorder(doc, pageWidth, pageHeight);

  // ── Certificate number (top-right) ────────────────────────────────────────
  const issuedYear = new Date(noc.issuedDate || noc.createdAt).getFullYear().toString();
  const certNo = getCertNumber(noc.id || '', issuedYear);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const certNoWidth = doc.getTextWidth(`Cert. No: ${certNo}`);
  doc.text(`Cert. No: ${certNo}`, pageWidth - certNoWidth - 18, 22);

  let y = 22;

  // ── Logo ───────────────────────────────────────────────────────────────────
  if (logo) {
    const logoSize = 22;
    const logoX = (pageWidth - logoSize) / 2;
    doc.addImage(logo, 'PNG', logoX, y, logoSize, logoSize);
    y += logoSize + 5;
  }

  // ── Organisation name ──────────────────────────────────────────────────────
  const orgName = noc.mahalluName || 'Mahallu Management';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(34, 100, 60);
  const orgW = doc.getTextWidth(orgName);
  doc.text(orgName, (pageWidth - orgW) / 2, y);
  y += 7;

  // ── Main title ─────────────────────────────────────────────────────────────
  const nocTypeLabel = noc.type === 'nikah' ? 'Nikkah' : 'Common';
  const title = 'NO OBJECTION CERTIFICATE';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  const titleW = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleW) / 2, y);
  y += 6;

  // ── Subtitle (type) ────────────────────────────────────────────────────────
  const subtitle = `( ${nocTypeLabel} )`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const subW = doc.getTextWidth(subtitle);
  doc.text(subtitle, (pageWidth - subW) / 2, y);
  y += 8;

  // ── Decorative header separator (double line) ──────────────────────────────
  doc.setDrawColor(34, 100, 60);
  doc.setLineWidth(0.8);
  doc.line(20, y, pageWidth - 20, y);
  doc.setLineWidth(0.3);
  doc.line(20, y + 2, pageWidth - 20, y + 2);
  y += 10;

  // ── Body fields ────────────────────────────────────────────────────────────
  y = drawRow(doc, 'Applicant Name:', noc.applicantName, y, pageWidth);
  if (noc.applicantPhone) {
    y = drawRow(doc, 'Phone:', noc.applicantPhone, y, pageWidth);
  }
  y = drawRow(doc, 'NOC Type:', nocTypeLabel, y, pageWidth);
  if (noc.purposeTitle) {
    y = drawRow(doc, 'Purpose / Title:', noc.purposeTitle, y, pageWidth);
  }

  const description = stripHtml(noc.purposeDescription || noc.purpose || '');
  if (description) {
    y = drawRow(doc, 'Description:', description, y, pageWidth);
  }

  const issuedDateStr = formatDate(noc.issuedDate || noc.createdAt);
  y = drawRow(doc, 'Issued Date:', issuedDateStr, y, pageWidth);
  y = drawRow(doc, 'Certificate No:', certNo, y, pageWidth);

  if (noc.remarks) {
    y = drawRow(doc, 'Remarks:', noc.remarks, y, pageWidth);
  }

  // ── Nikah / Groom Details (only for nikah NOCs) ───────────────────────────
  const nikah = noc.nikahRegistrationId;
  if (noc.type === 'nikah' && nikah && typeof nikah === 'object') {
    y += 4;
    // Sub-section header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(34, 100, 60);
    doc.text('Nikah Details', 25, y);
    y += 2;
    doc.setDrawColor(34, 100, 60);
    doc.setLineWidth(0.3);
    doc.line(25, y, pageWidth - 25, y);
    y += 6;

    if (nikah.groomName) {
      const groomLabel = nikah.groomAge ? `${nikah.groomName} (Age: ${nikah.groomAge})` : nikah.groomName;
      y = drawRow(doc, 'Groom:', groomLabel, y, pageWidth);
    }
    if (nikah.brideName) {
      const brideLabel = nikah.brideAge ? `${nikah.brideName} (Age: ${nikah.brideAge})` : nikah.brideName;
      y = drawRow(doc, 'Bride:', brideLabel, y, pageWidth);
    }
    if (nikah.nikahDate) {
      y = drawRow(doc, 'Nikah Date:', formatDate(nikah.nikahDate), y, pageWidth);
    }
    if (nikah.waliName) {
      y = drawRow(doc, 'Wali:', nikah.waliName, y, pageWidth);
    }
    if (nikah.witness1 || nikah.witness2) {
      const witnesses = [nikah.witness1, nikah.witness2].filter(Boolean).join(', ');
      y = drawRow(doc, 'Witnesses:', witnesses, y, pageWidth);
    }
    if (nikah.mahrAmount) {
      const mahrStr = nikah.mahrDescription
        ? `${nikah.mahrAmount} — ${nikah.mahrDescription}`
        : String(nikah.mahrAmount);
      y = drawRow(doc, 'Mahr:', mahrStr, y, pageWidth);
    }
  }

  // ── Body separator ─────────────────────────────────────────────────────────
  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // ── Signature / Approved By block (two-column) ─────────────────────────────
  const leftX = 25;
  const rightX = pageWidth / 2 + 15;

  // Left column — Approved By
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text('Approved By', leftX, y);

  // Right column — Date Issued label
  doc.text('Date of Issue', rightX, y);
  y += 14;

  // Signature line (left)
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.4);
  doc.line(leftX, y, leftX + 70, y);

  // Date issued value (right)
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(issuedDateStr, rightX, y);
  y += 5;

  // Admin name (approvedBy) bold under signature line
  if (noc.approvedBy) {
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(noc.approvedBy, leftX, y);
    y += 5;
  }

  // Org name in green below admin name
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(34, 100, 60);
  doc.text(orgName, leftX, y);
  y += 5;

  // Designation label
  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Authorised Signatory', leftX, y);

  // ── Footer disclaimer ──────────────────────────────────────────────────────
  const footerY = pageHeight - 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  const disclaimer = `This certificate is issued by ${orgName} and is valid as of the date of issue stated above.`;
  const disclaimerW = doc.getTextWidth(disclaimer);
  doc.text(disclaimer, (pageWidth - disclaimerW) / 2, footerY);

  doc.save(`${filename}.pdf`);
};
