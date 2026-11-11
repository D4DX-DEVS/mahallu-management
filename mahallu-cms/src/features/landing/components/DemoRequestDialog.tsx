import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiCheckCircle, FiSend } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import {
  demoRequestService,
  ZAAD_REQUEST_LABELS as LABELS,
  type DemoRequestInput,
} from '@/services/demoRequestService';
import { KERALA_DISTRICTS } from '@/constants/locations';
import { errorMessage } from '@/utils/errors';

/* Indian mobile numbers only, like sign-in: the field holds the bare 10 digits. */
const PHONE_LENGTH = 10;
const REQUIRED = 'ഈ വിവരം നൽകുക';
const PHONE_ERROR = '10 അക്ക മൊബൈൽ നമ്പർ നൽകുക';
const tooLong = (max: number) => `പരമാവധി ${max} അക്ഷരങ്ങൾ`;

const requiredText = (max: number, min = 1) => z.string().trim().min(min, REQUIRED).max(max, tooLong(max));
const optionalText = (max: number) => z.string().trim().max(max, tooLong(max)).optional();
const phone = z.string().trim().regex(/^[0-9]{10}$/, PHONE_ERROR);
const optionalPhone = z.union([z.literal(''), phone]).optional();

const schema = z.object({
  mahalluName: requiredText(150, 2),
  affiliationNumber: optionalText(100),
  location: requiredText(300),
  localUnit: requiredText(200),
  area: requiredText(200),
  district: z.string().min(1, REQUIRED),
  officeBearerName: requiredText(150),
  contactNumber: phone,
  whatsappNumber: phone,
  contactPersonName: optionalText(150),
  contactPersonPhone: optionalPhone,
  contactPersonWhatsapp: optionalPhone,
});

/* Not z.infer: with strictNullChecks off, zod's inferred keys all turn optional. */
type FormData = DemoRequestInput;
type PhoneField = 'contactNumber' | 'whatsappNumber' | 'contactPersonPhone' | 'contactPersonWhatsapp';

const DEFAULT_VALUES: Partial<FormData> = { district: '' };
const DISTRICT_OPTIONS = [{ value: '', label: 'ജില്ല തിരഞ്ഞെടുക്കുക...' }, ...KERALA_DISTRICTS];

interface DemoRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The landing page's "Request ZAAD" form. */
export default function DemoRequestDialog({ isOpen, onClose }: DemoRequestDialogProps) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  // Every opening starts from a clean form.
  useEffect(() => {
    if (isOpen) {
      reset(DEFAULT_VALUES);
      setSent(false);
      setError('');
    }
  }, [isOpen, reset]);

  /* Keep only digits, and drop a pasted "+91" prefix, before the form reads the value. */
  const phoneRegister = (field: PhoneField) => {
    const registration = register(field);
    return {
      ...registration,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        let digits = event.target.value.replace(/\D/g, '');
        if (digits.length > PHONE_LENGTH && digits.startsWith('91')) digits = digits.slice(2);
        event.target.value = digits.slice(0, PHONE_LENGTH);
        return registration.onChange(event);
      },
    };
  };

  const phoneProps = {
    type: 'tel',
    inputMode: 'numeric' as const,
    placeholder: '10 അക്ക മൊബൈൽ നമ്പർ',
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await demoRequestService.submit(data);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, { action: 'send your request' }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="font-landing"
      title={sent ? 'അപേക്ഷ ലഭിച്ചു' : 'ZAAD ആവശ്യപ്പെടുക'}
      description={sent ? undefined : 'നിങ്ങളുടെ മസ്ജിദ്/മഹല്ലിന്റെ വിവരങ്ങൾ നൽകുക. ഞങ്ങളുടെ ടീം നിങ്ങളെ ബന്ധപ്പെടും.'}
    >
      {sent ? (
        <div className="flex flex-col items-center py-4 text-center" role="status">
          <span className="lp-pop flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_0_10px_hsl(var(--accent)/0.4)]">
            <FiCheckCircle className="h-10 w-10" aria-hidden="true" />
          </span>
          <h3 className="mt-6 text-lg font-semibold text-foreground">നന്ദി! നിങ്ങളുടെ അപേക്ഷ ലഭിച്ചു.</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">ഞങ്ങളുടെ ടീം ഉടൻ നിങ്ങളെ ബന്ധപ്പെടും.</p>
          <Button className="mt-6 text-[13px]" onClick={onClose}>
            ശരി
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Input
            label={LABELS.mahalluName}
            autoComplete="organization"
            required
            error={errors.mahalluName?.message}
            {...register('mahalluName')}
          />
          <Input
            label={LABELS.affiliationNumber}
            error={errors.affiliationNumber?.message}
            {...register('affiliationNumber')}
          />
          <Input label={LABELS.location} required error={errors.location?.message} {...register('location')} />
          <Input
            label={LABELS.localUnit}
            required
            error={errors.localUnit?.message}
            {...register('localUnit')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={LABELS.area} required error={errors.area?.message} {...register('area')} />
            <Select
              label={LABELS.district}
              options={DISTRICT_OPTIONS}
              required
              error={errors.district?.message}
              {...register('district')}
            />
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <Input
              label={LABELS.officeBearerName}
              autoComplete="name"
              required
              error={errors.officeBearerName?.message}
              {...register('officeBearerName')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={LABELS.contactNumber}
                autoComplete="tel-national"
                required
                error={errors.contactNumber?.message}
                {...phoneProps}
                {...phoneRegister('contactNumber')}
              />
              <Input
                label={LABELS.whatsappNumber}
                required
                error={errors.whatsappNumber?.message}
                {...phoneProps}
                {...phoneRegister('whatsappNumber')}
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <Input
              label={LABELS.contactPersonName}
              error={errors.contactPersonName?.message}
              {...register('contactPersonName')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={LABELS.contactPersonPhone}
                error={errors.contactPersonPhone?.message}
                {...phoneProps}
                {...phoneRegister('contactPersonPhone')}
              />
              <Input
                label={LABELS.contactPersonWhatsapp}
                error={errors.contactPersonWhatsapp?.message}
                {...phoneProps}
                {...phoneRegister('contactPersonWhatsapp')}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="text-[13px]" onClick={onClose} disabled={isSubmitting}>
              റദ്ദാക്കുക
            </Button>
            <Button type="submit" className="text-[13px]" isLoading={isSubmitting} loadingText="അയയ്ക്കുന്നു…" icon={<FiSend />}>
              അയയ്ക്കുക
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
