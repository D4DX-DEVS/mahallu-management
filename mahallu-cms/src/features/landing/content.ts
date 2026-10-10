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
];

export const HERO = {
  eyebrow: 'The digital office for your Mahallu',
  headline: ['Know every family.', 'Serve every need.'],
  body: 'ZAAD helps your Mahallu manage family records, collections, certificates, welfare, accounts and more — all in one secure and easy-to-use system.',
  trust: ['Works on mobile', 'Secure & reliable', 'Built for Kerala Mahallus'],
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
    title: 'Family records',
    body: 'Maintain a complete and up-to-date register of every family and member.',
    icon: FiUsers,
    tint: { bg: '#E6F4EC', fg: '#1F8A55' },
  },
  {
    title: 'Varisangya collections',
    body: 'Collect dues online or offline with clear reports and payment history.',
    icon: FaCoins,
    tint: { bg: '#FFF3DC', fg: '#D9900A' },
  },
  {
    title: 'Nikah & death certificates',
    body: 'Register marriages and deaths, and issue certificates and NOCs with ease.',
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
    title: 'Accounts & reports',
    body: 'Manage income, expenses and budgets with audit-ready reports.',
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
  headline: 'From paper registers to a well-run community.',
  body: 'No more lost records, duplicate entries or confusing spreadsheets. ZAAD gives you a secure, organised and transparent system that works for your Mahallu today and for the next generation.',
  points: [
    'Access from office or mobile',
    'Role-based access for committee, staff and volunteers',
    'Secure data with regular backups',
    'Built with the needs of Kerala Mahallus in mind',
  ],
};

export const DEMO_BAND = {
  headline: 'Ready to see ZAAD in action?',
  body: 'Book a free demo and see how ZAAD can help your Mahallu work better, serve faster and grow together.',
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
      { label: 'About', href: '#home' },
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
