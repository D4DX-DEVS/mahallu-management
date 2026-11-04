import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { FiKey, FiUser } from 'react-icons/fi';
import Input from '@/components/ui/Input';
import { PASSWORD_HINT, USERNAME_HINT } from '../credentialRules';

export interface CredentialFormValues {
  username: string;
  password: string;
  confirmPassword: string;
}

/* Any user form: each has its own field list, and only username, password and confirmPassword are read. */
interface CredentialFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
}

/**
 * The sign-in section of a user-creation form. Username and password are separate things: the
 * username is who they are at the door, the password is what proves it. The password is hashed by the
 * server and can never be shown again; the person is asked to replace it at first sign-in.
 */
export default function CredentialFields({ register, errors }: CredentialFieldsProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1 text-foreground">Sign-in details</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        They can sign in with this username and password, or with their phone number. They will be asked to choose a
        new password the first time they sign in.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          icon={<FiUser className="h-4 w-4" />}
          {...register('username')}
          error={errors.username?.message as string | undefined}
          helperText={USERNAME_HINT}
          required
          placeholder="e.g. beypore.admin"
          className="md:col-span-2"
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          icon={<FiKey className="h-4 w-4" />}
          {...register('password')}
          error={errors.password?.message as string | undefined}
          helperText={PASSWORD_HINT}
          required
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          icon={<FiKey className="h-4 w-4" />}
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message as string | undefined}
          required
        />
      </div>
    </div>
  );
}
