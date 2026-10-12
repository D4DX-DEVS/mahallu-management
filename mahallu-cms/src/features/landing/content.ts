/*
 * Copy and data for the public landing page, kept apart from the components so
 * the words can be edited without touching layout.
 */
import type { IconType } from 'react-icons';
import {
  FiUsers,
  FiFileText,
  FiHeart,
  FiBookOpen,
  FiBarChart2,
  FiCalendar,
  FiBox,
  FiUser,
  FiUserCheck,
  FiLayers,
} from 'react-icons/fi';
import { FaMosque, FaCoins, FaArchway } from 'react-icons/fa';

/* "Request a demo" opens the demo-request form (see DemoRequestDialog). There is
   no video yet, so "Watch video" scrolls to the walkthrough. CONTACT_EMAIL is a
   placeholder until the real contact channel is decided. */
export const CONTACT_EMAIL = 'hello@zaad.app';
export const WATCH_VIDEO_HREF = '#how-it-works';

export interface NavLink {
  label: string;
  href: string;
  /** The section id the link scrolls to, used to mark the active link. */
  section: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '#home', section: 'home' },
  { label: 'Features', href: '#features', section: 'features' },
  { label: 'For Members', href: '#for-members', section: 'for-members' },
  { label: 'Contact', href: '#contact', section: 'contact' },
  { label: 'About Us', href: '#about-us', section: 'about-us' },
];

export const HERO = {
  eyebrow: 'The digital office for your Mahallu',
  headline: ['മഹല്ല് ഭരണനിർവഹണത്തിനുള്ള', 'സമഗ്ര ഡിജിറ്റൽ പരിഹാരം'],
  body: 'മഹല്ല് കുടുംബങ്ങളുടെ വിവരശേഖരണം മുതൽ വരിസംഖ്യാ പിരിവ്, അക്കൗണ്ടിംഗ്, സർട്ടിഫിക്കറ്റ് വിതരണം, പൊതുഅറിയിപ്പുകൾ തുടങ്ങി ദൈനംദിന ഭരണപ്രവർത്തനങ്ങൾ വരെ — എല്ലാം ഒരൊറ്റ ഡിജിറ്റൽ സംവിധാനത്തിലൂടെ ലളിതവും കാര്യക്ഷമവുമാക്കാം.',
  trust: [
    'മഹല്ല് ഭരണസമിതിക്കായി Web Edition',
    'മഹല്ല് നിവാസികൾക്കായി സൗകര്യപ്രദമായ Mobile App',
    'ഓരോ മഹല്ലിന്റെയും ആവശ്യങ്ങൾക്കനുസരിച്ചുള്ള Customizable Features',
  ],
};

export interface Stat {
  value: string;
  label: string;
  hint: string;
  icon: IconType;
}

export const STATS: Stat[] = [
  { value: '27', label: 'Configurable modules', hint: "Adapt to your Mahallu's needs", icon: FiBox },
  { value: '5', label: 'User roles', hint: 'Committee, staff and volunteers', icon: FiUsers },
  { value: '12', label: 'Development indicators', hint: 'Track progress year after year', icon: FiBarChart2 },
  { value: '4', label: 'Mosque types', hint: 'Works for all Mahallu sizes', icon: FaMosque },
];

export interface Feature {
  title: string;
  body: string;
  icon: IconType;
  /** Tinted icon tile: background and glyph colour. */
  tint: { bg: string; fg: string };
}

