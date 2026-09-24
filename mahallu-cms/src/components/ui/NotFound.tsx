import { useNavigate } from 'react-router-dom';
import { FiCompass } from 'react-icons/fi';
import Button from './Button';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/constants/routes';

/*
 * `<Routes>` renders nothing when no path matches, so a mistyped or retired
 * URL used to leave an empty white document — indistinguishable from a crash.
 * This is the catch-all that says so plainly and offers a way back.
 */
export default function NotFound() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const home = !user
    ? ROUTES.LOGIN
    : user.role === 'member'
      ? ROUTES.MEMBER.OVERVIEW
      : ROUTES.DASHBOARD;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <FiCompass className="mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-base font-semibold text-foreground">This page doesn’t exist</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The link may be out of date, or the page may have been moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => navigate(home, { replace: true })}>
          {user ? 'Go to dashboard' : 'Go to sign in'}
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </div>
  );
}
