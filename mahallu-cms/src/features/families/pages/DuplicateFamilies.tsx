import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '@/components/ui/Avatar';
import { FiExternalLink, FiGitMerge, FiRefreshCw, FiX } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import Dropdown from '@/components/ui/Dropdown';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { familyService, DuplicateMatchItem } from '@/services/familyService';
import { toast } from '@/store/toastStore';
import { MergeFamilyDialog } from '../components/FamilyLifecycleDialogs';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

type Side = DuplicateMatchItem & { contactNo?: string };
type Pair = Awaited<ReturnType<typeof familyService.getDuplicates>>['pairs'][number];

const STORAGE_KEY = 'mahallu.dismissedDuplicateFamilies';
const pairKey = (p: Pair) => [p.a.id, p.b.id].sort().join('|');

const loadDismissed = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

function FamilyCell({ f }: { f: Side }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size={32} name={f.houseName} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">{f.houseName || 'Unnamed family'}</p>
        <p className="truncate text-xs text-[#5B6963] dark:text-surface-muted">
          {[f.mahallId, f.familyHead ? `Head: ${f.familyHead}` : undefined, f.contactNo].filter(Boolean).join(' · ') || ' '}
        </p>
      </div>
    </div>
  );
}

/** Families the API thinks were entered twice. Dismissing only hides a pair on this browser. */
export default function DuplicateFamilies() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  const [showDismissed, setShowDismissed] = useState(false);
  const [merge, setMerge] = useState<{ source: Side; target: Side } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await familyService.getDuplicates();
      setPairs(data.pairs || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "We couldn't check for duplicate families. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = (next: string[]) => {
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode: the dismissal lasts until the page is closed */
    }
  };

  const visible = useMemo(() => pairs.filter((p) => showDismissed || !dismissed.includes(pairKey(p))), [pairs, dismissed, showDismissed]);
  const hiddenCount = pairs.filter((p) => dismissed.includes(pairKey(p))).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Duplicate families"
        description="Households that may have been entered twice. Open both to compare, then merge them or dismiss the pair."
        actions={
          <Button variant="secondary" onClick={load} isLoading={loading}>
            <FiRefreshCw className="h-3.5 w-3.5" />
            Check again
          </Button>
        }
      />

      <Alert tone="info">
        Merging moves everyone and all payments into the family you keep, and archives the other one. Dismiss only hides a pair for you on this device; it does not change any records.
      </Alert>

      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button className="mt-4" variant="secondary" onClick={load}>Retry</Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={pairs.length === 0 ? 'No duplicate families found' : 'You have reviewed every pair'}
              description={pairs.length === 0 ? 'Families with the same phone number, house name and head will show up here.' : 'Dismissed pairs are hidden. Show them again if you want to double-check.'}
            />
          </div>
        ) : (
          <ScrollX>
            <table className="w-full text-left text-[13px]" aria-label="Possible duplicate families">
              <thead>
                <tr className="border-b border-line text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:border-surface-border dark:text-surface-muted">
                  <th className="px-4 py-2.5">Family</th>
                  <th className="px-4 py-2.5">Possible match</th>
                  <th className="px-4 py-2.5">Why we think so</th>
                  <th className="px-4 py-2.5 text-right">What would you like to do?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft dark:divide-surface-border">
                {visible.map((p) => {
                  const key = pairKey(p);
                  const isDismissed = dismissed.includes(key);
                  return (
                    <tr key={key} className={isDismissed ? 'opacity-60' : undefined}>
                      <td className="px-4 py-3"><FamilyCell f={p.a} /></td>
                      <td className="px-4 py-3"><FamilyCell f={p.b} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(p.reasons || []).map((r) => (
                            <Badge key={r.reason} variant="warning" size="sm">{r.reasonText}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <a
                            href={ROUTES.FAMILIES.DETAIL(p.a.id)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => window.open(ROUTES.FAMILIES.DETAIL(p.b.id), '_blank', 'noopener')}
                            className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-bold text-primary-600 hover:bg-mint dark:text-brand-lime dark:hover:bg-surface-hover"
                          >
                            Open both <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                          <Dropdown
                            trigger={
                              <Button size="sm" variant="secondary">
                                <FiGitMerge className="h-3.5 w-3.5" />
                                Merge
                              </Button>
                            }
                            items={[
                              { label: `Keep ${p.a.houseName}, merge ${p.b.houseName} into it`, onClick: () => setMerge({ source: p.b, target: p.a }) },
                              { label: `Keep ${p.b.houseName}, merge ${p.a.houseName} into it`, onClick: () => setMerge({ source: p.a, target: p.b }) },
                            ]}
                          />
                          {isDismissed ? (
                            <Button size="sm" variant="ghost" onClick={() => persist(dismissed.filter((k) => k !== key))}>Show again</Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => persist([...dismissed, key])}>
                              <FiX className="h-3.5 w-3.5" />
                              Not a duplicate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollX>
        )}
        {!loading && !error && hiddenCount > 0 && (
          <div className="border-t border-line px-4 py-2.5 text-xs text-[#5B6963] dark:border-surface-border dark:text-surface-muted">
            {hiddenCount} dismissed pair{hiddenCount === 1 ? '' : 's'} hidden.{' '}
            <button type="button" className="font-semibold text-primary-600 underline dark:text-brand-lime" onClick={() => setShowDismissed((v) => !v)}>
              {showDismissed ? 'Hide them' : 'Show them'}
            </button>
          </div>
        )}
      </Card>

      <p className="text-xs text-[#7B8983] dark:text-surface-muted">
        Looking at one family? <Link to={ROUTES.FAMILIES.LIST} className="font-semibold text-primary-600 hover:underline dark:text-brand-lime">Go to all families</Link>
      </p>

      {merge && (
        <MergeFamilyDialog
          open
          familyId={merge.source.id}
          houseName={merge.source.houseName || 'this family'}
          initialTarget={{ id: merge.target.id, label: merge.target.houseName || 'Family', sublabel: merge.target.mahallId }}
          onClose={() => setMerge(null)}
          onDone={(msg) => {
            toast.success(msg || 'Families merged.');
            setMerge(null);
            load();
          }}
        />
      )}
    </div>
  );
}
