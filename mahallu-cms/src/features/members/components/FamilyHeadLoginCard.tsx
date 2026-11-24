import { useState } from 'react';
import { FiCheck, FiCopy, FiEye, FiEyeOff, FiRefreshCw } from 'react-icons/fi';
import { RiWhatsappLine } from 'react-icons/ri';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Alert from '@/components/ui/Alert';
import { ROUTES } from '@/constants/routes';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import type { Member } from '@/types';

/** The message handed to the family head: where to sign in, and with what. */
const shareMessage = (username: string, password: string) =>
  [
    'ZAAD Mahallu sign-in details / ലോഗിൻ വിവരങ്ങൾ',
    `Website: ${window.location.origin}${ROUTES.LOGIN}`,
    `Username: ${username}`,
    `Password: ${password}`,
  ].join('\n');

/**
 * A family head's sign-in, for the Mahallu admin: the phone number they sign in with and the password
 * the Mahallu issued. Among members only the family head signs in, so this card is shown for heads only.
 *
 * The password is not loaded with the page. It is fetched the first time the admin asks to see, copy
 * or share it (the server logs each of those), and kept for as long as this page stays open.
 */
export default function FamilyHeadLoginCard({ member }: { member: Member }) {
  const [password, setPassword] = useState<string | null | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'username' | 'password' | 'message' | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const username = member.phone || '';
  const canSignIn = Boolean(member.phone) && member.status === 'active';

  /** The issued password, fetched once. Null when none is on record. */
  const loadPassword = async (): Promise<string | null> => {
    if (password !== undefined) return password;
    try {
      setBusy(true);
      setError(null);
      const details = await memberService.getCredentials(member.id);
      setPassword(details.password);
      return details.password;
    } catch (err) {
      setError(errorMessage(err, { action: 'load the sign-in details' }));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: 'username' | 'password' | 'message', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied((current) => (current === what ? null : current)), 2000);
    } catch {
      toast.error('Couldn’t copy. Select the text and copy it yourself.');
    }
  };

  const toggleVisible = async () => {
    if (visible) return setVisible(false);
    if ((await loadPassword()) !== null) setVisible(true);
  };

  const copyPassword = async () => {
    const value = await loadPassword();
    if (value) await copy('password', value);
  };

  const copyMessage = async () => {
    const value = await loadPassword();
    if (value) await copy('message', shareMessage(username, value));
  };

  const shareOnWhatsApp = async () => {
    const value = await loadPassword();
    if (!value) return;
    // Opens a chat with the family head's own number, the message typed in and waiting to be sent.
    const link = `https://wa.me/91${username}?text=${encodeURIComponent(shareMessage(username, value))}`;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const resetPassword = async () => {
    try {
      setResetting(true);
      setError(null);
      const details = await memberService.resetPassword(member.id);
      setPassword(details.password);
      setVisible(true);
      setResetOpen(false);
      toast.success('New password issued. Share it with the family head.');
    } catch (err) {
      setResetOpen(false);
      setError(errorMessage(err, { action: 'reset the password' }));
    } finally {
      setResetting(false);
    }
  };

  const noPassword = password === null;

  return (
    <Card data-guide="head-login">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Family head sign-in</h2>
          <p className="text-sm text-muted-foreground">
            The family head signs in on the login page with this username and password. No other member of the
            family has a sign-in.
          </p>
        </div>
        {canSignIn && (
          <Button variant="outline" icon={<FiRefreshCw />} onClick={() => setResetOpen(true)}>
            Reset password
          </Button>
        )}
      </div>

      {!canSignIn ? (
        <Alert variant="warning" title="This family head can’t sign in yet" className="mt-4">
          {member.phone
            ? 'The member is not active. Make the member active to turn their sign-in back on.'
            : 'Add a phone number (Edit) to create their sign-in. The phone number is their username.'}
        </Alert>
      ) : (
        <>
          {error && (
            <Alert variant="error" className="mt-4">
              {error}
            </Alert>
          )}

          {/* Flex, not a grid: detail pages re-flow every two-column card grid into narrow auto-fill columns. */}
          <dl className="mt-4 flex flex-wrap gap-3">
            <div className="w-full rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 sm:w-72" data-guide="head-username">
              <dt className="text-xs text-muted-foreground">Username (phone number)</dt>
              <dd className="mt-0.5 flex items-center justify-between gap-3">
                <span className="font-mono text-base font-semibold text-foreground">{username}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy username"
                  icon={copied === 'username' ? <FiCheck /> : <FiCopy />}
                  onClick={() => copy('username', username)}
                />
              </dd>
            </div>
            <div className="w-full rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 sm:w-72">
              <dt className="text-xs text-muted-foreground">Password</dt>
              <dd className="mt-0.5 flex items-center justify-between gap-3">
                <span className="font-mono text-base font-semibold tracking-wider text-foreground">
                  {visible && password ? password : noPassword ? 'Not issued' : '••••••••'}
                </span>
                <span className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    icon={visible ? <FiEyeOff /> : <FiEye />}
                    onClick={toggleVisible}
                    disabled={busy || noPassword}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy password"
                    icon={copied === 'password' ? <FiCheck /> : <FiCopy />}
                    onClick={copyPassword}
                    disabled={busy || noPassword}
                  />
                </span>
              </dd>
            </div>
          </dl>

          {noPassword && (
            <Alert variant="info" title="No password to show" className="mt-4">
              No password is on record for this family head: none was issued yet, or they changed it themselves.
              Click <strong>Reset password</strong> to issue a new one.
            </Alert>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="primary"
              icon={<RiWhatsappLine />}
              onClick={shareOnWhatsApp}
              disabled={busy || noPassword}
            >
              Share on WhatsApp
            </Button>
            <Button
              variant="outline"
              icon={copied === 'message' ? <FiCheck /> : <FiCopy />}
              onClick={copyMessage}
              disabled={busy || noPassword}
            >
              {copied === 'message' ? 'Copied' : 'Copy sign-in details'}
            </Button>
          </div>
        </>
      )}

      <Modal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset password"
        footer={
          <>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={resetPassword} isLoading={resetting}>
              Issue new password
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          A new password will be generated for <strong className="text-foreground">{toTitleCase(member.name)}</strong>.
          The current password stops working at once and they are signed out of every device. Share the new
          password with them afterwards.
        </p>
      </Modal>
    </Card>
  );
}
