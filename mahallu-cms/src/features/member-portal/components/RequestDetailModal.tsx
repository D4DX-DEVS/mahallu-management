import { useState } from 'react';
import { memberPortalService } from '@/services/memberPortalService';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { FiFile, FiExternalLink } from 'react-icons/fi';
import { errorMessage } from '@/utils/errors';

export type RequestType = 'nikah' | 'death' | 'noc';

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea';
}

const FIELDS: Record<RequestType, FieldConfig[]> = {
  nikah: [
    { key: 'groomName', label: 'Groom Name', type: 'text' },
    { key: 'groomAge', label: 'Groom Age', type: 'number' },
    { key: 'brideName', label: 'Bride Name', type: 'text' },
    { key: 'brideAge', label: 'Bride Age', type: 'number' },
    { key: 'nikahDate', label: 'Nikah Date', type: 'date' },
    { key: 'venue', label: 'Venue', type: 'text' },
    { key: 'waliName', label: 'Wali Name', type: 'text' },
    { key: 'witness1', label: 'Witness 1', type: 'text' },
    { key: 'witness2', label: 'Witness 2', type: 'text' },
    { key: 'mahrAmount', label: 'Mahr Amount', type: 'number' },
    { key: 'mahrDescription', label: 'Mahr Description', type: 'textarea' },
  ],
  death: [
    { key: 'deathDate', label: 'Death Date', type: 'date' },
    { key: 'placeOfDeath', label: 'Place of Death', type: 'text' },
    { key: 'causeOfDeath', label: 'Cause of Death', type: 'text' },
    { key: 'informantName', label: 'Informant Name', type: 'text' },
    { key: 'informantRelation', label: 'Informant Relation', type: 'text' },
    { key: 'informantPhone', label: 'Informant Phone', type: 'text' },
  ],
  noc: [
    { key: 'purposeTitle', label: 'Purpose Title', type: 'text' },
    { key: 'purposeDescription', label: 'Purpose Description', type: 'textarea' },
    { key: 'applicantPhone', label: 'Applicant Phone', type: 'text' },
  ],
};

const TITLES: Record<RequestType, string> = {
  nikah: 'Nikah Registration',
  death: 'Death Registration',
  noc: 'NOC Request',
};

const toDateInputValue = (value: unknown): string => {
  if (!value || typeof value !== 'string') return '';
  return value.slice(0, 10);
};

interface RequestDetailModalProps {
  type: RequestType;
  request: Record<string, any>;
  mode: 'view' | 'edit';
  onClose: () => void;
  onSaved: () => void;
}

export default function RequestDetailModal({
  type,
  request,
  mode,
  onClose,
  onSaved,
}: RequestDetailModalProps) {
  const fields = FIELDS[type];
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    fields.reduce(
      (acc, f) => {
        const raw = request[f.key];
        acc[f.key] = f.type === 'date' ? toDateInputValue(raw) : (raw ?? '');
        return acc;
      },
      {} as Record<string, string>
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  // documents is normally populated ({id, fileName, documentType}) — fall back to a bare id
  // string so an unpopulated/stale response still renders an openable (if unlabeled) chip.
  const documents: { id: string; fileName: string; documentType: string; status?: string }[] = (
    Array.isArray(request.documents) ? request.documents : []
  )
    .map((d: any) => (typeof d === 'string' ? { id: d, fileName: 'Document', documentType: 'other' } : d))
    .filter((d: any) => d && d.id);

  const handleOpenDocument = async (docId: string) => {
    setOpeningDocId(docId);
    try {
      const { url } = await memberPortalService.getDocumentUrl(docId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'open document' }));
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload: Record<string, any> = {};
      fields.forEach((f) => {
        const value = formData[f.key];
        payload[f.key] = f.type === 'number' ? (value === '' ? undefined : Number(value)) : value;
      });
      await memberPortalService.updateRegistration(type, request.id, payload);
      onSaved();
    } catch (err: any) {
      setError(errorMessage(err, { action: 'save changes' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${mode === 'edit' ? 'Edit' : 'View'} ${TITLES[type]}`}
      size="lg"
      footer={
        mode === 'edit' ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {request.status && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
            <span className="capitalize text-gray-900 dark:text-gray-100">
              {String(request.status).replace('_', ' ')}
            </span>
          </div>
        )}
        {request.remarks && (
          <div className="text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 px-3 py-2 rounded-lg">
            <span className="font-medium">Remarks: </span>
            {request.remarks}
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Documents</p>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-600">No documents uploaded.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleOpenDocument(doc.id)}
                  disabled={openingDocId === doc.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  title={doc.fileName}
                  aria-label={`Open ${doc.fileName}`}
                >
                  <FiFile size={12} />
                  <span className="truncate max-w-[10rem]">
                    {doc.documentType?.replace(/_/g, ' ') || doc.fileName}
                  </span>
                  {openingDocId === doc.id ? '…' : <FiExternalLink size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'view' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{f.label}</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {f.type === 'date' && request[f.key]
                    ? new Date(request[f.key]).toLocaleDateString('en-IN')
                    : request[f.key] || '—'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {f.label}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    aria-label="Notes"
                    value={formData[f.key]}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                ) : (
                  <input
                    aria-label="Value"
                    type={f.type}
                    value={formData[f.key]}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>
            ))}
            {error && (
              <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
