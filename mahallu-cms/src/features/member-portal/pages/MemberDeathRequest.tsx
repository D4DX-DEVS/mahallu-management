import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { memberPortalService, FamilyMember } from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import DatePicker from '@/components/ui/DatePicker';
import AppSelect from '@/components/ui/AppSelect';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { FieldRule, validateForm as checkFields, LIMITS } from '@/utils/validation';
import { checkUploadedFile } from '@/utils/validation';
import { toTitleCase } from '@/utils/format';

/** Mirrors the API's death-registration rules (`memberUserValidation.ts`). */
const DEATH_RULES: Record<string, FieldRule> = {
  deathDate: { label: 'date of death', required: true, type: 'date', noFuture: true },
  placeOfDeath: { label: 'place of death', required: true, maxLength: LIMITS.shortText.max },
  causeOfDeath: { label: 'cause of death', required: true, maxLength: 300 },
  informantName: { label: 'informant’s name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.name.max },
  informantRelation: { label: 'relationship to the informant', required: true, maxLength: 100 },
  informantPhone: { label: 'phone number for the informant', type: 'phone' },
};


interface DocumentChip {
  id: string;
  fileName: string;
  documentType:
    'id_proof' | 'age_proof' | 'photo' | 'address_proof' | 'divorce_doc' | 'death_proof' | 'other';
}

export default function MemberDeathRequest() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [deceasedMemberId, setDeceasedMemberId] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [placeOfDeath, setPlaceOfDeath] = useState('');
  const [causeOfDeath, setCauseOfDeath] = useState('');
  const [informantName, setInformantName] = useState(user?.name || '');
  const [informantRelation, setInformantRelation] = useState('');
  const [informantPhone, setInformantPhone] = useState('');

  const [documents, setDocuments] = useState<DocumentChip[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<
    'id_proof' | 'age_proof' | 'photo' | 'address_proof' | 'divorce_doc' | 'death_proof' | 'other'
  >('id_proof');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const requiredDocTypes = ['id_proof', 'death_proof'] as const;

  const uploadedDocTypes = new Set(documents.map((d) => d.documentType));
  const missingDocTypes = requiredDocTypes.filter((t) => !uploadedDocTypes.has(t));

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const familyResult = await memberPortalService.getFamilyMembers(1, 100);
        setFamilyMembers(familyResult.data || []);
      } catch (err: any) {
        setErrorMsg(loadErrorMessage(err, 'family members'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleDocumentUpload = async (file: File) => {
    if (!selectedDocType) {
      setErrorMsg('Please choose a document type first.');
      return;
    }

    // Type and size were checked only by the API, which meant sending the whole
    // file over a phone connection before being told it was the wrong one.
    const fileProblem = checkUploadedFile(file, 'document');
    if (fileProblem) {
      setErrorMsg(fileProblem);
      return;
    }
    if (uploading) return;

    setUploading(true);
    try {
      const doc = await memberPortalService.uploadDocument(file, selectedDocType);
      setDocuments((prev) => [
        ...prev,
        { id: doc.id || doc._id, fileName: doc.fileName, documentType: selectedDocType },
      ]);
    } catch (err: any) {
      setErrorMsg(errorMessage(err, { action: 'upload document' }));
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const validateForm = () => {
    const errs = checkFields(
      { deathDate, placeOfDeath, causeOfDeath, informantName, informantRelation, informantPhone },
      DEATH_RULES
    );

    if (missingDocTypes.length > 0) {
      errs.documents = `Please attach these documents: ${missingDocTypes
        .map((t) => t.replace(/_/g, ' '))
        .join(', ')}.`;
    }

    return errs;
  };

  const handleSubmit = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    try {
      setSubmitting(true);
      setErrorMsg(null);

      await memberPortalService.createDeathRegistration({
        deceasedMemberId: deceasedMemberId || undefined,
        deathDate,
        placeOfDeath,
        causeOfDeath,
        informantName,
        informantRelation,
        informantPhone: informantPhone || undefined,
        documents: documents.map((d) => d.id),
      });

      setSuccessMsg('Death registration submitted!');
      setTimeout(() => navigate(ROUTES.MEMBER.REQUESTS), 2000);
    } catch (err: any) {
      setErrorMsg(errorMessage(err, { action: 'submit registration' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (successMsg) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <Card>
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">✓</div>
            <p className="text-green-600 dark:text-green-400 font-semibold text-lg">{successMsg}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to requests…</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl w-full mx-auto">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.MEMBER.REQUESTS)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ← Back
        </button>
        <PageHeader title="Report Death" />
      </div>

      <Card>
        <div className="space-y-4">
          {/* Deceased Member Selection */}
          {familyMembers.length > 0 && (
            <AppSelect
              label="Deceased Member"
              value={deceasedMemberId}
              onChange={setDeceasedMemberId}
              options={[
                { value: '', label: 'Select a family member or leave blank for self…' },
                ...familyMembers.map((m) => ({ value: m.id, label: toTitleCase(m.name) })),
              ]}
              placeholder="Select a family member or leave blank for self…"
            />
          )}

          {/* Death Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker
              label="Date of Death"
              value={deathDate}
              onChange={setDeathDate}
              placeholder="Pick a date"
              error={errors.deathDate}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Place of Death <span className="text-red-500">*</span>
              </label>
              <input
                aria-label="Place of Death"
                type="text"
                value={placeOfDeath}
                onChange={(e) => setPlaceOfDeath(e.target.value)}
                placeholder="Location where death occurred"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.placeOfDeath && <p className="text-red-500 text-label mt-1">{errors.placeOfDeath}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cause of Death <span className="text-red-500">*</span>
            </label>
            <textarea
              aria-label="Cause of Death"
              value={causeOfDeath}
              onChange={(e) => setCauseOfDeath(e.target.value)}
              placeholder="Cause of death (e.g., illness, accident, etc.)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            {errors.causeOfDeath && <p className="text-red-500 text-label mt-1">{errors.causeOfDeath}</p>}
          </div>

          {/* Informant Details */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-foreground">Informant Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Name"
                  type="text"
                  value={informantName}
                  onChange={(e) => setInformantName(e.target.value)}
                  placeholder="Informant's name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.informantName && <p className="text-red-500 text-label mt-1">{errors.informantName}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Relation to Deceased <span className="text-red-500">*</span>
                  </label>
                  <input
                    aria-label="Relation to Deceased"
                    type="text"
                    value={informantRelation}
                    onChange={(e) => setInformantRelation(e.target.value)}
                    placeholder="e.g., Son, Daughter, Father"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {errors.informantRelation && (
                    <p className="text-red-500 text-label mt-1">{errors.informantRelation}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    aria-label="Phone Number"
                    type="tel"
                    value={informantPhone}
                    onChange={(e) => setInformantPhone(e.target.value)}
                    placeholder="Contact number"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Required Documents Checklist */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Required Documents
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {requiredDocTypes.map((docType) => (
                <div
                  key={docType}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <span className="text-lg">{uploadedDocTypes.has(docType) ? '✓' : '○'}</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {docType.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload Documents <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex-1">
                <AppSelect
                  value={selectedDocType}
                  onChange={(v) => setSelectedDocType(v as typeof selectedDocType)}
                  options={[
                    { value: 'id_proof', label: 'ID Proof' },
                    { value: 'death_proof', label: 'Death Proof' },
                    { value: 'age_proof', label: 'Age Proof' },
                    { value: 'photo', label: 'Photo' },
                    { value: 'address_proof', label: 'Address Proof' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>
              <label
                htmlFor="doc-upload-death"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm cursor-pointer transition-colors"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </label>
              <input
                aria-label="Choose a file"
                type="file"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleDocumentUpload(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
                disabled={uploading}
                className="hidden"
                id="doc-upload-death"
              />
            </div>
            {documents.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full"
                  >
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-xs">
                      {doc.documentType.replace(/_/g, ' ')}: {doc.fileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDocument(doc.id)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errors.documents && <p className="text-red-500 text-label mt-1">{errors.documents}</p>}
          </div>

          {errorMsg && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Registration'}
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.MEMBER.REQUESTS)}
              className="py-2 px-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
