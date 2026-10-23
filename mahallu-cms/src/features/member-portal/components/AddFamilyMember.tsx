import { useState, type FormEvent } from 'react';
import { FiUserPlus } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Alert from '@/components/ui/Alert';
import { memberPortalService } from '@/services/memberPortalService';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import { sanitizeDigits } from '@/utils/validation';

const GENDERS = [
  { value: '', label: 'Not set' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

// The same relationships the Mahallu admin's member form offers.
const RELATIONSHIPS = [
  { value: '', label: 'Not set' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'other', label: 'Other' },
];

const today = () => new Date().toISOString().slice(0, 10);

interface AddFamilyMemberProps {
  /** Called after the server confirmed the member was created, so the list can reload. */
  onAdded: () => void;
}

/**
 * The Family Head adds a person to their own family. The server decides the family and Mahallu from the
 * head's own record; this form only describes the person. A phone number gives the person a member login
 * (a one-time code to that number) - no password is created or shown.
 */
export default function AddFamilyMember({ onAdded }: AddFamilyMemberProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setRelationship('');
    setGender('');
    setDateOfBirth('');
    setPhone('');
    setErrors({});
    setFormError('');
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    reset();
  };

  const validate = () => {
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = 'Please enter the name (at least 2 characters).';
    if (name.trim().length > 100) found.name = 'Please keep the name to 100 characters or less.';
    if (dateOfBirth && dateOfBirth > today()) found.dateOfBirth = 'Date of birth cannot be in the future.';
    if (phone && !/^[0-9]{10}$/.test(phone)) found.phone = 'Please enter a 10-digit phone number.';
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    setFormError('');
    try {
      const result = await memberPortalService.addFamilyMember({
        name: name.trim(),
        ...(relationship ? { relationship } : {}),
        ...(gender ? { gender } : {}),
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(phone ? { phone } : {}),
      });
      toast.success(result.message);
      setOpen(false);
      reset();
      onAdded();
    } catch (err) {
      setFormError(errorMessage(err, { action: 'add the family member' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button icon={<FiUserPlus />} collapseLabel onClick={() => setOpen(true)}>
        Add family member
      </Button>

      <Modal
        isOpen={open}
        onClose={close}
        title="Add a family member"
        description="They will be added to your family."
        disableBackdropClose
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-family-member-form" isLoading={saving} loadingText="Adding">
              Add member
            </Button>
          </>
        }
      >
        <form id="add-family-member-form" onSubmit={submit} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="error" title="Couldn't add the member">
              {formError}
            </Alert>
          )}
          <Input
            label="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            required
            autoComplete="off"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Relationship to you" options={RELATIONSHIPS} value={relationship} onChange={(event) => setRelationship(event.target.value)} />
            <Select label="Gender" options={GENDERS} value={gender} onChange={(event) => setGender(event.target.value)} />
          </div>
          <Input
            label="Date of birth"
            type="date"
            max={today()}
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            error={errors.dateOfBirth}
          />
          <Input
            label="Phone number (optional)"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(event) => setPhone(sanitizeDigits(event.target.value, 10))}
            error={errors.phone}
            helperText="With a phone number they can sign in using a one-time code sent to it. Without one they are added to the family list only."
            placeholder="9876543210"
          />
        </form>
      </Modal>
    </>
  );
}
