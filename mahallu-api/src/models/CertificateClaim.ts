import mongoose, { Schema } from 'mongoose';

/**
 * A short-lived claim on "issue the certificate for THIS registration", keyed by
 * `${tenantId}:${type}:${registrationId}` (the document _id, so the claim is exactly one atomic
 * insert and needs no extra index).
 *
 * Whoever inserts the row is the only caller allowed to allocate a certificate number, render and
 * upload the PDF. The owner deletes the row when it is done (success or failure); a row whose
 * `claimedAt` is older than the stale limit belongs to a crashed process and can be taken over.
 *
 * It lives in its own collection (not as a placeholder Certificate) so an in-flight claim can never
 * show up in certificate lists, verification or the member's downloads.
 */
export interface ICertificateClaim {
  _id: string;
  token: string; // identifies the owning issue call
  claimedAt: Date;
}

const CertificateClaimSchema = new Schema<ICertificateClaim>(
  {
    _id: { type: String, required: true },
    token: { type: String, required: true },
    claimedAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false }
);

export default mongoose.model<ICertificateClaim>('CertificateClaim', CertificateClaimSchema);
