import { Card } from '@/components/ui';
import { MODULE_KEYS, MODULE_LABELS, ModuleKey } from '@/constants/modules';

interface ModuleFeatureTogglesProps {
  value: Record<string, boolean>;
  onChange: (features: Record<string, boolean>) => void;
  disabled?: boolean;
}

/**
 * Per-tenant module switches. Classification seeds these on the server; a super
 * admin can override any of them here. Unset keys count as enabled.
 */
export default function ModuleFeatureToggles({ value, onChange, disabled }: ModuleFeatureTogglesProps) {
  const toggle = (key: ModuleKey) => {
    onChange({ ...value, [key]: value[key] === false });
  };

  return (
    <Card>
      <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Enabled Modules</h2>
      <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">
        Defaults come from the Mahallu classification. Turn individual modules on or off here.
      </p>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
        {MODULE_KEYS.map((key) => {
          const enabled = value[key] !== false;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => toggle(key)}
              aria-pressed={enabled}
              className={[
                'flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 max-sm:min-h-10 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] disabled:opacity-60',
                enabled
                  ? 'border-mint-deep bg-mint text-primary-700 dark:border-brand-lime/20 dark:bg-brand-lime/10 dark:text-brand-lime'
                  : 'border-line bg-white text-[#7B8983] dark:border-surface-border dark:bg-surface-raised dark:text-surface-muted',
              ].join(' ')}
            >
              <span className="break-words text-xs font-semibold leading-tight">
                {MODULE_LABELS[key]}
              </span>
              <span
                className={[
                  'h-4 w-7 flex-shrink-0 rounded-full p-0.5 transition-colors',
                  enabled ? 'bg-primary-600 dark:bg-brand-lime' : 'bg-[#C9D6CF] dark:bg-surface-border-strong',
                ].join(' ')}
              >
                <span
                  className={[
                    'block h-3 w-3 rounded-full bg-white transition-transform',
                    enabled ? 'translate-x-3' : 'translate-x-0',
                  ].join(' ')}
                />
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
