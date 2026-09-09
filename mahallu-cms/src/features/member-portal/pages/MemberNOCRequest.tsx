import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { memberPortalService, FamilyMember, MemberOverviewResponse } from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import Card from '@/components/ui/Card';
import DatePicker from '@/components/ui/DatePicker';
import AppSelect from '@/components/ui/AppSelect';
import { FiHeart, FiFileText } from 'react-icons/fi';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { checkUploadedFile } from '@/utils/validation';
import { FieldRule, validateForm as checkFields, LIMITS } from '@/utils/validation';

/** The nikah half of a NOC carries the same fields as a nikah registration. */
const NIKAH_RULES: Record<string, FieldRule> = {
  groomName: { label: 'groom’s name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.name.max },
  brideName: { label: 'bride’s name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.name.max },
  groomAge: { label: 'age for the groom', type: 'integer', min: 0, max: 120 },
  brideAge: { label: 'age for the bride', type: 'integer', min: 0, max: 120 },
  nikahDate: { label: 'nikah date', required: true, type: 'date' },
  venue: { label: 'venue', required: true, maxLength: LIMITS.shortText.max },
  waliName: { label: 'wali’s name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.name.max },
  witness1: { label: 'first witness’s name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.name.max },
  witness2: { label: 'second witness’s name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.name.max },
  mahrAmount: { label: 'mahr amount', required: true, type: 'number', min: 0, max: 10_000_000 },
  mahrDescription: { label: 'mahr details', maxLength: 300 },
};

/** A common NOC just states its purpose. */
const COMMON_RULES: Record<string, FieldRule> = {
  purposeTitle: { label: 'purpose', required: true, minLength: 2, maxLength: 150 },
  purposeDescription: { label: 'description', required: true, maxLength: 1000 },
};

type NOCType = 'nikah' | 'common' | null;

interface CommonFormData {
  purposeTitle: string;
  purposeDescription: string;
}

interface DocumentChip {
  id: string;
  fileName: string;
  documentType:
    'id_proof' | 'age_proof' | 'photo' | 'address_proof' | 'divorce_doc' | 'death_proof' | 'other';
}

export default function MemberNOCRequest() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [overview, setOverview] = useState<MemberOverviewResponse | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const [selectedType, setSelectedType] = useState<NOCType>(null);

  // Nikah NOC — same fields as the standalone Register Nikah form
  const [side, setSide] = useState<'groom' | 'bride'>('groom');
  const [subjectMemberId, setSubjectMemberId] = useState('');
  const [groomName, setGroomName] = useState(user?.name || '');
  const [groomAge, setGroomAge] = useState('');
  const [brideName, setBrideName] = useState('');
  const [brideAge, setBrideAge] = useState('');
  const [nikahDate, setNikahDate] = useState('');
  const [venue, setVenue] = useState('');
  const [waliName, setWaliName] = useState('');
  const [witness1, setWitness1] = useState('');
  const [witness2, setWitness2] = useState('');
  const [mahrAmount, setMahrAmount] = useState('');
  const [mahrDescription, setMahrDescription] = useState('');
  const [nikahRemarks, setNikahRemarks] = useState('');

  const [documents, setDocuments] = useState<DocumentChip[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<DocumentChip['documentType']>('id_proof');
  const [uploading, setUploading] = useState(false);

  const requiredDocTypes = ['id_proof', 'age_proof', 'photo'] as const;
  const uploadedDocTypes = new Set(documents.map((d) => d.documentType));
  const missingDocTypes = requiredDocTypes.filter((t) => !uploadedDocTypes.has(t));

  const [commonForm, setCommonForm] = useState<CommonFormData>({
    purposeTitle: '',
    purposeDescription: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const overviewData = await memberPortalService.getOverview();
        setOverview(overviewData);

        if (overviewData.member.id !== user?.id) {
          const familyResult = await memberPortalService.getFamilyMembers(1, 100);
          setFamilyMembers(familyResult.data || []);
        }
      } catch {
        // Non-fatal — family member picker just won't be offered
      }
    };
    load();
  }, [user?.id]);

  const handleDocumentUpload = async (file: File) => {
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
        { id: doc.id, fileName: doc.fileName, documentType: selectedDocType },
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

  const validateNikah = () => {
    const errs = checkFields(
      {
        groomName, brideName, groomAge, brideAge, nikahDate, venue,
        waliName, witness1, witness2, mahrAmount, mahrDescription,
      },
      NIKAH_RULES
    );
    if (missingDocTypes.length > 0) {
      errs.documents = `Please attach these documents: ${missingDocTypes
        .map((t) => t.replace(/_/g, ' '))
        .join(', ')}.`;
    }
    return errs;
  };

  const validateCommon = () => checkFields({ ...commonForm }, COMMON_RULES);

  const handleSubmit = async () => {
    if (!selectedType) return;
    const errs = selectedType === 'nikah' ? validateNikah() : validateCommon();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    const payload =
      selectedType === 'nikah'
        ? {
            type: 'nikah' as const,
            subjectMemberId: subjectMemberId || undefined,
            mahallMemberType: side,
            groomName,
            groomAge: groomAge ? Number(groomAge) : undefined,
            brideName,
            brideAge: brideAge ? Number(brideAge) : undefined,
            nikahDate,
            venue,
            waliName,
            witness1,
            witness2,
            mahrAmount: Number(mahrAmount),
            mahrDescription: mahrDescription || undefined,
            documents: documents.map((d) => d.id),
            remarks: nikahRemarks || undefined,
          }
        : {
            type: 'common' as const,
            purposeTitle: commonForm.purposeTitle,
            purposeDescription: commonForm.purposeDescription,
          };

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await memberPortalService.requestNOC(payload);
      setSuccessMsg('NOC request submitted! Awaiting admin approval.');
      setTimeout(() => navigate(ROUTES.MEMBER.NOC_LIST), 2000);
    } catch (err: any) {
      setErrorMsg(errorMessage(err, { action: 'submit noc request' }));
    } finally {
      setSubmitting(false);
    }
  };

  const isFamilyHead = overview?.member.id === user?.id;

  if (successMsg) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <Card>
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl text-green-500">✓</div>
            <p className="text-green-600 dark:text-green-400 font-semibold text-lg">{successMsg}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to your NOC list…</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.MEMBER.NOC_LIST)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ← Back
        </button>
        <PageHeader title="Request NOC" />
      </div>

      {/* Step 1: Select Type */}
      {!selectedType && (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Select the type of NOC you want to apply for:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedType('nikah')}
              className="block w-full text-left p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors bg-white dark:bg-gray-900 shadow-sm"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                <FiHeart className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Nikah (Marriage) NOC</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">For marriage (nikah) ceremony</p>
            </button>
            <button
              onClick={() => setSelectedType('common')}
              className="block w-full text-left p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors bg-white dark:bg-gray-900 shadow-sm"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                <FiFileText className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Common NOC</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">For general or other purposes</p>
            </button>
          </div>
        </div>
      )}

      {/* Step 2a: Nikah Form — mirrors Register Nikah */}
      {selectedType === 'nikah' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FiHeart className="h-4 w-4 text-primary-600 dark:text-primary-400" /> Nikah NOC Details
            </h2>
            <button
              onClick={() => setSelectedType(null)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Change type
            </button>
          </div>
          <div className="space-y-4">
            {/* Nikah Side Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Is this nikah for: <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                {(['groom', 'bride'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      aria-label="Is this nikah for"
                      type="radio"
                      name="noc-nikah-side"
                      value={s}
                      checked={side === s}
                      onChange={() => setSide(s)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subject Member Selection (for family head) */}
            {isFamilyHead && familyMembers.length > 0 && (
              <AppSelect
                label="Family Member"
                value={subjectMemberId}
                onChange={setSubjectMemberId}
                options={[
                  { value: '', label: 'Select a family member…' },
                  ...familyMembers.map((m) => ({ value: m.id, label: m.name })),
                ]}
                error={errors.subjectMemberId}
              />
            )}

            {/* Groom Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Groom Name <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Groom Name"
                  type="text"
                  value={groomName}
                  onChange={(e) => setGroomName(e.target.value)}
                  placeholder="Groom's full name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.groomName && <p className="text-red-500 text-label mt-1">{errors.groomName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Groom Age
                </label>
                <input
                  aria-label="Groom Age"
                  type="number"
                  value={groomAge}
                  onChange={(e) => setGroomAge(e.target.value)}
                  placeholder="Age in years"
                  min={1}
                  max={120}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Bride Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bride Name <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Bride Name"
                  type="text"
                  value={brideName}
                  onChange={(e) => setBrideName(e.target.value)}
                  placeholder="Bride's full name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.brideName && <p className="text-red-500 text-label mt-1">{errors.brideName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bride Age
                </label>
                <input
                  aria-label="Bride Age"
                  type="number"
                  value={brideAge}
                  onChange={(e) => setBrideAge(e.target.value)}
                  placeholder="Age in years"
                  min={1}
                  max={120}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Nikah Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Nikah Date"
                value={nikahDate}
                onChange={setNikahDate}
                placeholder="Pick a date"
                error={errors.nikahDate}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Venue <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Venue"
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Location of nikah"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.venue && <p className="text-red-500 text-label mt-1">{errors.venue}</p>}
              </div>
            </div>

            {/* Wali & Witnesses */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wali Name <span className="text-red-500">*</span>
              </label>
              <input
                aria-label="Wali Name"
                type="text"
                value={waliName}
                onChange={(e) => setWaliName(e.target.value)}
                placeholder="Bride's wali name"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.waliName && <p className="text-red-500 text-label mt-1">{errors.waliName}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Witness <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="First Witness"
                  type="text"
                  value={witness1}
                  onChange={(e) => setWitness1(e.target.value)}
                  placeholder="Witness name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.witness1 && <p className="text-red-500 text-label mt-1">{errors.witness1}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Second Witness <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Second Witness"
                  type="text"
                  value={witness2}
                  onChange={(e) => setWitness2(e.target.value)}
                  placeholder="Witness name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.witness2 && <p className="text-red-500 text-label mt-1">{errors.witness2}</p>}
              </div>
            </div>

            {/* Mahr Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mahr Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Mahr Amount (₹)"
                  type="number"
                  value={mahrAmount}
                  onChange={(e) => setMahrAmount(e.target.value)}
                  placeholder="Amount in rupees"
                  min={0}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.mahrAmount && <p className="text-red-500 text-label mt-1">{errors.mahrAmount}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mahr Description
                </label>
                <input
                  aria-label="Mahr Description"
                  type="text"
                  value={mahrDescription}
                  onChange={(e) => setMahrDescription(e.target.value)}
                  placeholder="e.g., Gold, Cash, etc."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Required Documents Checklist */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Required Documents
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                      { value: 'age_proof', label: 'Age Proof' },
                      { value: 'photo', label: 'Photo' },
                      { value: 'address_proof', label: 'Address Proof' },
                      { value: 'divorce_doc', label: 'Divorce Document' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                </div>
                <label
                  htmlFor="doc-upload-noc-nikah"
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
                  id="doc-upload-noc-nikah"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Remarks
              </label>
              <textarea
                aria-label="Additional Remarks"
                value={nikahRemarks}
                onChange={(e) => setNikahRemarks(e.target.value)}
                placeholder="Any additional information…"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          </div>
          {errorMsg && (
            <p className="text-red-500 text-sm mt-4 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {errorMsg}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button
              onClick={() => navigate(ROUTES.MEMBER.NOC_LIST)}
              className="py-2 px-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Step 2b: Common Form */}
      {selectedType === 'common' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FiFileText className="h-4 w-4 text-primary-600 dark:text-primary-400" /> Common NOC Details
            </h2>
            <button
              onClick={() => setSelectedType(null)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Change type
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Applicant Name
              </label>
              <input
                aria-label="Applicant Name"
                type="text"
                value={user?.name || ''}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purpose Title <span className="text-red-500">*</span>
              </label>
              <input
                aria-label="Purpose Title"
                type="text"
                value={commonForm.purposeTitle}
                onChange={(e) => setCommonForm({ ...commonForm, purposeTitle: e.target.value })}
                placeholder="Brief title for this NOC"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.purposeTitle && <p className="text-red-500 text-label mt-1">{errors.purposeTitle}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description / Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                aria-label="Description / Reason"
                value={commonForm.purposeDescription}
                onChange={(e) => setCommonForm({ ...commonForm, purposeDescription: e.target.value })}
                placeholder="Describe the purpose and reason for this NOC request…"
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              {errors.purposeDescription && (
                <p className="text-red-500 text-label mt-1">{errors.purposeDescription}</p>
              )}
            </div>
          </div>
          {errorMsg && (
            <p className="text-red-500 text-sm mt-4 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {errorMsg}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button
              onClick={() => navigate(ROUTES.MEMBER.NOC_LIST)}
              className="py-2 px-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
