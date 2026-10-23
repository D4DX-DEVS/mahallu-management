/**
 * Malayalam wording for the details screen of a Nikah NOC (NOCDetail, when `noc.type === 'nikah'`).
 *
 * Only the fixed labels and headings of that screen are here. Everything a person entered (names, phone
 * numbers, dates, the purpose text, remarks, ids) is shown exactly as stored and is never translated.
 *
 * The wording is deliberately plain and literal: ordinary field names, no legal or official phrasing.
 * The project had no earlier Malayalam registration or certificate screen to take terminology from (it only
 * has Malayalam placeholders such as "അപേക്ഷകന്റെ പേര്" and "വരന്റെ പേര്"), so a Malayalam-speaking reviewer
 * should read these once. "NOC" is written "എൻ.ഒ.സി" as it is in everyday use; whether the office prefers a
 * full Malayalam term for "No Objection Certificate" is a decision for them, not something to guess here.
 */
export const NIKAH_NOC_LABELS_ML = {
  applicantInformation: 'അപേക്ഷകന്റെ വിവരങ്ങൾ',
  applicantName: 'അപേക്ഷകന്റെ പേര്',
  phone: 'ഫോൺ നമ്പർ',
  type: 'തരം',
  typeNikahNoc: 'നിക്കാഹ് എൻ.ഒ.സി',
  status: 'സ്ഥിതി',
  nocDetails: 'എൻ.ഒ.സി വിവരങ്ങൾ',
  purposeTitle: 'ഉദ്ദേശ്യ ശീർഷകം',
  purposeDescription: 'ഉദ്ദേശ്യ വിവരണം',
  issuedDate: 'നൽകിയ തീയതി',
  expiryDate: 'കാലാവധി തീരുന്ന തീയതി',
  relatedNikahRegistration: 'ബന്ധപ്പെട്ട നിക്കാഹ് രജിസ്ട്രേഷൻ',
  viewRegistration: 'രജിസ്ട്രേഷൻ കാണുക',
  remarks: 'കുറിപ്പുകൾ',
  registrationInformation: 'രജിസ്ട്രേഷൻ വിവരങ്ങൾ',
  nocId: 'എൻ.ഒ.സി ഐ.ഡി',
  createdAt: 'രേഖപ്പെടുത്തിയ തീയതി',
  attachedDocuments: 'ഘടിപ്പിച്ച രേഖകൾ',
} as const;

export type NikahNocLabelKey = keyof typeof NIKAH_NOC_LABELS_ML;
