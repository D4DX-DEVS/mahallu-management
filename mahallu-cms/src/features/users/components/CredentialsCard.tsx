import { useState } from 'react';
import { FiCheck, FiCopy, FiKey, FiUser } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Alert from '@/components/ui/Alert';
import StatusBadge from '@/components/ui/StatusBadge';
import { userService } from '@/services/userService';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import type { User } from '@/types';
import { PASSWORD_HINT, USERNAME_HINT, USERNAME_PATTERN, isStrongPassword, normalizeUsername } from '../credentialRules';

interface CredentialsCardProps {
  user: User;
  /** Whether the signed-in account may change this user's sign-in details (the API still decides). */
  canManage: boolean;
  /** Called with the saved user after a username change so the page can show it. */
  onUserChanged: (user: User) => void;
}

const ROLE_LABEL: Record<User['role'], string> = {
  super_admin: 'Super Admin',
  mahall: 'Mahallu admin',
  survey: 'Survey worker',
  institute: 'Institute admin',
  member: 'Member',
};

/**
 * Who this person is at the door, and what an administrator may do about it.
 *
 * The login identifier (username or phone) and the password are shown as two different things. The
 * password is never shown: the server keeps only a hash, so there is nothing to retrieve. The only way to
 * see a password is the one-time password a reset hands back, once, in the dialog below.
 */
export default function CredentialsCard({ user, canManage, onUserChanged }: CredentialsCardProps) {
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const memberAccount = user.role === 'member';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sign-in details</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {memberAccount
              ? 'Members sign in with a one-time code sent to their own phone, so they have no username or password.'
              : 'How this person signs in, and who they are in the system.'}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" icon={<FiUser />} onClick={() => setUsernameOpen(true)}>
              {user.username ? 'Change username' : 'Set username'}
            </Button>
            <Button variant="outline" icon={<FiKey />} onClick={() => setResetOpen(true)}>
              Reset password
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Login ID (username)</span>
          <p className="text-gray-900 dark:text-gray-100">
            {user.username ? (
              <span className="font-mono">{user.username}</span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{memberAccount ? 'Not used' : 'Not set - signs in with phone number'}</span>
            )}
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Phone number</span>
          <p className="text-gray-900 dark:text-gray-100">{user.phone}</p>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Password</span>
          <p className="text-gray-900 dark:text-gray-100">
            {memberAccount ? 'None' : '••••••••'}
            {!memberAccount && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Stored securely - it can&apos;t be viewed, only reset.</span>
            )}
          </p>
          {user.passwordResetRequired && (
            <p className="mt-1 text-xs text-warning">Issued by an administrator - they will be asked to choose their own at next sign-in.</p>
          )}
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Account status</span>
          <div className="mt-0.5">
            <StatusBadge status={user.status} />
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
          <p className="text-gray-900 dark:text-gray-100">{ROLE_LABEL[user.role] ?? user.role}</p>
        </div>
        {user.tenant && (
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Mahall</span>
            <p className="text-gray-900 dark:text-gray-100">{user.tenant.name}</p>
          </div>
        )}
      </div>

      {canManage && (
        <>
          <UsernameDialog
            key={`u-${usernameOpen}`}
            isOpen={usernameOpen}
            user={user}
            onClose={() => setUsernameOpen(false)}
            onSaved={(saved) => {
              setUsernameOpen(false);
              onUserChanged(saved);
            }}
          />
          <ResetPasswordDialog key={`r-${resetOpen}`} isOpen={resetOpen} user={user} onClose={() => setResetOpen(false)} onDone={() => onUserChanged({ ...user, passwordResetRequired: true })} />
        </>
      )}
    </Card>
  );
}

function UsernameDialog({
  isOpen,
  user,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}) {
  const [value, setValue] = useState(user.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const normalized = normalizeUsername(value);
  const removing = normalized === '' && !!user.username;

  const validate = (): string => {
    if (normalized === '') return removing ? '' : 'Please enter a username.';
    if (!USERNAME_PATTERN.test(normalized)) return USERNAME_HINT;
    if (normalized === user.username) return 'That is already their username.';
    return '';
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await userService.setUsername(user.id, normalized);
      toast.success(result.message);
      onSaved(result.data);
    } catch (err) {
      setError(errorMessage(err, { action: 'save the username' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title={user.username ? 'Change username' : 'Set username'}
      description={user.name}
      disableBackdropClose
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={saving} variant={removing ? 'danger' : 'primary'}>
            {removing ? 'Remove username' : 'Save username'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Username"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError('');
          }}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          helperText={USERNAME_HINT}
          error={error}
          placeholder="e.g. beypore.admin"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Changing the username changes what they type to sign in. Their password stays the same.
          {user.username ? ' Leave it empty to remove it - they can still sign in with their phone number.' : ''}
        </p>
      </div>
    </Modal>
  );
}

function ResetPasswordDialog({
  isOpen,
  user,
  onClose,
  onDone,
}: {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'generate' | 'choose'>('generate');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /* The one-time password lives only here, only until the dialog closes. */
  const [issued, setIssued] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (mode === 'choose') {
      if (!isStrongPassword(newPassword)) return setError(PASSWORD_HINT);
      if (newPassword !== confirmPassword) return setError('The two passwords do not match.');
    }
    setSaving(true);
    setError('');
    try {
      const result =
        mode === 'choose'
          ? await userService.resetPassword(user.id, { newPassword, confirmPassword })
          : await userService.resetPassword(user.id);
      setMessage(result.message);
      setIssued(result.data.temporaryPassword ?? '');
      setNewPassword('');
      setConfirmPassword('');
      onDone();
    } catch (err) {
      setError(errorMessage(err, { action: 'reset the password' }));
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy. Please select the password and copy it by hand.");
    }
  };

  const finished = issued !== null;
  const close = () => {
    if (saving) return;
    setIssued(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={finished ? 'Password reset' : 'Reset password'}
      description={user.name}
      disableBackdropClose
      footer={
        finished ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submit} isLoading={saving} disabled={!understood}>
              Reset password
            </Button>
          </>
        )
      }
    >
      {finished ? (
        <div className="space-y-4">
          <Alert variant="success" title="Done">
            {message}
          </Alert>
          {issued && (
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">Temporary password</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={issued}
                  aria-label="Temporary password"
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 font-mono text-base tracking-wide text-foreground"
                />
                <Button variant="outline" icon={copied ? <FiCheck /> : <FiCopy />} onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="mt-2 text-sm text-warning">
                This is the only time it will be shown. It has not been sent to {user.name} - please give it to them
                yourself. They will be asked to choose their own password when they sign in.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <Alert variant="error" title="Couldn't reset the password">
              {error}
            </Alert>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">New password</legend>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="radio" aria-label="Generate a temporary password" name="reset-mode" checked={mode === 'generate'} onChange={() => setMode('generate')} className="mt-1" />
              <span>
                Generate a temporary password <span className="text-gray-500 dark:text-gray-400">(recommended)</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="radio" aria-label="Type a password for them" name="reset-mode" checked={mode === 'choose'} onChange={() => setMode('choose')} className="mt-1" />
              <span>I will type a password for them</span>
            </label>
          </fieldset>
          {mode === 'choose' && (
            <div className="space-y-3">
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                helperText={PASSWORD_HINT}
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" aria-label="I understand this signs them out of every device" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} className="mt-1" />
            <span>
              I understand this signs {user.name} out of every device, and their old password will stop working.
            </span>
          </label>
        </div>
      )}
    </Modal>
  );
}
