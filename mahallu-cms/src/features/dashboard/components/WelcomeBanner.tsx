import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';

export default function WelcomeBanner() {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-primary-600 to-primary-800 px-5 py-5 text-white shadow-sm sm:px-7 sm:py-6">
      <svg
        className="pointer-events-none absolute -bottom-8 right-0 h-32 w-72 text-white/10 sm:h-40 sm:w-[26rem]"
        viewBox="0 0 400 140"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="0" y="92" width="400" height="48" />
        <rect x="16" y="58" width="20" height="82" />
        <rect x="364" y="58" width="20" height="82" />
        <circle cx="26" cy="52" r="9" />
        <circle cx="374" cy="52" r="9" />
        <rect x="86" y="72" width="34" height="20" />
        <rect x="280" y="72" width="34" height="20" />
        <path d="M150 92 V64 a50 50 0 0 1 100 0 v28 z" />
        <rect x="193" y="18" width="14" height="26" />
        <circle cx="200" cy="14" r="7" />
      </svg>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">Welcome back, {firstName} 👋</h1>
          <p className="mt-1 text-xs text-white/80 sm:text-sm">
            Here's what's happening in your community today.
          </p>
        </div>
        <div className="inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm sm:text-sm">
          {formatDate(new Date(), 'EEE, dd MMM yyyy')}
        </div>
      </div>
    </div>
  );
}