export const FEATURES: Feature[] = [
  {
    title: 'കുടുംബ ഡയറക്ടറിയും ജനസംഖ്യാ വിവരശേഖരണവും',
    body: 'കുടുംബാംഗങ്ങളുടെ വിലാസം, ബന്ധവിവരങ്ങൾ, വിദ്യാഭ്യാസം, തൊഴിൽ, രക്തഗ്രൂപ്പ് തുടങ്ങിയ വിവരങ്ങൾ ക്രമബദ്ധമായി സൂക്ഷിക്കാനും ആവശ്യാനുസരണം കണ്ടെത്താനും കഴിയും.',
    icon: FiUsers,
    tint: { bg: '#E6F4EC', fg: '#1F8A55' },
  },
  {
    title: 'വരിസംഖ്യാ പിരിവും സംഭാവനാ മാനേജ്മെന്റും',
    body: 'മാസവരി, വാർഷിക വരിസംഖ്യ, റമദാൻ പിരിവ്, സംഭാവനകൾ എന്നിവ രേഖപ്പെടുത്തുക. പേയ്മെന്റ് നില പരിശോധിക്കുക, രസീതുകൾ തയ്യാറാക്കുക, ലഭിച്ച തുകയും ലഭിക്കാനുള്ള തുകയും നിരീക്ഷിക്കുക. പിന്തുണയ്ക്കുന്ന സംവിധാനങ്ങൾ വഴി SMS/WhatsApp അറിയിപ്പുകളും കൈമാറാം.',
    icon: FaCoins,
    tint: { bg: '#FFF3DC', fg: '#D9900A' },
  },
  {
    title: 'ഡിജിറ്റൽ സർട്ടിഫിക്കറ്റുകൾ',
    body: 'മഹല്ല് അംഗത്വ സർട്ടിഫിക്കറ്റ്, വിവാഹവുമായി ബന്ധപ്പെട്ട സർട്ടിഫിക്കറ്റുകൾ, NOC, മറ്റ് അംഗീകൃത രേഖകൾ എന്നിവ തയ്യാറാക്കാനും പ്രിന്റ് ചെയ്യാനും സഹായിക്കുന്ന സംവിധാനം.',
    icon: FiFileText,
    tint: { bg: '#E2F4F1', fg: '#128C78' },
  },
  {
    title: 'Welfare & Zakat',
    body: 'Identify families in need, manage Zakat collections and distribute assistance fairly.',
    icon: FiHeart,
    tint: { bg: '#FFEBE0', fg: '#E35F1C' },
  },
  {
    title: 'Madrasa management',
    body: 'Manage students, staff, classes and fees for your Madrasa and other institutes.',
    icon: FiBookOpen,
    tint: { bg: '#E6EEFF', fg: '#2F62D3' },
  },
  {
    title: 'Qabaristan (burial ground)',
    body: 'Keep records of burials, location details and maintenance.',
    icon: FaArchway,
    tint: { bg: '#E6F4EC', fg: '#1F8A55' },
  },
  {
    title: 'അക്കൗണ്ടിംഗും സാമ്പത്തിക റിപ്പോർട്ടുകളും',
    body: 'വരവ്–ചെലവ് ഇടപാടുകൾ, ഫണ്ടുകൾ, സംഭാവനകൾ എന്നിവ ക്രമമായി രേഖപ്പെടുത്തുക. സാമ്പത്തിക അവലോകനത്തിനും ഓഡിറ്റ് നടപടികൾക്കും ആവശ്യമായ റിപ്പോർട്ടുകൾ തയ്യാറാക്കുക.',
    icon: FiBarChart2,
    tint: { bg: '#FDE8E8', fg: '#D13B3B' },
  },
  {
    title: 'Meetings & programs',
    body: 'Schedule committee meetings, manage programs and keep records.',
    icon: FiCalendar,
    tint: { bg: '#F0E8FF', fg: '#7A3FD6' },
  },
];

export interface Step {
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  { title: 'Set up your Mahallu', body: 'Add your Mahallu details and configure the modules you need.' },
  { title: 'Add your records', body: 'Import or enter family records, members and other details.' },
  { title: 'Start using', body: 'Manage collections, certificates, welfare, accounts and more.' },
  { title: 'Serve your community', body: 'Provide better services and share progress with transparency.' },
];

export const REALITIES = {
  eyebrow: 'Built for Mahallu realities',
  headline: ['മഹല്ല് ഭരണത്തിന് പുതിയ', 'ഒരു ഡിജിറ്റൽ അനുഭവം'],
  body: 'മഹല്ല് പരിപാലനം ഒരു ഭരണപരമായ ചുമതല മാത്രമല്ല; വിശ്വാസം, ഉത്തരവാദിത്തം, കൃത്യത, സുതാര്യത എന്നിവ ഉറപ്പാക്കേണ്ട സാമൂഹിക സേവനമാണ്. രജിസ്റ്ററുകളിലും ചിതറിക്കിടക്കുന്ന രേഖകളിലും മാത്രം ആശ്രയിക്കുന്നതിനുപകരം, മഹല്ലിന്റെ പ്രധാന വിവരങ്ങളും പ്രവർത്തനങ്ങളും ക്രമബദ്ധമായി കൈകാര്യം ചെയ്യാൻ ZAAD സഹായിക്കുന്നു.',
  points: [
    'Access from office or mobile',
    'Role-based access for committee, staff and volunteers',
    'Secure data with regular backups',
    'Built with the needs of Kerala Mahallus in mind',
  ],
};

export const DEMO_BAND = {
  headline: 'നിങ്ങളുടെ മഹല്ലിനെ ഡിജിറ്റൽ യുഗത്തിലേക്ക് നയിക്കൂ',
  body: 'മഹല്ലിന്റെ ഭരണപ്രവർത്തനങ്ങൾ കൂടുതൽ ചിട്ടയോടെയും കാര്യക്ഷമതയോടെയും നിർവഹിക്കാൻ ആഗ്രഹിക്കുന്നുണ്ടോ? ZAAD പരിചയപ്പെടൂ. നിങ്ങളുടെ മഹല്ലിന്റെ ആവശ്യങ്ങൾ പങ്കുവെക്കൂ. അനുയോജ്യമായ ഡിജിറ്റൽ പരിഹാരം കണ്ടെത്തൂ.',
};

