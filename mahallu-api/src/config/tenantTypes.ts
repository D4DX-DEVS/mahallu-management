/**
 * What kind of body a tenant is. New tenants (and demo requests) choose one of these.
 */
export const TENANT_TYPES = ['mahallu', 'juma_masjid'] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

/**
 * The plan-style values every tenant created before the types above existed still carries.
 * They stay valid on the model so those records keep loading and saving, but nothing new
 * can choose them.
 */
export const LEGACY_TENANT_TYPES = ['standard', 'premium', 'enterprise'] as const;
export type LegacyTenantType = (typeof LEGACY_TENANT_TYPES)[number];
