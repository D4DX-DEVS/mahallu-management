import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiImage, FiSend, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { notificationService } from '@/services/notificationService';

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
      setError('Title and message are required');
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

      setSuccess(true);
      setTimeout(() => {
        navigate(ROUTES.NOTIFICATIONS.INDIVIDUAL);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send notification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Send Notification</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Send a push notification to users
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Notifications', path: ROUTES.NOTIFICATIONS.INDIVIDUAL },
            { label: 'Send' },
          ]}
        />
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
              Notification sent successfully! Redirecting…
            </div>
          )}

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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter notification message…"
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Message (Malayalam) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message (Malayalam) <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={messageMl}
              onChange={(e) => setMessageMl(e.target.value)}
              rows={3}
              placeholder="സന്ദേശം"
              className="font-malayalam w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Image <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>

            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-40 w-auto max-w-full rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  aria-label="Remove image"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors bg-gray-50 dark:bg-gray-800/50">
                <FiImage className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload image</span>
                <span className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP or GIF · max 5 MB</span>
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

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.NOTIFICATIONS.INDIVIDUAL)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={success}>
              <FiSend className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
