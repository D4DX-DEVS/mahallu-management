/** What a new Mahall (tenant) or demo request can be. Values are what the API stores. */
export const TENANT_TYPE_OPTIONS = [
  { value: 'mahallu', label: 'Mahallu' },
  { value: 'juma_masjid', label: 'Juma Masjid' },
] as const;

export type TenantType = (typeof TENANT_TYPE_OPTIONS)[number]['value'];

/** Plan-style types on records created before the options above existed. Never offered for new records. */
export type LegacyTenantType = 'standard' | 'premium' | 'enterprise';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** The label for a stored type, including the legacy ones. */
export const tenantTypeLabel = (type?: string | null): string => {
  if (!type) return '';
  return TENANT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? capitalize(type);
};

/**
 * Options for editing an existing record: the two current types, plus the record's own legacy
 * type so the dropdown can still show what is stored.
 */
export const tenantTypeOptionsFor = (current?: string | null): Array<{ value: string; label: string }> => {
  const options: Array<{ value: string; label: string }> = TENANT_TYPE_OPTIONS.map((o) => ({ ...o }));
  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: tenantTypeLabel(current) });
  }
  return options;
};
