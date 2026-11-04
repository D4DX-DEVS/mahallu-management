import { useState, type FormEvent } from 'react';
import { FiKey, FiLock } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import { PASSWORD_HINT, isStrongPassword } from '@/features/users/credentialRules';

/**
 * Choose your own password. Shown on the Security page; for an account whose password an administrator
 * issued, the page also asks for it up front. The server ends every other session of the account and
 * hands this one a fresh token, so nobody is signed out by doing this.
 */
export default function ChangePasswordCard() {
  const { user, setUser } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword) return setError('Please enter your current password.');
    if (!isStrongPassword(newPassword)) return setError(PASSWORD_HINT);
    if (newPassword === currentPassword) return setError('Please choose a password different from the current one.');
    if (newPassword !== confirmPassword) return setError('The two new passwords do not match.');

    setSaving(true);
    setError('');
    try {
      await authService.changePassword(currentPassword, newPassword);
      if (user) setUser({ ...user, passwordResetRequired: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed. Your other sessions have been signed out.');
    } catch (err) {
      setError(errorMessage(err, { action: 'change your password' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex gap-3">
        <FiKey className="mt-1 h-5 w-5 text-primary-600" aria-hidden="true" />
        <div className="w-full">
          <h2 className="font-semibold text-foreground">Change password</h2>
          <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
            Your password is stored securely and can&apos;t be viewed by anyone, including administrators. They can only
            reset it.
          </p>

          {user?.passwordResetRequired && (
            <Alert variant="warning" title="Please choose your own password" className="mt-3">
              You signed in with a password an administrator issued. Choose one only you know. Use the issued password as
              your current password below.
            </Alert>
          )}
          {error && (
            <Alert variant="error" title="Couldn't change the password" className="mt-3">
              {error}
            </Alert>
          )}

          <form onSubmit={submit} className="mt-4 grid max-w-xl grid-cols-1 gap-4" noValidate>
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              helperText={PASSWORD_HINT}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <div>
              <Button type="submit" icon={<FiLock />} isLoading={saving} loadingText="Saving">
                Change password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Card>
  );
}
