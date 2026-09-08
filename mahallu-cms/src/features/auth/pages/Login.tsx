import { useState, useEffect, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  FiLock,
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
import Alert from '@/components/ui/Alert';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';
import { errorMessage } from '@/utils/errors';

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
        return instituteName ? `Institute admin — ${instituteName}` : 'Institute admin';
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
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <img src={LOGO_PATH} alt="" aria-hidden="true" className="mx-auto h-12 w-12 object-contain" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              Sign in to {BRAND_NAME}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We&rsquo;ll text a 6-digit code to your registered number.
            </p>
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
            {step === 'phone' ? (
              <form onSubmit={phoneForm.handleSubmit(handleSendOTP)} className="space-y-4">
                <Input
                  label="Phone number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  pattern="[0-9]{10}"
                  {...phoneField}
                  onChange={handlePhoneChange}
                  error={phoneForm.formState.errors.phone?.message}
                  placeholder="9876543210"
                  required
                  className="pl-12"
                  icon={
                    <span className="text-sm font-medium text-foreground">
                      {PHONE_COUNTRY_CODE}
                    </span>
                  }
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  isLoading={isSendingOTP}
                  loadingText="Sending"
                >
                  Send code
                </Button>
              </form>
            ) : step === 'select' ? (
              <div className="space-y-2">
                <p className="mb-3 text-sm text-muted-foreground">
                  This number has more than one account. Pick one to continue.
                </p>

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
                          {account.tenantName}
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
                <p className="text-sm text-muted-foreground">
                  Code sent to{' '}
                  <span className="font-medium text-foreground">
                    {PHONE_COUNTRY_CODE} {phone}
                  </span>
                </p>

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
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        Powered by{' '}
        <a
          href="https://d4dx.co/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          D4DX Innovations LLP
        </a>
      </footer>
    </div>
  );
}
