import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiCompass, FiArrowLeft } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/constants/routes';

const ADMIN_LINKS = [
  { label: 'Families', to: ROUTES.FAMILIES.LIST },
  { label: 'Members', to: ROUTES.MEMBERS.LIST },
  { label: 'Collections', to: ROUTES.COLLECTIBLES.OVERVIEW },
  { label: 'Announcements', to: '/announcements' },
];

const MEMBER_LINKS = [
  { label: 'My Varisangya', to: ROUTES.MEMBER.VARISANGYA },
  { label: 'My NOCs', to: ROUTES.MEMBER.NOC_LIST },
  { label: 'My Payments', to: ROUTES.MEMBER.PAYMENTS },
];

export default function NotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const isMember = role === 'member';
  const home = isMember ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD;
  const links = isMember ? MEMBER_LINKS : ADMIN_LINKS;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-card dark:border-surface-border dark:bg-surface-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime">
          <FiCompass className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#7B8983] dark:text-surface-muted">Error 404</p>
        <h1 className="mt-1 text-2xl font-extrabold text-primary-700 dark:text-surface-text">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm text-[#5B6962] dark:text-surface-muted">
          <span className="break-all font-mono text-xs">{pathname}</span> doesn&apos;t exist or may have moved. Check the address, or pick up from one of the places below.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link to={home}>
            <Button>Go to dashboard</Button>
          </Link>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <FiArrowLeft aria-hidden="true" /> Go back
          </Button>
        </div>

        <div className="mt-6 border-t border-line-soft pt-4 dark:border-surface-border">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#98A59F] dark:text-surface-muted/70">Helpful links</p>
          <div className="flex flex-wrap justify-center gap-2">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-primary-700 transition-colors hover:bg-[#DCEBE3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:bg-brand-lime/15 dark:text-brand-lime"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