export const ABOUT = {
  heading: 'ഞങ്ങളെക്കുറിച്ച്',
  paragraphs: [
    'ZAAD മഹല്ലുകളുടെ ഭരണനിർവഹണം കൂടുതൽ ലളിതവും സുതാര്യവും കാര്യക്ഷമവുമാക്കുന്നതിനായി രൂപകൽപ്പന ചെയ്ത സമഗ്ര ഡിജിറ്റൽ പ്ലാറ്റ്‌ഫോമാണ്. മസ്ജിദ് കൗൺസിൽ കേരളയുടെ (Masjid Council Kerala – masjidcouncilkerala.org) പെയ്ഡ് സംരംഭമാണ് ZAAD. മഹല്ല് ഭരണസമിതികൾക്കായി വെബ് എഡിഷനും മഹല്ല് നിവാസികൾക്കായി മൊബൈൽ ആപ്പും ഇതിലൂടെ ലഭ്യമാക്കുന്നു.',
    'കുടുംബവിവര ശേഖരണം, വരിസംഖ്യാ പിരിവ്, സർട്ടിഫിക്കറ്റ് വിതരണം, അക്കൗണ്ടിംഗ്, സാമ്പത്തിക റിപ്പോർട്ടുകൾ, പൊതുഅറിയിപ്പുകൾ തുടങ്ങിയ പ്രവർത്തനങ്ങൾ ഒരൊറ്റ സംവിധാനത്തിലൂടെ ഏകോപിപ്പിക്കാൻ ZAAD സഹായിക്കുന്നു.',
    'ഓരോ മഹല്ലിന്റെയും ആവശ്യങ്ങൾക്കനുസരിച്ച് സൗകര്യങ്ങൾ ക്രമീകരിക്കാനും പുതിയ സംവിധാനങ്ങൾ കൂട്ടിച്ചേർക്കാനും കഴിയുന്ന രീതിയിലാണ് ZAAD രൂപകൽപ്പന ചെയ്തിരിക്കുന്നത്. മഹല്ല് ഭരണത്തിൽ സുതാര്യതയും കൃത്യതയും കാര്യക്ഷമതയും പ്രോത്സാഹിപ്പിക്കുകയാണ് ഈ സംരംഭത്തിന്റെ ലക്ഷ്യം.',
  ],
};

export interface Audience {
  title: string;
  body: string;
  icon: IconType;
  tint: { bg: string; fg: string };
}

export const AUDIENCES: Audience[] = [
  {
    title: 'Committee leaders',
    body: 'Less paperwork, clear accounts and a well-organised Mahallu.',
    icon: FiUser,
    tint: { bg: '#E6EEFF', fg: '#2F62D3' },
  },
  {
    title: 'Office staff & volunteers',
    body: 'Easy data entry and clear tasks on a phone or computer.',
    icon: FiUserCheck,
    tint: { bg: '#E6F4EC', fg: '#1F8A55' },
  },
  {
    title: 'Families',
    body: 'View your own records, pay dues and get certificates without visiting the office.',
    icon: FiUsers,
    tint: { bg: '#FFEBE0', fg: '#E35F1C' },
  },
  {
    title: 'Multi-Mahallu bodies',
    body: 'Manage multiple Mahallus from one account with consistent records.',
    icon: FiLayers,
    tint: { bg: '#F0E8FF', fg: '#7A3FD6' },
  },
];

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

/* Placeholder voices from the design mock. Replace with real committee
   testimonials before launch. */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'ZAAD has made our office work so much easier. We can now give certificates and payment receipts quickly, and our accounts are clear and transparent.',
    name: 'Abdul Latheef',
    role: 'Secretary, Beypore Juma Masjid',
  },
  {
    quote:
      "Family records, Varisangya collections and welfare management are now in one place. It has improved our committee's efficiency a lot.",
    name: 'Muhammed Rashid',
    role: 'President, Cheruvannur Mahallu',
  },
  {
    quote:
      'The member portal is very helpful. Our members can now view their details and pay online. Excellent support from the ZAAD team.',
    name: 'Ismail K',
    role: 'Treasurer, Parappanangadi Mahallu',
  },
];

export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    question: 'Is ZAAD suitable for small Mahallus?',
    answer:
      'Yes. Choose your mosque type when you register, from a full Mahallu to a small Musalla, and switch on only the modules you need. A small committee is never overwhelmed, and a large Mahallu gets everything.',
  },
  {
    question: 'Can we import our existing records?',
    answer:
      'Yes. Family and member records can be imported in bulk from your existing registers or spreadsheets, and volunteers can add or correct details from a phone during the field survey.',
  },
  {
    question: 'Can members pay Varisangya online?',
    answer:
      'Members sign in to their own portal, see their dues and payment history, and submit payments with proof. The committee approves each payment and the member receives a receipt.',
  },
  {
    question: 'Is our data secure?',
    answer:
      "Each Mahallu's data is kept fully separate. People see only what their role allows, sensitive records are restricted to named people, and every important action is logged.",
  },
  {
    question: 'Do you provide training and support?',
    answer:
      'Yes. Every Mahallu gets onboarding for the committee and office staff, and our support team is available to help whenever you need it.',
  },
];

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'For Members', href: '#for-members' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about-us' },
      { label: 'Contact', href: '#contact' },
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '#faq' },
      { label: 'Documentation', href: '#how-it-works' },
      { label: 'Contact Support', href: '#contact' },
    ],
  },
];
