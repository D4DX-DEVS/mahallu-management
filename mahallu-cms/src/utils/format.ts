import { format as dateFnsFormat, parseISO } from 'date-fns';

export const formatDate = (date: string | Date, format: string = 'dd/MM/yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return dateFnsFormat(dateObj, format);
  } catch {
    return '-';
  }
};

export const formatDateTime = (date: string | Date, format: string = 'dd/MM/yyyy - hh:mm a'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return dateFnsFormat(dateObj, format);
  } catch {
    return '-';
  }
};

export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatPhoneNumber = (phone: string): string => {
  // Format: +91 12345 67890
  if (phone.length === 10) {
    return `${phone.slice(0, 5)} ${phone.slice(5)}`;
  }
  return phone;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

/**
 * Display-only normaliser: DB values come in mixed case ("KOTTARAYIL", "farzan",
 * "Al-Hamd House"). CSS `capitalize` only uppercases the first letter and leaves
 * the rest untouched, so an all-caps value stays all-caps. This lowercases the
 * whole string first, then capitalises the first letter of each word.
 */
export const toTitleCase = (text?: string | null): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, boundary, letter) => `${boundary}${letter.toUpperCase()}`);
};
