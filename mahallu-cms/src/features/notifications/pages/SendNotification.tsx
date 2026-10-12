import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiImage, FiSend, FiX } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { notificationService } from '@/services/notificationService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function SendNotification() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [titleMl, setTitleMl] = useState('');
  const [message, setMessage] = useState('');
  const [messageMl, setMessageMl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [recipientType, setRecipientType] = useState<'all' | 'user' | 'member'>('all');
  const [recipientId, setRecipientId] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Add a title and a message to continue');
      return;
    }
    if (recipientType !== 'all' && !recipientId.trim()) {
      setError('Recipient ID is required for individual notifications');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await notificationService.uploadImage(imageFile);
      }

      await notificationService.create({
        title: title.trim(),
        titleMl: titleMl.trim() || undefined,
        message: message.trim(),
        messageMl: messageMl.trim() || undefined,
        imageUrl,
        recipientType: recipientType === 'all' ? 'all' : 'individual',
        recipientId: recipientType !== 'all' ? recipientId.trim() : undefined,
        type: notificationType,
      } as any);

      toast.success('Notification sent', { description: 'Taking you back to the list.' });
      setSuccess(true);
      setTimeout(() => {
        navigate(ROUTES.NOTIFICATIONS.INDIVIDUAL);
      }, 1500);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't send notification. Try again in a moment."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Send notification" description="Send a push notification to users" />

      <Card padding="lg" className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}


          {/* Title */}
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter notification title…"
            required
            icon={<FiBell className="h-4 w-4" />}
          />
          <div className="hidden">
          <Input
            label="Title (Malayalam)"
            value={titleMl}
            onChange={(e) => setTitleMl(e.target.value)}
            placeholder="തലക്കെട്ട്"
            className="font-malayalam"
          />
          </div>

          {/* Message */}
          <div>
            <label className={labelClasses}>
              Message <span className="text-[#D9534F]">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter notification message…"
              required
              className={`${controlClasses} resize-none py-2`}
            />
          </div>

          {/* Message (Malayalam) */}
          <div>
            <label className={labelClasses}>
              Message (Malayalam) <span className="text-xs font-normal text-[#98A59F]">(optional)</span>
            </label>
            <textarea
              value={messageMl}
              onChange={(e) => setMessageMl(e.target.value)}
              rows={3}
              placeholder="സന്ദേശം"
              className={`${controlClasses} font-malayalam resize-none py-2`}
            />
          </div>

          {/* Image upload */}
          <div>
            <label className={labelClasses}>
              Image <span className="text-xs font-normal text-[#98A59F]">(optional)</span>
            </label>

            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-40 w-auto max-w-full rounded-xl border border-line object-cover dark:border-surface-border"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-[#D9534F] text-white transition-colors hover:bg-[#B3261E]"
                  aria-label="Remove image"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 w-full cursor-pointer rounded-xl border-2 border-dashed border-line-strong bg-[#F4F7F5] transition-colors hover:border-primary-600 dark:border-surface-border-strong dark:bg-surface-raised dark:hover:border-brand-lime">
                <FiImage className="mb-2 h-7 w-7 text-[#98A59F]" />
                <span className="text-[13px] text-[#5B6963] dark:text-surface-muted">Click to upload image</span>
                <span className="mt-1 text-xs text-[#98A59F]">JPEG, PNG, WebP or GIF · max 5 MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          {/* Recipient Type */}
          <Select
            label="Recipient"
            value={recipientType}
            onChange={(e) => setRecipientType(e.target.value as 'all' | 'user' | 'member')}
            options={[
              { value: 'all', label: 'All users in tenant' },
              { value: 'user', label: 'Specific User' },
              { value: 'member', label: 'Specific Member' },
            ]}
          />

          {/* Recipient ID — shown only when targeting an individual */}
          {recipientType !== 'all' && (
            <Input
              label="Recipient ID"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder={`Enter ${recipientType} ID…`}
              required
            />
          )}

          {/* Notification Type */}
          <Select
            label="Type"
            value={notificationType}
            onChange={(e) =>
              setNotificationType(e.target.value as 'info' | 'warning' | 'success' | 'error')
            }
            options={[
              { value: 'info', label: 'Info' },
              { value: 'success', label: 'Success' },
              { value: 'warning', label: 'Warning' },
              { value: 'error', label: 'Error' },
            ]}
          />

          <div className="flex justify-end gap-2 border-t border-line-soft pt-4 dark:border-surface-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(ROUTES.NOTIFICATIONS.INDIVIDUAL)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={success}>
              <FiSend className="h-4 w-4" />
              Send Notification
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
