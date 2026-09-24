import { useState, useEffect, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  FiRefreshCw,
  FiUser,
  FiHome,
  FiBookOpen,
  FiClipboard,
  FiChevronRight,
  FiLock,
  FiShield,
  FiUsers,
  FiBarChart2,
  FiPhone,
} from 'react-icons/fi';
import { FaMosque } from 'react-icons/fa';
import { authService, AccountOption, AuthResponse } from '@/services/authService';
import { initAndSubscribe } from '@/services/oneSignalService';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';
import { errorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

/* Login is India-only, so the country code is fixed and never typed by the
   user - the field itself holds the bare 10-digit national number. */
const PHONE_COUNTRY_CODE = '+91';
const PHONE_LENGTH = 10;

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'Enter a 10-digit mobile number'),
});

const codeSchema = z.object({
  code: z.string().max(200, 'Please keep the code to 200 characters or less.').length(6, 'Enter the 6-digit code'),
});

type PhoneFormData = z.infer<typeof phoneSchema>;
type CodeFormData = z.infer<typeof codeSchema>;

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
  /* The one-time passcode is never rendered in a production build. It used to
     appear on screen whenever the API returned it, putting a live credential in
     the DOM of the shipping bundle. */
  const [devOTP, setDevOTP] = useState<string | null>(null);
  const showDevOTP = import.meta.env.DEV && devOTP;
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [preAuthToken, setPreAuthToken] = useState('');

  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
  });

  const phoneField = phoneForm.register('phone');

  /* Strip everything but digits before react-hook-form reads the event, so a
     pasted "+91 98765 43210" or "(98765) 43210" lands as the 10 national digits
     rather than failing validation. A pasted 91 prefix is dropped rather than
     truncated - that is why the cap lives here and not in maxLength, which the
     browser would apply to the raw paste first. */
  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    let digits = event.target.value.replace(/\D/g, '');
    if (digits.length > PHONE_LENGTH && digits.startsWith('91')) {
      digits = digits.slice(2);
    }
    event.target.value = digits.slice(0, PHONE_LENGTH);
    phoneField.onChange(event);
  };

  const otpForm = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
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
      setError(errorMessage(err, { action: 'send otp. please try again' }));
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    await handleSendOTP({ phone });
  };

  const handleVerifyOTP = async (data: CodeFormData) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await authService.verifyOTP({
        phone,
        otp: data.code,
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
      setError(errorMessage(err, { action: 'verify that code' }));
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
      setError(errorMessage(err, { action: 'open that account' }));
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string, instituteName?: string | null) => {
    switch (role) {
      case 'member':
        return 'Member';
      case 'mahall':
        return 'Mahallu admin';
      case 'survey':
        return 'Survey admin';
      case 'institute':
        return instituteName ? `Institute admin — ${toTitleCase(instituteName)}` : 'Institute admin';
      case 'super_admin':
        return 'Super admin';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'member':
        return <FiUser className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      case 'mahall':
        return <FiHome className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      case 'survey':
        return <FiClipboard className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      case 'institute':
        return <FiBookOpen className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
      default:
        return <FiUser className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-primary-50 p-4 py-10 lg:p-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl bg-card shadow-[0_30px_70px_-25px_rgba(21,128,61,0.35)] lg:grid-cols-2">
        {/* Promo panel — mirrors the live marketing side, hidden below lg */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-950 via-primary-900 to-emerald-900 p-10 text-white lg:flex">
          <div
            className="pointer-events-none absolute right-10 top-10 h-40 w-40 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
            aria-hidden="true"
          />
          <FaMosque
            className="pointer-events-none absolute -bottom-6 -right-6 h-56 w-56 text-white/5"
            aria-hidden="true"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
                <img src={LOGO_PATH} alt="" aria-hidden="true" className="h-full w-full object-contain" />
              </span>
              <div>
                <p className="text-lg font-bold leading-tight">
                  <span className="text-primary-300">{BRAND_ACCENT}</span> {BRAND_REST.join(' ')}
                </p>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-white/60">MANAGEMENT SUITE</p>
              </div>
            </div>

            <span className="mt-10 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary-200">
              MODERN ADMIN EXPERIENCE
            </span>

            <h2 className="mt-6 text-3xl font-bold leading-tight sm:text-4xl">
              A cleaner control center for your <span className="text-primary-300">Mahallu</span> operations.
            </h2>

            <p className="mt-4 max-w-sm text-sm text-white/70">
              Sign in to manage members, services, finance, and institute operations from one streamlined workspace.
            </p>
          </div>

          <div className="relative flex flex-nowrap gap-3 text-[11px] font-medium text-white/80">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-primary-300">
                <FiUsers className="h-3.5 w-3.5" />
              </span>
              Member Management
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-primary-300">
                <FiBarChart2 className="h-3.5 w-3.5" />
              </span>
              Financial Control
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-primary-300">
                <FiShield className="h-3.5 w-3.5" />
              </span>
              Secure &amp; Reliable
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="text-center">
              <img src={LOGO_PATH} alt="" aria-hidden="true" className="mx-auto h-14 w-14 object-contain" />
              <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-primary">• WELCOME BACK •</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {step === 'otp'
                  ? 'Enter verification code.'
                  : step === 'select'
                    ? 'Choose an account.'
                    : 'Sign in to continue.'}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {step === 'phone' &&
                  'Use your phone number to receive a one-time passcode and access the admin workspace.'}
                {step === 'otp' && (
                  <>
                    We sent a 6-digit code to{' '}
                    <span className="font-medium text-foreground">
                      {PHONE_COUNTRY_CODE} {phone}
                    </span>
                    .
                  </>
                )}
                {step === 'select' && 'This number has more than one account. Pick one to continue.'}
              </p>
            </div>

            {error && (
              <Alert variant="error" className="mt-6">
                {error}
              </Alert>
            )}

            <div className="mt-6">
              {step === 'phone' ? (
                <form onSubmit={phoneForm.handleSubmit(handleSendOTP)} className="space-y-4">
                  <Input
                    label="Phone Number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    autoFocus
                    pattern="[0-9]{10}"
                    {...phoneField}
                    onChange={handlePhoneChange}
                    error={phoneForm.formState.errors.phone?.message}
                    placeholder="Enter your phone number"
                    required
                    icon={<FiPhone className="h-4 w-4" />}
                  />

                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <FiShield className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                    <span>A six-digit OTP will be sent to your registered phone number for secure sign-in.</span>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary-600 to-primary-400 hover:from-primary-700 hover:to-primary-500"
                    icon={<FiLock />}
                    isLoading={isSendingOTP}
                    loadingText="Sending"
                  >
                    Send OTP
                  </Button>
                </form>
              ) : step === 'select' ? (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.userId}
                      type="button"
                      onClick={() => handleSelectAccount(account.userId)}
                      disabled={isLoading}
                      className="group flex w-full items-center gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                        {getRoleIcon(account.role)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {getRoleLabel(account.role, account.instituteName)}
                        </span>
                        {account.tenantName && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {toTitleCase(account.tenantName)}
                          </span>
                        )}
                      </span>
                      <FiChevronRight
                        className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  ))}

                  <Button type="button" variant="ghost" onClick={handleBackToPhone} className="w-full">
                    Use a different number
                  </Button>
                </div>
              ) : (
                <form onSubmit={otpForm.handleSubmit(handleVerifyOTP)} className="space-y-4">
                  {showDevOTP && (
                    <Alert variant="info" title="Development build">
                      Code: <span className="font-mono font-semibold tracking-widest">{devOTP}</span>
                    </Alert>
                  )}

                  <Input
                    label="Verification code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    {...otpForm.register('code')}
                    error={otpForm.formState.errors.code?.message}
                    placeholder="000000"
                    required
                    className="text-center font-mono text-lg tracking-widest"
                  />

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={handleBackToPhone}
                      className="rounded-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Change number
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={countdown > 0 || isSendingOTP}
                      className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {countdown > 0 ? (
                        <>Resend in {countdown}s</>
                      ) : (
                        <>
                          <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
                          Resend code
                        </>
                      )}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    isLoading={isLoading}
                    loadingText="Verifying"
                  >
                    Verify and sign in
                  </Button>
                </form>
              )}
            </div>

            <div className="mt-8 space-y-3 border-t border-border pt-5 text-center">
              <p className="text-xs text-muted-foreground">Secured &amp; trusted</p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <FiLock className="h-3.5 w-3.5" aria-hidden="true" />
                  Your data is protected
                </span>
                <span>
                  Powered by{' '}
                  <a
                    href="https://d4dx.co/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    D4DX Innovations LLP
                  </a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
