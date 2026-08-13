import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  FiLock,
  FiPhone,
  FiRefreshCw,
  FiUser,
  FiHome,
  FiBookOpen,
  FiClipboard,
  FiChevronRight,
  FiShield,
  FiUsers,
  FiBarChart2,
} from 'react-icons/fi';
import { authService, AccountOption, AuthResponse } from '@/services/authService';
import { initAndSubscribe } from '@/services/oneSignalService';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';

const phoneSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type PhoneFormData = z.infer<typeof phoneSchema>;
type OTPFormData = z.infer<typeof otpSchema>;

const HIGHLIGHTS = [
  { icon: FiUsers, title: 'Member', subtitle: 'Management' },
  { icon: FiBarChart2, title: 'Financial', subtitle: 'Control' },
  { icon: FiShield, title: 'Secure &', subtitle: 'Reliable' },
];

// Brand name renders as "<accent>Mahal</accent> Connect" on the promo panel.
const [BRAND_ACCENT, ...BRAND_REST] = BRAND_NAME.split(' ');

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [step, setStep] = useState<'phone' | 'otp' | 'select'>('phone');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devOTP, setDevOTP] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [preAuthToken, setPreAuthToken] = useState('');

  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
  });

  const otpForm = useForm<OTPFormData>({
    resolver: zodResolver(otpSchema),
  });

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (data: PhoneFormData) => {
    try {
      setIsSendingOTP(true);
      setError('');
      const response = await authService.sendOTP(data.phone);
      setPhone(data.phone);
      setOtpSent(true);
      setStep('otp');
      setCountdown(60); // 60 seconds cooldown

      // Show OTP in development mode
      if (response.otp) {
        setDevOTP(response.otp);
        console.log('OTP (dev mode):', response.otp);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    await handleSendOTP({ phone });
  };

  const handleVerifyOTP = async (data: OTPFormData) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await authService.verifyOTP({
        phone,
        otp: data.otp,
      });

      if ('requiresRoleSelection' in response && response.requiresRoleSelection) {
        setAccounts(response.accounts);
        setPreAuthToken(response.preAuthToken);
        setStep('select');
        return;
      }

      const auth = response as AuthResponse;
      setUser(auth.user);
      setToken(auth.token);

      // Subscribe this browser to OneSignal push (fire-and-forget, non-blocking)
      if (auth.user.role !== 'member') {
        initAndSubscribe()
          .then((playerId) => {
            if (playerId) {
              authService.registerDevice(playerId).catch(() => {});
            }
          })
          .catch(() => {});
      }

      navigate(auth.user.role === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtpSent(false);
    setError('');
    setDevOTP(null);
    setAccounts([]);
    setPreAuthToken('');
    otpForm.reset();
  };

  const handleSelectAccount = async (userId: string) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await authService.selectAccount(preAuthToken, userId);
      setUser(response.user);
      setToken(response.token);

      if (response.user.role !== 'member') {
        initAndSubscribe()
          .then((playerId) => {
            if (playerId) {
              authService.registerDevice(playerId).catch(() => {});
            }
          })
          .catch(() => {});
      }

      navigate(response.user.role === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to select account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string, instituteName?: string | null) => {
    switch (role) {
      case 'member': return 'Community Member';
      case 'mahall': return 'Mahallu Admin';
      case 'survey': return 'Survey Admin';
      case 'institute': return instituteName ? `Institute Admin — ${instituteName}` : 'Institute Admin';
      case 'super_admin': return 'Super Admin';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'member': return <FiUser className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      case 'mahall': return <FiHome className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      case 'survey': return <FiClipboard className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      case 'institute': return <FiBookOpen className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      default: return <FiUser className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
    }
  };

  return (
    // ponytail: h-[100dvh] + overflow-hidden shell, only the form column scrolls
    <div className="grid h-[100dvh] w-full place-items-center overflow-hidden bg-gradient-to-br from-slate-100 via-white to-primary-50 p-0 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:p-6">
      <div className="grid h-full max-h-full w-full max-w-6xl overflow-hidden bg-white dark:bg-slate-950 sm:h-auto sm:max-h-full sm:rounded-[28px] sm:shadow-[0_30px_90px_rgba(15,23,42,0.14)] lg:grid-cols-[1.04fr,0.96fr]">
        {/* Promo panel */}
        <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_0%_105%,rgba(34,197,94,0.55),transparent_52%),radial-gradient(circle_at_75%_-10%,rgba(22,163,74,0.18),transparent_42%),linear-gradient(140deg,#03150e_0%,#062a1e_58%,#04241a_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          {/* dotted grid accent */}
          <div className="pointer-events-none absolute right-10 top-24 h-24 w-28 bg-[radial-gradient(rgba(255,255,255,0.35)_1.1px,transparent_1.1px)] bg-[length:14px_14px] opacity-40" />
          {/* mosque silhouette */}
          <svg
            viewBox="0 0 220 120"
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-1 right-0 h-40 w-[62%] text-white/[0.07]"
            fill="currentColor"
          >
            <path d="M96 120V54c0-4 3-7 3-12s-3-6-3-11 4-7 4-11 4 6 4 11-3 6-3 11 3 8 3 12v66H96z" />
            <path d="M132 120V72c0-16 12-28 26-28s26 12 26 28v48h-52zm-56 0V78c0-13 9-23 21-23s21 10 21 23v42H76z" />
            <path d="M40 120V88c0-9 6-16 14-16s14 7 14 16v32H40zm150 0V92c0-7 5-13 12-13s12 6 12 13v28h-24z" />
            <circle cx="158" cy="34" r="5" />
            <circle cx="97" cy="18" r="4" />
          </svg>

          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
              <img src={LOGO_PATH} alt={BRAND_NAME} className="h-10 w-10 object-contain" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">
                <span className="text-primary-400">{BRAND_ACCENT}</span>{' '}
                <span className="text-white">{BRAND_REST.join(' ')}</span>
              </p>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.32em] text-white/45">
                Management Suite
              </p>
            </div>
          </div>

          <div className="relative max-w-lg py-8">
            <span className="inline-flex rounded-full bg-primary-500/15 px-4 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-primary-300">
              Modern admin experience
            </span>
            <h1 className="mt-7 text-[2.6rem] font-bold leading-[1.1] tracking-tight xl:text-5xl">
              A cleaner control center for your{' '}
              <span className="text-primary-400">Mahallu</span> operations.
            </h1>
            <p className="mt-6 max-w-md text-[0.95rem] leading-7 text-slate-300">
              Sign in to manage members, services, finance, and institute operations from one
              streamlined workspace.
            </p>
          </div>

          <div className="relative flex flex-wrap gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, subtitle }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07]">
                  <Icon className="h-5 w-5 text-primary-400" />
                </div>
                <p className="text-sm font-medium leading-tight text-white/85">
                  {title}
                  <br />
                  {subtitle}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Auth panel */}
        <section className="flex min-h-0 flex-col justify-center overflow-y-auto bg-slate-50 px-5 py-8 dark:bg-slate-900/40 sm:px-10 sm:py-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:bg-slate-800">
                <img src={LOGO_PATH} alt={BRAND_NAME} className="h-10 w-10 object-contain" />
              </div>
              <p className="mt-5 text-[0.7rem] font-bold uppercase tracking-[0.28em] text-primary-600 dark:text-primary-400">
                <span className="mr-2 text-primary-400">•</span>
                Welcome back
                <span className="ml-2 text-primary-400">•</span>
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Sign in to continue.
              </h2>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                Use your phone number to receive a one-time passcode and access the admin workspace.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-900 sm:p-6">
              {step === 'phone' ? (
                <form onSubmit={phoneForm.handleSubmit(handleSendOTP)} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <Input
                    label="Phone Number"
                    type="tel"
                    {...phoneForm.register('phone')}
                    error={phoneForm.formState.errors.phone?.message}
                    placeholder="Enter your phone number"
                    required
                    icon={<FiPhone className="h-5 w-5" />}
                    className="h-12 rounded-xl"
                  />

                  <div className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-[0.8rem] leading-5 text-slate-600 dark:border-primary-900/50 dark:bg-primary-950/25 dark:text-slate-300">
                    <FiShield className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" />
                    <p>A six-digit OTP will be sent to your registered phone number for secure sign-in.</p>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-400 text-base font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-800 hover:to-primary-500"
                    isLoading={isSendingOTP}
                  >
                    <FiLock className="mr-2 h-4 w-4" />
                    Send OTP
                  </Button>
                </form>
              ) : step === 'select' ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Multiple accounts found. Pick one to continue.
                  </p>

                  {accounts.map((account) => (
                    <button
                      key={account.userId}
                      type="button"
                      onClick={() => handleSelectAccount(account.userId)}
                      disabled={isLoading}
                      className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-200 hover:border-primary-300 hover:bg-primary-50/60 hover:shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-500 dark:hover:bg-primary-950/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex flex-row items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 transition-colors group-hover:bg-primary-200 dark:bg-primary-900/40 dark:group-hover:bg-primary-900/60">
                          {getRoleIcon(account.role)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {getRoleLabel(account.role, account.instituteName)}
                          </p>
                          {account.tenantName && (
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {account.tenantName}
                            </p>
                          )}
                        </div>
                        <FiChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-primary-500" />
                      </div>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleBackToPhone}
                    className="w-full pt-1 text-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    ← Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={otpForm.handleSubmit(handleVerifyOTP)} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Code sent to{' '}
                    <span className="font-mono font-medium text-slate-900 dark:text-white">{phone}</span>
                  </p>

                  {devOTP && (
                    <div className="rounded-xl border border-primary-300 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-200 animate-in fade-in slide-in-from-top-2">
                      Dev mode code:{' '}
                      <span className="font-mono text-base font-bold tracking-widest">{devOTP}</span>
                    </div>
                  )}

                  <Input
                    label="Verification Code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    {...otpForm.register('otp', {
                      pattern: {
                        value: /^\d{6}$/,
                        message: 'OTP must be 6 digits',
                      },
                    })}
                    error={otpForm.formState.errors.otp?.message}
                    placeholder="000000"
                    required
                    icon={<FiLock className="h-5 w-5" />}
                    className="h-14 rounded-xl text-center font-mono text-2xl tracking-[0.4em]"
                  />

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={handleBackToPhone}
                      className="font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      ← Change number
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={countdown > 0 || isSendingOTP}
                      className="flex items-center gap-1.5 font-medium text-primary-600 transition-colors hover:text-primary-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-primary-400"
                    >
                      {countdown > 0 ? (
                        <>Resend in {countdown}s</>
                      ) : (
                        <>
                          <FiRefreshCw className="h-4 w-4" />
                          Resend code
                        </>
                      )}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-400 text-base font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-800 hover:to-primary-500"
                    isLoading={isLoading}
                  >
                    <FiLock className="mr-2 h-4 w-4" />
                    Verify &amp; Sign In
                  </Button>
                </form>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <span className="text-xs text-slate-400 dark:text-slate-500">Secured &amp; trusted</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1.5">
                <FiLock className="h-3.5 w-3.5" />
                Your data is protected
              </span>
              <span className="font-medium">
                Powered by{' '}
                <a
                  href="https://d4dx.co/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline dark:text-primary-400"
                >
                  D4DX Innovations LLP
                </a>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
