import { FiUser, FiHome, FiBookOpen, FiClipboard, FiShield } from 'react-icons/fi';

/** Backend role enum values are never renamed — this is display-only. */
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  mahall: 'Mahall Admin',
  institute: 'Institute Admin',
  member: 'Member',
  survey: 'Survey Admin',
};

export const roleLabel = (role: string) => ROLE_LABELS[role] || role;

export const roleIcon = (role: string) => {
  switch (role) {
    case 'super_admin':
      return <FiShield className="h-4 w-4" aria-hidden="true" />;
    case 'mahall':
      return <FiHome className="h-4 w-4" aria-hidden="true" />;
    case 'institute':
      return <FiBookOpen className="h-4 w-4" aria-hidden="true" />;
    case 'survey':
      return <FiClipboard className="h-4 w-4" aria-hidden="true" />;
    default:
      return <FiUser className="h-4 w-4" aria-hidden="true" />;
  }
};
