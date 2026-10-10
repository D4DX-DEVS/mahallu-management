import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiCheckCircle, FiHome, FiPhone, FiMessageCircle, FiSend } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { demoRequestService, type DemoRequestInput } from '@/services/demoRequestService';
import { errorMessage } from '@/utils/errors';

/* Indian mobile numbers only, like sign-in: the field holds the bare 10 digits. */
const PHONE_LENGTH = 10;
const phoneSchema = (label: string) => z.string().trim().regex(/^[0-9]{10}$/, `Enter a 10-digit ${label}`);

const schema = z.object({
  mahalluName: z
    .string()
    .trim()
    .min(2, 'Enter your Mahallu name')
    .max(150, 'Please keep the name to 150 characters or less.'),
  contactNumber: phoneSchema('contact number'),
  whatsappNumber: phoneSchema('WhatsApp number'),
});

/* Not z.infer: with strictNullChecks off, zod's inferred keys all turn optional. */
type FormData = DemoRequestInput;
type PhoneField = 'contactNumber' | 'whatsappNumber';

interface DemoRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoRequestDialog({ isOpen, onClose }: DemoRequestDialogProps) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Every opening starts from a clean form.
  useEffect(() => {
    if (isOpen) {
      reset();
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
      size="sm"
      title={sent ? 'Request sent' : 'Request a demo'}
      description={sent ? undefined : 'Tell us about your Mahallu and we will call you to arrange a free demo.'}
    >
      {sent ? (
        <div className="flex flex-col items-center py-4 text-center" role="status">
          <span className="lp-pop flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_0_10px_hsl(var(--accent)/0.4)]">
            <FiCheckCircle className="h-10 w-10" aria-hidden="true" />
          </span>
          <h3 className="mt-6 text-lg font-semibold text-foreground">Thank you! Your request is in.</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Our team will call you on the number you gave, usually within a working day, to arrange your free demo.
          </p>
          <Button className="mt-6" onClick={onClose}>
            Done
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
            label="Mahallu name"
            placeholder="e.g. Beypore Juma Masjid Mahallu"
            autoComplete="organization"
            required
            icon={<FiHome />}
            error={errors.mahalluName?.message}
            {...register('mahalluName')}
          />
          <Input
            label="Mahallu contact number"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            autoComplete="tel-national"
            required
            icon={<FiPhone />}
            error={errors.contactNumber?.message}
            {...phoneRegister('contactNumber')}
          />
          <Input
            label="WhatsApp number"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit WhatsApp number"
            required
            icon={<FiMessageCircle />}
            error={errors.whatsappNumber?.message}
            {...phoneRegister('whatsappNumber')}
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} loadingText="Sending…" icon={<FiSend />}>
              Send request
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
