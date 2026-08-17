import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import Certificate, { CertificateType, ICertificate } from '../models/Certificate';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import Tenant from '../models/Tenant';
import { uploadPrivateBuffer } from './uploadService';

const TYPE_PREFIX: Record<CertificateType, string> = {
  nikah: 'NK',
  death: 'DT',
  noc: 'NC',
};

const TYPE_TITLE: Record<CertificateType, string> = {
  nikah: 'Nikah Certificate',
  death: 'Death Certificate',
  noc: 'No Objection Certificate',
};

function verifyUrl(certificateNo: string): string {
  const base = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/verify/${certificateNo}`;
}

async function nextCertificateNo(tenantId: unknown, type: CertificateType): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${TYPE_PREFIX[type]}-${year}`;
  const count = await Certificate.countDocuments({
    tenantId,
    type,
    certificateNo: { $regex: `^${prefix}-` },
  });
  // ponytail: count+1 numbering; unique index on certificateNo catches races, caller retries
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

interface CertificateContent {
  fields: Array<[string, string]>;
  subjectMemberIds: mongoose.Types.ObjectId[];
}

const formatDate = (d?: Date | string | null): string =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

async function loadContent(type: CertificateType, registrationId: string, tenantId: unknown): Promise<CertificateContent> {
  if (type === 'nikah') {
    const reg = await NikahRegistration.findOne({ _id: registrationId, tenantId });
    if (!reg) throw new Error('Nikah registration not found');
    if (reg.status !== 'approved') throw new Error('Registration must be approved before issuing a certificate');
    return {
      fields: [
        ['Groom', reg.groomName + (reg.groomAge ? ` (${reg.groomAge})` : '')],
        ['Bride', reg.brideName + (reg.brideAge ? ` (${reg.brideAge})` : '')],
        ['Nikah Date', formatDate(reg.nikahDate)],
        ['Venue', reg.venue || '-'],
        ['Wali', reg.waliName || '-'],
        ['Witnesses', [reg.witness1, reg.witness2].filter(Boolean).join(', ') || '-'],
        ['Mahr', reg.mahrAmount ? `${reg.mahrAmount}${reg.mahrDescription ? ` (${reg.mahrDescription})` : ''}` : reg.mahrDescription || '-'],
      ],
      subjectMemberIds: [reg.groomId, reg.brideId].filter(Boolean) as mongoose.Types.ObjectId[],
    };
  }
  if (type === 'death') {
    const reg = await DeathRegistration.findOne({ _id: registrationId, tenantId });
    if (!reg) throw new Error('Death registration not found');
    if (reg.status !== 'approved') throw new Error('Registration must be approved before issuing a certificate');
    return {
      fields: [
        ['Name of Deceased', reg.deceasedName],
        ['Date of Death', formatDate(reg.deathDate)],
        ['Place of Death', reg.placeOfDeath || '-'],
        ['Informant', reg.informantName || '-'],
      ],
      subjectMemberIds: [reg.deceasedId].filter(Boolean) as mongoose.Types.ObjectId[],
    };
  }
  const reg = await NOC.findOne({ _id: registrationId, tenantId });
  if (!reg) throw new Error('NOC not found');
  if (reg.status !== 'approved') throw new Error('NOC must be approved before issuing a certificate');
  return {
    fields: [
      ['Applicant', reg.applicantName],
      ['Purpose', reg.purposeTitle || reg.purpose || '-'],
      ['Details', reg.purposeDescription || '-'],
      ['NOC Type', reg.type === 'nikah' ? 'Nikah' : 'Common'],
    ],
    subjectMemberIds: [reg.applicantId].filter(Boolean) as mongoose.Types.ObjectId[],
  };
}

async function renderPdf(
  title: string,
  mahalluName: string,
  certificateNo: string,
  issueDate: Date,
  issuedBy: string,
  fields: Array<[string, string]>
): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(verifyUrl(certificateNo), { width: 120, margin: 1 });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100;

    doc.rect(35, 35, doc.page.width - 70, doc.page.height - 70).lineWidth(2).stroke('#0f766e');

    doc.moveDown(1);
    doc.fontSize(20).fillColor('#0f766e').font('Helvetica-Bold').text(mahalluName, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor('#111827').text(title, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#6b7280').font('Helvetica').text(`Certificate No: ${certificateNo}`, { align: 'center' });
    doc.moveDown(1.5);

    fields.forEach(([label, value]) => {
      const y = doc.y;
      doc.fontSize(11).fillColor('#6b7280').font('Helvetica').text(label, 70, y, { width: 160 });
      doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(value || '-', 240, y, { width: pageWidth - 190 });
      doc.moveDown(0.8);
    });

    doc.moveDown(1.5);
    const bottomY = doc.y;
    doc.image(qrPng, 70, bottomY, { width: 90 });
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica').text('Scan to verify', 70, bottomY + 95, { width: 90, align: 'center' });

    doc.fontSize(10).fillColor('#111827').font('Helvetica')
      .text(`Issued on: ${formatDate(issueDate)}`, 300, bottomY + 20, { width: 230, align: 'right' })
      .text(`Issued by: ${issuedBy}`, 300, bottomY + 40, { width: 230, align: 'right' });

    doc.end();
  });
}

export async function issueCertificate(
  type: CertificateType,
  registrationId: string,
  tenantId: string,
  issuedBy: string
): Promise<ICertificate> {
  const existing = await Certificate.findOne({ tenantId, type, registrationId, status: 'valid' });
  if (existing) return existing;

  const [content, tenant] = await Promise.all([
    loadContent(type, registrationId, tenantId),
    Tenant.findById(tenantId).select('name'),
  ]);

  const issueDate = new Date();
  const mahalluName = (tenant as any)?.name || 'Mahallu';

  // retry on rare certificateNo race (unique index)
  for (let attempt = 0; attempt < 3; attempt++) {
    const certificateNo = await nextCertificateNo(tenantId, type);
    const pdfBuffer = await renderPdf(TYPE_TITLE[type], mahalluName, certificateNo, issueDate, issuedBy, content.fields);
    const pdfKey = await uploadPrivateBuffer(pdfBuffer, `certificates/${tenantId}`, 'application/pdf');
    try {
      return await Certificate.create({
        tenantId,
        certificateNo,
        type,
        registrationId,
        subjectMemberIds: content.subjectMemberIds,
        issuedBy,
        issueDate,
        pdfKey,
        status: 'valid',
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error('Failed to allocate a unique certificate number, please retry');
}
