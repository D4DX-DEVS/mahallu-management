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
      <h3 className="text-sm sm:text-base font-semibold text-foreground">Enabled Modules</h3>
      <p className="mt-1 text-xs sm:text-sm text-gray-500">
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
                'flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors',
                'disabled:opacity-60',
                enabled
                  ? 'border-primary-200 bg-primary-50 text-primary-900'
                  : 'border-gray-200 bg-white text-gray-500',
              ].join(' ')}
            >
              <span className="text-xs sm:text-sm font-medium leading-tight break-words">
                {MODULE_LABELS[key]}
              </span>
              <span
                className={[
                  'h-4 w-7 flex-shrink-0 rounded-full p-0.5 transition-colors',
                  enabled ? 'bg-primary-600' : 'bg-gray-300',
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
