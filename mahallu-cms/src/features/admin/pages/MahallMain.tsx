import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiBuilding2Line,
  RiCoinsLine,
  RiDeleteBinLine,
  RiGraduationCapLine,
  RiInformationLine,
  RiMapPin2Line,
  RiShieldCheckLine,
} from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { tenantService } from '@/services/tenantService';
import { CLASSIFICATION_LABELS, TenantClassification } from '@/constants/modules';
import OptionTagsEditor from '../components/OptionTagsEditor';
import { useAuthStore } from '@/store/authStore';
import { Tenant } from '@/types/tenant';
import { formatDate, toTitleCase } from '@/utils/format';
import { getTenantId } from '@/utils/tenantHelper';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

type Grade = { name: string; amount: number };

interface SettingsDraft {
  varisangyaAmount: string;
  grades: Grade[];
  educationOptions: string[];
  areaOptions: string[];
}

const DEFAULT_GRADES: Grade[] = [
  { name: 'Grade A', amount: 100 },
  { name: 'Grade B', amount: 75 },
  { name: 'Grade C', amount: 50 },
  { name: 'Grade D', amount: 25 },
];
const DEFAULT_EDUCATION = ['Below SSLC', 'SSLC', 'Plus Two', 'Degree', 'Diploma', 'Post Graduation', 'Doctorate', 'MBBS'];
const DEFAULT_AREAS = ['Area A', 'Area B', 'Area C', 'Area D'];

function draftFromTenant(tenant: Tenant): SettingsDraft {
  return {
    varisangyaAmount: String(tenant.settings?.varisangyaAmount ?? 0),
    grades: tenant.settings?.varisangyaGrades ?? DEFAULT_GRADES,
    educationOptions: tenant.settings?.educationOptions ?? DEFAULT_EDUCATION,
    areaOptions: tenant.settings?.areaOptions ?? DEFAULT_AREAS,
  };
}

const SECTIONS = [
  { id: 'profile', label: 'Mahallu profile', icon: RiBuilding2Line },
  { id: 'varisangya', label: 'Varisangya', icon: RiCoinsLine },
  { id: 'education', label: 'Education options', icon: RiGraduationCapLine },
  { id: 'areas', label: 'Area options', icon: RiMapPin2Line },
] as const;

function SettingsSection({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        {aside}
      </div>
      <Card padding="lg">{children}</Card>
    </section>
  );
}

