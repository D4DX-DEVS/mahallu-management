import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiPhone, FiRefreshCw, FiUser, FiHome, FiBookOpen, FiClipboard, FiChevronRight } from 'react-icons/fi';
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-0 py-0 sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.24),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.14),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_45%,#cbd5e1_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_22%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#111827_100%)]" />
        <div className="absolute left-[8%] top-[12%] h-44 w-44 rounded-full border border-white/40 bg-white/20 blur-3xl dark:border-white/10 dark:bg-white/5" />
        <div className="absolute bottom-[10%] right-[8%] h-60 w-60 rounded-full bg-primary-300/20 blur-3xl dark:bg-primary-500/10" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-stretch sm:min-h-[calc(100vh-3rem)] sm:items-center">
        <div className="grid w-full overflow-hidden rounded-none border-0 bg-white/72 shadow-none backdrop-blur-2xl dark:bg-slate-950/72 sm:rounded-[32px] sm:border sm:border-white/50 sm:shadow-[0_32px_120px_rgba(15,23,42,0.18)] sm:dark:border-white/10 lg:grid-cols-[1.08fr,0.92fr]">
          <section className="relative hidden overflow-hidden lg:flex lg:min-h-[760px] lg:flex-col lg:justify-start lg:p-10 xl:p-12">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.86)),radial-gradient(circle_at_top,rgba(20,184,166,0.22),transparent_34%)]" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center gap-4 rounded-[2rem] border border-white/10 bg-white/10 px-6 py-5 text-white/85 backdrop-blur-sm">
                <img src={LOGO_PATH} alt={BRAND_NAME} className="h-16 w-16 rounded-2xl object-contain" />
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-white/45">Management Suite</p>
                  <p className="mt-2 text-3xl font-semibold text-white xl:text-4xl">{BRAND_NAME}</p>
                  <p className="mt-1 text-sm text-slate-300">Mahallu administration platform</p>
                </div>
              </div>

              <div className="mt-24 max-w-xl xl:mt-28">
                <p className="text-sm font-semibold uppercase tracking-[0.34em] text-primary-300">Modern admin experience</p>
                <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-white xl:text-6xl">
                  A cleaner control center for your Mahallu operations.
                </h1>
                <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
                  Sign in to manage members, services, finance, and institute operations from one streamlined workspace.
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="w-full max-w-md">
              <div className="mb-6 text-center sm:mb-8 lg:text-left">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-100 bg-white/80 shadow-lg shadow-primary-500/10 dark:border-white/10 dark:bg-white/5 sm:mb-5 sm:h-18 sm:w-18 sm:rounded-[1.75rem] lg:mx-0">
                  <img src={LOGO_PATH} alt={BRAND_NAME} className="h-9 w-9 object-contain sm:h-11 sm:w-11" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary-600 dark:text-primary-400">Welcome back</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:mt-3 sm:text-3xl lg:text-4xl">
                  Sign in to continue.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400 sm:mt-3">
                  Use your phone number to receive a one-time passcode and access the admin workspace.
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <div className="rounded-2xl border border-white/60 bg-white/78 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/72 sm:rounded-[28px] sm:p-6">
                {step === 'phone' ? (
                  <form onSubmit={phoneForm.handleSubmit(handleSendOTP)} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <Input
                      label="Phone Number"
                      type="tel"
                      {...phoneForm.register('phone')}
                      error={phoneForm.formState.errors.phone?.message}
                      placeholder="Enter your phone number"
                      required
                      icon={<FiPhone className="h-5 w-5" />}
                      className="h-12 rounded-2xl border-white/70 bg-slate-50/90 dark:bg-slate-950/55"
                    />

                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      A six-digit OTP will be sent to your registered phone number for secure sign-in.
                    </div>

                    <Button type="submit" className="h-12 w-full rounded-2xl text-base shadow-lg shadow-primary-500/20" isLoading={isSendingOTP}>
                      <FiLock className="mr-2 h-4 w-4" />
                      Send OTP
                    </Button>
                  </form>
                ) : step === 'select' ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                      <p className="text-base font-semibold">Multiple accounts found</p>
                      <p className="mt-1 text-blue-700/80 dark:text-blue-200/80">
                        Select the account you want to sign in with.
                      </p>
                    </div>

                    {accounts.map((account) => (
                      <button
                        key={account.userId}
                        type="button"
                        onClick={() => handleSelectAccount(account.userId)}
                        disabled={isLoading}
                        className="group w-full rounded-xl border border-slate-200 bg-white/70 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50/70 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-500 dark:hover:bg-primary-950/25 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:p-4"
                      >
                        <div className="flex flex-row items-center gap-3 sm:gap-4">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 transition-colors group-hover:bg-primary-200 dark:bg-primary-900/40 dark:group-hover:bg-primary-900/60 sm:h-12 sm:w-12 sm:rounded-2xl">
                            {getRoleIcon(account.role)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white sm:text-base">
                              {getRoleLabel(account.role, account.instituteName)}
                            </p>
                            {account.tenantName && (
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
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
                      className="w-full pt-2 text-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    >
                      ← Back to login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={otpForm.handleSubmit(handleVerifyOTP)} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                      <p className="text-base font-semibold">OTP sent</p>
                      <p className="mt-1 text-blue-700/80 dark:text-blue-200/80">
                        We&apos;ve sent a 6-digit verification code to <span className="font-mono font-medium">{phone}</span>
                      </p>
                    </div>

                    {devOTP && (
                      <div className="mb-4 rounded-2xl border-2 border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-950/25 dark:text-green-200 animate-in fade-in slide-in-from-top-2 duration-300">
                        <p className="mb-1 text-base font-bold">Development mode</p>
                        <p className="mb-2 text-sm">Your OTP code is:</p>
                        <div className="flex items-center justify-center">
                          <p className="rounded-xl border-2 border-green-400 bg-white px-6 py-3 font-mono text-3xl font-bold tracking-widest dark:border-green-600 dark:bg-slate-900">
                            {devOTP}
                          </p>
                        </div>
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
                      className="h-14 rounded-2xl bg-slate-50/90 text-center font-mono text-3xl tracking-[0.45em] dark:bg-slate-950/55"
                    />

                    <div className="flex items-center justify-between pt-2 text-sm">
                      <button
                        type="button"
                        onClick={handleBackToPhone}
                        className="font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
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

                    <Button type="submit" className="h-12 w-full rounded-2xl text-base shadow-lg shadow-primary-500/20" isLoading={isLoading}>
                      <FiLock className="mr-2 h-4 w-4" />
                      Verify & Sign In
                    </Button>
                  </form>
                )}
              </div>

              <div className="mt-6 text-center lg:text-left">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  Powered by{' '}
                  <a
                    href="https://d4dx.co/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline dark:text-primary-400"
                  >
                    D4DX Innovations LLP
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

