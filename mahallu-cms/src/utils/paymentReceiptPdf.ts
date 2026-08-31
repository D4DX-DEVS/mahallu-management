import jsPDF from 'jspdf';
import { PaymentRecord } from '@/services/memberPortalService';

const loadLogo = async (): Promise<string | null> => {
  try {
    const response = await fetch('/Logo-512x512.png');
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

export const downloadPaymentReceiptPdf = async (
  payment: PaymentRecord,
  memberName: string,
  mahallName = 'Mahallu',
  filename = 'payment-receipt'
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  let y = 20;

  // Logo
  if (logo) {
    const logoSize = 20;
    const logoX = (pageWidth - logoSize) / 2;
    doc.addImage(logo, 'PNG', logoX, y, logoSize, logoSize);
    y += logoSize + 8;
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const title = 'PAYMENT RECEIPT';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Mahall name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(mahallName, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Separator
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Receipt Box
  const labelX = 20;
  const valueX = 70;
  const lineHeight = 9;

  const rows: [string, string][] = [
    ['Receipt No:', payment.receiptNo || 'N/A'],
    ['Date:', payment.paymentDate ? formatDate(payment.paymentDate) : 'N/A'],
    ['Member Name:', memberName],
    ['Payment Type:', payment.type === 'varisangya' ? 'Varisangya (Member Fee)' : 'Zakat'],
    ['Amount:', formatAmount(payment.amount)],
    ['Payment Method:', payment.paymentMethod || 'N/A'],
  ];

  if (payment.remarks) {
    rows.push(['Remarks:', payment.remarks]);
  }

  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, pageWidth - valueX - 20);
    doc.text(lines, valueX, y);
    y += lineHeight * Math.max(1, lines.length);
  });

  y += 8;
  doc.setLineWidth(0.3);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a computer-generated receipt and does not require a signature.', pageWidth / 2, y, {
    align: 'center',
  });

  doc.save(`${filename}-${payment.receiptNo || payment.id}.pdf`);
};