function Detail({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}

function CountPill({ count, noun }: { count: number; noun: string }) {
  return (
    <span className="flex-shrink-0 rounded-md bg-subtle px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
      {count} {noun}
      {count === 1 ? '' : 's'}
    </span>
  );
}

export default function MahallMain() {
  const { currentTenantId, user, isSuperAdmin } = useAuthStore();
  const tenantId = getTenantId(user, currentTenantId);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saved, setSaved] = useState<SettingsDraft | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  const fetchTenant = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setLoadError(null);
      const data = await tenantService.getById(tenantId);
      const next = draftFromTenant(data);
      setTenant(data);
      setSaved(next);
      setDraft(next);
    } catch (err: any) {
      setLoadError(loadErrorMessage(err, 'mahallu settings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchTenant();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const amountNumber = Number(draft?.varisangyaAmount);
  const amountError =
    draft && (draft.varisangyaAmount.trim() === '' || !Number.isFinite(amountNumber) || amountNumber < 0)
      ? 'Enter an amount of 0 or more'
      : undefined;
  const gradeError = draft?.grades.some((grade) => !grade.name.trim() || grade.amount < 0)
    ? 'Every grade needs a name and an amount of 0 or more'
    : undefined;

  // Closing the tab with unsaved edits asks first.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // Highlight the section in view. The page scrolls inside #main-content.
  useEffect(() => {
    if (!tenant) return;
    const root = document.getElementById('main-content');
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { root, rootMargin: '0px 0px -65% 0px' }
    );
    SECTIONS.forEach((section) => {
      const node = document.getElementById(section.id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [tenant]);

  const update = (patch: Partial<SettingsDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current));
  const updateGrade = (index: number, patch: Partial<Grade>) =>
    update({ grades: draft!.grades.map((grade, i) => (i === index ? { ...grade, ...patch } : grade)) });

  const save = async () => {
    if (!tenantId || !tenant || !draft) return;
    if (amountError || gradeError) {
      toast.error(amountError ?? gradeError!);
      return;
    }
    try {
      setSaving(true);
      await tenantService.update(tenantId, {
        settings: {
          ...tenant.settings,
          varisangyaAmount: amountNumber,
          varisangyaGrades: draft.grades.map((grade) => ({ ...grade, name: grade.name.trim() })),
          educationOptions: draft.educationOptions,
          areaOptions: draft.areaOptions,
        },
      });
      toast.success('Settings saved');
      await fetchTenant();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save settings' }));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <PageHeader
      title="Settings"
      description="Your mahallu's profile and the options used across families, members and collections."
      actions={
        tenant && (
          <Button onClick={save} isLoading={saving} loadingText="Saving" disabled={!isDirty}>
            Save changes
          </Button>
        )
      }
    />
  );

  if (loading) return <PageSkeleton variant="section" />;

  if (!tenantId) {
    return (
      <>
        {header}
        <EmptyState
          variant="info"
          entity="settings"
          title={isSuperAdmin ? 'Select a mahallu to manage' : 'No mahallu assigned'}
          description={
            isSuperAdmin
              ? 'Choose a mahallu from the tenant switcher in the header to view and edit its settings.'
              : 'Your account is not linked to a mahallu yet. Ask your administrator to assign one.'
          }
        />
      </>
    );
  }

  if (loadError || !tenant || !draft) {
    return (
      <>
        {header}
        <EmptyState
          variant="error"
          entity="settings"
          description={loadError ?? undefined}
          action={{ label: 'Try again', onClick: fetchTenant }}
        />
      </>
    );
  }

  const classification = (tenant as Tenant & { classification?: string }).classification;
  const initials = tenant.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <>
      {header}

      <div className="grid gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:gap-12">
        {/* ---- Section navigation ------------------------------------- */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-0 lg:self-start">
          <ul className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:px-0">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const active = activeSection === id;
              return (
                <li key={id} className="flex-shrink-0">
                  <a
                    href={`#${id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveSection(id);
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-subtle text-foreground' : 'text-muted-foreground hover:bg-subtle hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px]', active && 'text-primary')} aria-hidden="true" />
                    {label}
                  </a>
                </li>
              );
            })}
            <li className="flex-shrink-0 lg:mt-3 lg:border-t lg:border-border lg:pt-3">
              <Link
                to="/settings/security"
                className="flex h-9 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RiShieldCheckLine className="h-[18px] w-[18px]" aria-hidden="true" />
                Security
                <RiArrowRightUpLine className="ml-auto h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </nav>

        <div className="min-w-0 space-y-10">
          {/* ---- Profile ----------------------------------------------- */}
          <SettingsSection
            id="profile"
            title="Mahallu profile"
            description="Registration details. Contact platform support to change these."
          >
            <div className="flex flex-wrap items-center gap-4 border-b border-border pb-5">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-base font-semibold text-primary">
                {tenant.logo ? <img src={tenant.logo} alt="" className="h-full w-full object-cover" /> : initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">{toTitleCase(tenant.name)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border px-1.5 py-0.5 font-mono">{tenant.code}</span>
                  {classification && (
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                      {CLASSIFICATION_LABELS[classification as TenantClassification] ?? classification}
                    </span>
                  )}
                  <span>Since {formatDate(tenant.since)}</span>
                </div>
              </div>
              <StatusBadge status={tenant.status} />
            </div>
            <dl className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2 xl:grid-cols-3">
              <Detail label="Plan" value={<span className="capitalize">{tenant.type}</span>} />
              <Detail label="Location" value={tenant.location && toTitleCase(tenant.location)} />
              <Detail label="State" value={tenant.address?.state && toTitleCase(tenant.address.state)} />
              <Detail label="District" value={tenant.address?.district && toTitleCase(tenant.address.district)} />
              <Detail label="Local body" value={tenant.address?.lsgName && toTitleCase(tenant.address.lsgName)} />
              <Detail label="Village" value={tenant.address?.village && toTitleCase(tenant.address.village)} />
              <Detail label="Post office" value={tenant.address?.postOffice && toTitleCase(tenant.address.postOffice)} />
              <Detail label="PIN code" value={tenant.address?.pinCode} />
            </dl>
          </SettingsSection>

          {/* ---- Varisangya -------------------------------------------- */}
          <SettingsSection
            id="varisangya"
            title="Varisangya"
            description="The default contribution and the grades families can be placed in."
            aside={<CountPill count={draft.grades.length} noun="grade" />}
          >
            <div className="max-w-xs">
              <label htmlFor="varisangya-amount" className="text-sm font-medium text-foreground">
                Default amount
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <input
                  id="varisangya-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.varisangyaAmount}
                  onChange={(event) => update({ varisangyaAmount: event.target.value })}
                  aria-invalid={Boolean(amountError) || undefined}
                  aria-describedby="varisangya-amount-hint"
                  className="h-10 w-full rounded-lg border border-border bg-card pl-7 pr-3 text-sm tabular-nums text-foreground shadow-sm transition-colors focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 aria-[invalid=true]:border-destructive"
                />
              </div>
              <p id="varisangya-amount-hint" className={cn('mt-1.5 text-xs', amountError ? 'text-destructive' : 'text-muted-foreground')}>
                {amountError ?? 'Used when a family has no grade assigned.'}
              </p>
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <p className="text-sm font-medium text-foreground">Grades</p>
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[minmax(0,1fr)_9rem_2.5rem] gap-3 bg-subtle px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Grade name</span>
                  <span>Amount</span>
                  <span className="sr-only">Remove</span>
                </div>
                {draft.grades.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No grades. Every family pays the default amount.</p>
                )}
                {draft.grades.map((grade, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1fr)_9rem_2.5rem] items-center gap-3 border-t border-border px-3 py-2.5"
                  >
                    <input
                      aria-label={`Grade ${index + 1} name`}
                      value={grade.name}
                      onChange={(event) => updateGrade(index, { name: event.target.value })}
                      placeholder="e.g. Grade A"
                      aria-invalid={!grade.name.trim() || undefined}
                      className="h-9 w-full rounded-lg border border-transparent bg-transparent px-2.5 text-sm text-foreground transition-colors hover:border-border focus-visible:border-primary/60 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 aria-[invalid=true]:border-destructive"
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                      <input
                        aria-label={`Grade ${index + 1} amount`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={grade.amount}
                        onChange={(event) => updateGrade(index, { amount: parseFloat(event.target.value) || 0 })}
                        className="h-9 w-full rounded-lg border border-transparent bg-transparent pl-6 pr-2.5 text-sm tabular-nums text-foreground transition-colors hover:border-border focus-visible:border-primary/60 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => update({ grades: draft.grades.filter((_, i) => i !== index) })}
                      aria-label={`Remove ${grade.name || `grade ${index + 1}`}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              {gradeError && <p className="mt-2 text-xs text-destructive">{gradeError}</p>}
              <Button
                variant="ghost"
                size="sm"
                icon={<RiAddLine />}
                className="mt-3 text-primary hover:bg-primary/5 hover:text-primary"
                onClick={() =>
                  update({
                    grades: [...draft.grades, { name: `Grade ${String.fromCharCode(65 + draft.grades.length)}`, amount: 0 }],
                  })
                }
              >
                Add grade
              </Button>
            </div>
          </SettingsSection>

          {/* ---- Education --------------------------------------------- */}
          <SettingsSection
            id="education"
            title="Education options"
            description="Qualifications offered when recording a member's education."
            aside={<CountPill count={draft.educationOptions.length} noun="option" />}
          >
            <OptionTagsEditor
              values={draft.educationOptions}
              onChange={(educationOptions) => update({ educationOptions })}
              noun="education option"
              placeholder="e.g. SSLC"
            />
          </SettingsSection>

          {/* ---- Areas ------------------------------------------------- */}
          <SettingsSection
            id="areas"
            title="Area options"
            description="Localities used for family addresses and area-wise reports."
            aside={<CountPill count={draft.areaOptions.length} noun="area" />}
          >
            <OptionTagsEditor
              values={draft.areaOptions}
              onChange={(areaOptions) => update({ areaOptions })}
              noun="area"
              placeholder="e.g. North ward"
            />
          </SettingsSection>
        </div>
      </div>

      {/* ---- Unsaved-changes bar -------------------------------------- */}
      {isDirty && (
        <div className="sticky bottom-20 z-20 mt-8 animate-fade-in md:bottom-6">
          <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-md">
            <RiInformationLine className="h-5 w-5 flex-shrink-0 text-warning" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm font-medium text-foreground">You have unsaved changes</p>
            <Button variant="ghost" size="sm" onClick={() => setDraft(saved)} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={save} isLoading={saving} loadingText="Saving">
              Save changes
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

