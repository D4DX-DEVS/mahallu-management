import Card from '@/components/ui/Card';
import { MAHALL_DEFAULTS, PermissionFlag } from '@/utils/permissions';

export const PERMISSION_GROUPS: {
  title: string;
  description: string;
  items: { key: PermissionFlag; label: string; help: string; risky?: boolean }[];
}[] = [
  {
    title: 'Receipts and payments',
    description: 'Who can change money records',
    items: [
      { key: 'canCancelReceipts', label: 'Cancel receipts', help: 'Mark a wrong receipt as cancelled with a reason. The receipt number stays on record.' },
      { key: 'canDeleteReceipts', label: 'Permanently delete receipts', help: 'Removes a receipt for good. Most mahallus keep this switched off so every receipt can be audited.', risky: true },
      { key: 'canApprovePayments', label: 'Approve member payment requests', help: 'Accept or reject payments that members submit from the app.' },
    ],
  },
  {
    title: 'Daily cash',
    description: 'Closing the day safely, with a second person checking',
    items: [
      { key: 'canCloseCashDay', label: 'Close the day', help: 'Count the cash and submit the day closing. Also lets them manage collectors.' },
      { key: 'canVerifyCashDay', label: 'Verify or reopen a closing', help: 'Check someone else\'s closing. A person can never verify their own count.' },
    ],
  },
  {
    title: 'Campaigns and accounts',
    description: 'Special collections and the financial year',
    items: [
      { key: 'canManageCampaigns', label: 'Manage campaigns', help: 'Create and edit Fitr, Udhiya, Ramadan and building fund campaigns.' },
      { key: 'canManagePeriods', label: 'Manage financial periods', help: 'Open, close and lock accounting periods.' },
    ],
  },
];

export type PermissionValues = Partial<Record<PermissionFlag, boolean>>;

interface Props {
  values: PermissionValues;
  onChange: (key: PermissionFlag, value: boolean) => void;
}

/** Plain-language toggles for the granular permission flags (mahall users). */
export default function PermissionsSection({ values, onChange }: Props) {
  return (
    <Card>
      <h2 className="mb-0.5 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">What this person can do</h2>
      <p className="mb-4 text-xs text-[#7B8983] dark:text-surface-muted">
        Fine-grained controls on top of the access above. A switch that was never touched follows the standard setting for mahall admins, shown as "standard".
      </p>
      <div className="space-y-5">
        {PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.title}>
            <legend className="text-xs font-bold text-[#3A4741] dark:text-surface-text">{g.title} <span className="font-normal text-[#7B8983]">- {g.description}</span></legend>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {g.items.map((it) => {
                const checked = values[it.key] ?? MAHALL_DEFAULTS[it.key];
                const touched = values[it.key] !== undefined;
                return (
                  <label key={it.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:bg-mint/40 dark:border-surface-border dark:hover:bg-surface-hover">
                    <input type="checkbox" checked={checked} onChange={(e) => onChange(it.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#3A4741] dark:text-surface-text">
                        {it.label}
                        {!touched && <span className="ml-1.5 text-[12px] font-normal text-[#98A59F]">standard</span>}
                        {it.risky && <span className="ml-1.5 text-[12px] font-semibold text-[#B3261E]">sensitive</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#6A7771] dark:text-surface-muted">{it.help}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Card>
  );
}
