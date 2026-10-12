import mongoose from 'mongoose';

/**
 * Fields a client must never set through a generic update body.
 *
 * `tenantFilter` only injects `tenantId` when the body omits it, so a
 * client-supplied `tenantId` would otherwise flow straight into
 * findByIdAndUpdate and move the record into another tenant.
 */
const IMMUTABLE_FIELDS = ['tenantId', '_id', 'id', 'createdAt', 'updatedAt', '__v'] as const;

export const stripImmutable = <T extends Record<string, any>>(body: T): Partial<T> => {
  const clean: Record<string, any> = { ...body };
  IMMUTABLE_FIELDS.forEach((field) => delete clean[field]);
  return clean as Partial<T>;
};

/**
 * Confirm a referenced document belongs to the caller's tenant before linking
 * to it, so a cross-tenant id cannot be attached (and later leaked by populate).
 * Returns true when the ref is absent - callers decide whether it is required.
 */
export const refBelongsToTenant = async (
  model: mongoose.Model<any>,
  refId: unknown,
  tenantId: string | mongoose.Types.ObjectId | undefined
): Promise<boolean> => {
  if (!refId) return true;
  if (!tenantId) return false;
  if (!mongoose.Types.ObjectId.isValid(String(refId))) return false;

  const doc = await model.findById(refId).select('tenantId').lean<{ tenantId?: mongoose.Types.ObjectId }>();
  return !!doc && doc.tenantId?.toString() === tenantId.toString();
};

/**
 * Turn an update body into a Mongo update document where an explicit `null` or empty string
 * CLEARS the field ($unset) instead of being ignored. Needed so edit forms can remove an
 * optional value (phone, grade, notes...). Required fields still fail schema validation
 * (runValidators) when cleared. Undefined values are skipped (field untouched).
 */
export const clearableUpdate = (body: Record<string, any>): Record<string, any> => {
  const $set: Record<string, any> = {};
  const $unset: Record<string, ''> = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (value === undefined) continue;
    if (value === null || (typeof value === 'string' && value.trim() === '')) $unset[key] = '';
    else $set[key] = value;
  }
  return {
    ...(Object.keys($set).length ? { $set } : {}),
    ...(Object.keys($unset).length ? { $unset } : {}),
  };
};
