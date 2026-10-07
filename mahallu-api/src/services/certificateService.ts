import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import Certificate, { CertificateType, ICertificate } from '../models/Certificate';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import CertificateClaim from '../models/CertificateClaim';
import Tenant from '../models/Tenant';
import * as uploadService from './uploadService';
import { uploadPrivateBuffer } from './uploadService';
import { UserFacingError } from '../utils/userMessages';
import { nextSequence, maxNumericSuffix, isDuplicateKeyError } from '../utils/idCounter';

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

/**
 * Certificate numbers are global (the public verify endpoint has no tenant hint and certificateNo
 * carries a GLOBAL unique index), so the sequence is per (type, year) across every Mahallu:
 * NK-2026-0001, NK-2026-0002 ... whichever Mahallu issues them.
 *
 * The first time a (type, year) is used the counter is seeded from the highest number already
 * issued with that prefix, by anyone, so numbers issued before the counter existed are never reused.
 */
export async function nextCertificateNo(type: CertificateType, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `${TYPE_PREFIX[type]}-${year}`;
  const seq = await nextSequence(`cert:${type}:${year}`, {
    seed: () => maxNumericSuffix(Certificate, {}, 'certificateNo', new RegExp(`^${prefix}-(\\d{1,9})$`)),
  });
  return `${prefix}-${String(seq).padStart(4, '0')}`;
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
    if (!reg) throw new UserFacingError("We couldn't find that nikah registration. It may have been removed.", 400);
    if (reg.status !== 'approved') throw new UserFacingError('Registration must be approved before issuing a certificate', 400);
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
    if (!reg) throw new UserFacingError("We couldn't find that death registration. It may have been removed.", 400);
    if (reg.status !== 'approved') throw new UserFacingError('Registration must be approved before issuing a certificate', 400);
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
  if (!reg) throw new UserFacingError("We couldn't find that NOC. It may have been removed.", 400);
  if (reg.status !== 'approved') throw new UserFacingError('NOC must be approved before issuing a certificate', 400);
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

/**
 * The private objects uploaded by ONE issue call. Only keys registered here are ever discarded, so a
 * request can never delete an object it did not create. `commit` removes a key once a Certificate
 * references it; `discardAll` removes the rest, exactly once each (a second call is a no-op), and
 * never throws, so it can sit in any failure branch without masking the original error.
 */
export class UploadTracker {
  private readonly pending = new Set<string>();
  private readonly settled = new Set<string>();

  constructor(private readonly context: { tenantId?: unknown } = {}) {}

  track(key: string): void {
    this.pending.add(key);
  }

  commit(key: string): void {
    this.pending.delete(key);
  }

  get uncommitted(): string[] {
    return [...this.pending];
  }

  /** Returns true when every tracked upload is gone or was kept because a record references it. */
  async discardAll(reason: string): Promise<boolean> {
    let allClean = true;
    for (const key of [...this.pending]) {
      if (this.settled.has(key)) {
        this.pending.delete(key);
        continue;
      }
      let outcome: string;
      try {
        outcome = await uploadService.discardPrivateObject(key);
      } catch {
        outcome = 'failed'; // discardPrivateObject never throws, but a replaced one might
      }
      // Each key is settled exactly once: deleted, kept because a record references it, or (when the
      // delete failed / could not be verified) left in storage with a durable marker for an operator.
      this.settled.add(key);
      this.pending.delete(key);
      if (outcome !== 'deleted' && outcome !== 'kept-referenced') {
        allClean = false;
        uploadService.reportOrphanedObject(key, `${reason}:${outcome}`, this.context);
      }
    }
    return allClean;
  }
}

/** Tunables (milliseconds). Exported so tests can shrink them; production uses the defaults. */
export const certificateIssueTuning = {
  /** How long a caller that lost the claim waits for the winner's certificate before answering 409. */
  waitMs: 10_000,
  pollMs: 200,
  /** A claim older than this belongs to a crashed process and can be taken over. */
  staleMs: 120_000,
};

/** 409: another request is issuing this very certificate and did not finish within the wait. */
export class CertificateIssueInProgressError extends UserFacingError {
  readonly code = 'CERTIFICATE_BEING_ISSUED';
  readonly retryAfterSeconds = 3;
  constructor() {
    super('This certificate is being issued right now. Please try again in a few seconds.', 409);
    this.name = 'CertificateIssueInProgressError';
  }
}

export const certificateIssueKey = (tenantId: unknown, type: string, registrationId: unknown): string =>
  `${String(tenantId)}:${type}:${String(registrationId)}`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Take the per-registration claim. Exactly one concurrent caller gets it: the claim row's _id is the
 * issue key, so the insert is atomic. A row older than the stale limit (a crashed owner) is taken over
 * with a single conditional update, which also lets only one taker through.
 */
async function takeClaim(issueKey: string, token: string): Promise<boolean> {
  const now = new Date();
  try {
    await CertificateClaim.create({ _id: issueKey, token, claimedAt: now });
    return true;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
  const cutoff = new Date(now.getTime() - certificateIssueTuning.staleMs);
  const taken: any = await CertificateClaim.findOneAndUpdate(
    { _id: issueKey, claimedAt: { $lt: cutoff } } as any,
    { $set: { token, claimedAt: now } },
    { new: true }
  );
  return Boolean(taken && taken.token === token);
}

/** Still the owner? Also pushes `claimedAt` forward so a slow render is not mistaken for a crash. */
async function refreshClaim(issueKey: string, token: string): Promise<boolean> {
  const owned = await CertificateClaim.findOneAndUpdate(
    { _id: issueKey, token } as any,
    { $set: { claimedAt: new Date() } }
  );
  return Boolean(owned);
}

/** Best-effort: a claim that cannot be removed simply expires after the stale limit. */
async function releaseClaim(issueKey: string, token: string): Promise<void> {
  try {
    await CertificateClaim.deleteOne({ _id: issueKey, token } as any);
  } catch (error: any) {
    console.error('[Certificate] could not release the issue claim:', error?.name || 'error');
  }
}

const MAX_NUMBER_ATTEMPTS = 5;

export interface IssueResult {
  certificate: ICertificate;
  /** false when a valid certificate for this registration already existed (nothing new was issued). */
  created: boolean;
}

/**
 * Issue (or return) the certificate of a registration. Idempotent and safe under concurrency:
 *
 *  1. a valid certificate already exists for (tenant, type, registration)  -> returned, `created: false`,
 *     no number is consumed and nothing is rendered or uploaded;
 *  2. otherwise exactly one caller takes the registration's CLAIM; the others poll (bounded) for that
 *     caller's certificate and return it, or fail with CertificateIssueInProgressError (409);
 *  3. the claim owner allocates the number, renders, uploads and saves; the unique issueKey index on
 *     valid certificates is the database-level backstop;
 *  4. on any failure the owner discards the uploads of THIS request and releases the claim, so a retry
 *     can proceed at once; a claim left by a crashed process is taken over after `staleMs`.
 *
 * Revoking a certificate clears its issueKey, so a new certificate can be issued afterwards.
 */
export async function issueCertificateDetailed(
  type: CertificateType,
  registrationId: string,
  tenantId: string,
  issuedBy: string
): Promise<IssueResult> {
  const issueKey = certificateIssueKey(tenantId, type, registrationId);
  const findActive = () => Certificate.findOne({ tenantId, type, registrationId, status: 'valid' });
  const token = new mongoose.Types.ObjectId().toHexString();
  const deadline = Date.now() + certificateIssueTuning.waitMs;

  for (;;) {
    const existing = await findActive();
    if (existing) return { certificate: existing, created: false };

    if (await takeClaim(issueKey, token)) {
      try {
        // The previous owner may have finished (and released its claim) between our lookup and our claim.
        const finished = await findActive();
        if (finished) return { certificate: finished, created: false };
        return await issueAsClaimOwner(type, registrationId, tenantId, issuedBy, issueKey, token, findActive);
      } finally {
        await releaseClaim(issueKey, token);
      }
    }

    if (Date.now() >= deadline) throw new CertificateIssueInProgressError();
    await sleep(certificateIssueTuning.pollMs);
  }
}

// Certificates created by THIS process during the call that returned them (see wasIssuedNow).
const issuedNow = new WeakSet<object>();

/** True when `certificate` was just issued by issueCertificate (false: it already existed). */
export const wasIssuedNow = (certificate: unknown): boolean =>
  typeof certificate === 'object' && certificate !== null && issuedNow.has(certificate);

/** The certificate only (same signature as before); `wasIssuedNow` tells a new one from an existing one. */
export async function issueCertificate(
  type: CertificateType,
  registrationId: string,
  tenantId: string,
  issuedBy: string
): Promise<ICertificate> {
  const { certificate, created } = await issueCertificateDetailed(type, registrationId, tenantId, issuedBy);
  if (created) issuedNow.add(certificate);
  return certificate;
}


async function issueAsClaimOwner(
  type: CertificateType,
  registrationId: string,
  tenantId: string,
  issuedBy: string,
  issueKey: string,
  token: string,
  findActive: () => Promise<ICertificate | null>
): Promise<IssueResult> {
  const [content, tenant] = await Promise.all([
    loadContent(type, registrationId, tenantId),
    Tenant.findById(tenantId).select('name'),
  ]);

  const issueDate = new Date();
  const mahalluName = (tenant as any)?.name || 'Mahallu';
  const uploads = new UploadTracker({ tenantId });

  try {
    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      // The number comes from the atomic counter BEFORE anything is rendered or uploaded.
      const certificateNo = await nextCertificateNo(type, issueDate);

      // A number that already exists (issued before the counter, or by hand) is skipped for free: no
      // PDF is rendered and nothing is uploaded for it.
      if (await Certificate.exists({ certificateNo })) continue;

      const doc = new Certificate({
        tenantId,
        certificateNo,
        type,
        registrationId,
        subjectMemberIds: content.subjectMemberIds,
        issuedBy,
        issueDate,
        pdfKey: 'pending',
        status: 'valid',
        issueKey,
      });
      // Reject a bad document before anything is uploaded.
      await doc.validate();

      // Not the owner any more (the claim was judged abandoned and taken over): stop before uploading.
      if (!(await refreshClaim(issueKey, token))) throw new CertificateIssueInProgressError();

      const pdfBuffer = await renderPdf(TYPE_TITLE[type], mahalluName, certificateNo, issueDate, issuedBy, content.fields);
      const pdfKey = await uploadPrivateBuffer(pdfBuffer, `certificates/${tenantId}`, 'application/pdf');
      uploads.track(pdfKey);
      doc.pdfKey = pdfKey;
      try {
        const saved = await doc.save();
        uploads.commit(pdfKey);
        return { certificate: saved, created: true };
      } catch (error: any) {
        await uploads.discardAll('certificate-save-failed');
        if (isDuplicateKeyError(error, 'issueKey')) {
          // Someone else already holds a valid certificate for this registration: that one wins.
          const winner = await findActive();
          if (winner) return { certificate: winner, created: false };
          throw new CertificateIssueInProgressError();
        }
        // Lost a race for this exact number (the PDF carries it, so it is rendered again): next number.
        if (!isDuplicateKeyError(error, 'certificateNo')) throw error;
      }
    }
    throw new UserFacingError("We couldn't assign a certificate number just now. Please try again.", 503);
  } catch (error) {
    // Anything that escaped after an upload (claim lost, process-level error): this request's uploads go.
    await uploads.discardAll('certificate-issue-failed');
    throw error;
  }
}
