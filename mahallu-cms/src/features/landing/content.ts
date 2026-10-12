/*
 * Copy and data for the public landing page, kept apart from the components so
 * the words can be edited without touching layout.
 */
import type { IconType } from 'react-icons';
import { FiUsers, FiFileText, FiBarChart2, FiBox, FiBell, FiShield } from 'react-icons/fi';
import { FaMosque, FaCoins } from 'react-icons/fa';

export interface NavLink {
  label: string;
  href: string;
  /** The section id the link scrolls to, used to mark the active link. */
  section: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '#home', section: 'home' },
  { label: 'Features', href: '#features', section: 'features' },
  { label: 'About Us', href: '#about-us', section: 'about-us' },
];

export const HERO = {
  background: '/banner-bg.png',
  eyebrow: 'The digital office for your Mahallu',
  headline: ['മഹല്ല് ഭരണനിർവഹണത്തിനുള്ള', 'സമഗ്ര ഡിജിറ്റൽ പരിഹാരം'],
  body: 'മഹല്ല് കുടുംബങ്ങളുടെ വിവരശേഖരണം മുതൽ വരിസംഖ്യാ പിരിവ്, അക്കൗണ്ടിംഗ്, സർട്ടിഫിക്കറ്റ് വിതരണം, പൊതുഅറിയിപ്പുകൾ തുടങ്ങി ദൈനംദിന ഭരണപ്രവർത്തനങ്ങൾ വരെ — എല്ലാം ഒരൊറ്റ ഡിജിറ്റൽ സംവിധാനത്തിലൂടെ ലളിതവും കാര്യക്ഷമവുമാക്കാം.',
  /** Each point is a Malayalam lead-in and the English product name, which is set apart. */
  trust: [
    { lead: 'മഹല്ല് ഭരണസമിതിക്കായി', highlight: 'Web Edition' },
    { lead: 'മഹല്ല് നിവാസികൾക്കായി സൗകര്യപ്രദമായ', highlight: 'Mobile App' },
    { lead: 'ഓരോ മഹല്ലിന്റെയും ആവശ്യങ്ങൾക്കനുസരിച്ചുള്ള', highlight: 'Customizable Features' },
  ],
};

export interface Scripture {
  /** The original Arabic, shown above the Malayalam when there is one. */
  arabic?: string;
  text: string;
  source: string;
}

/* The ayah and hadith shown right after the hero, word for word as given. */
export const SCRIPTURE: Scripture[] = [
  {
    arabic: 'إِنَّمَا يَعْمُرُ مَسَٰجِدَ ٱللَّهِ مَنْ ءَامَنَ بِٱللَّهِ وَٱلْيَوْمِ ٱلْءَاخِرِ وَأَقَامَ ٱلصَّلَوٰةَ وَءَاتَى ٱلزَّكَوٰةَ وَلَمْ يَخْشَ إِلَّا ٱللَّهَ  ۖ',
    text: '“അല്ലാഹുവിന്റെ പള്ളികള്‍ പരിപാലിക്കേണ്ടത് അല്ലാഹുവിലും അന്ത്യദിനത്തിലും വിശ്വസിക്കുകയും നമസ്‌കാരം നിഷ്ഠയോടെ നിര്‍വഹിക്കുകയും സകാത്ത് നല്‍കുകയും അല്ലാഹുവെയല്ലാതെ ഒന്നിനെയും ഭയപ്പെടാതിരിക്കുകയും ചെയ്യുന്നവര്‍ മാത്രമാണ്.”',
    source: 'സൂറത്തുത്തൗബ 9:18',
  },
  {
    arabic: 'كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْؤُولٌ عَنْ رَعِيَّتِهِ',
    text: '“നിങ്ങളോരോരുത്തരും ഉത്തരവാദിത്തമുള്ളവരാണ്. നിങ്ങളോരോരുത്തരും തങ്ങളുടെ ഉത്തരവാദിത്തത്തിലുള്ളവരെക്കുറിച്ച് ചോദിക്കപ്പെടുന്നതാണ്.”',
    source: 'സ്വഹീഹുൽ ബുഖാരി',
  },
];

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
    title: 'വരിസംഖ്യാ പിരിവും സംഭാവനാ മാനേജ്‌മെന്റും',
    body: 'മാസവരി, വാർഷിക വരിസംഖ്യ, റമദാൻ പിരിവ്, സംഭാവനകൾ എന്നിവ രേഖപ്പെടുത്തുക. പേയ്‌മെന്റ് നില പരിശോധിക്കുക, രസീതുകൾ തയ്യാറാക്കുക, ലഭിച്ച തുകയും ലഭിക്കാനുള്ള തുകയും നിരീക്ഷിക്കുക. പിന്തുണയ്ക്കുന്ന സംവിധാനങ്ങൾ വഴി SMS/WhatsApp അറിയിപ്പുകളും കൈമാറാം.',
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
    title: 'അക്കൗണ്ടിംഗും സാമ്പത്തിക റിപ്പോർട്ടുകളും',
    body: 'വരവ്–ചെലവ് ഇടപാടുകൾ, ഫണ്ടുകൾ, സംഭാവനകൾ എന്നിവ ക്രമമായി രേഖപ്പെടുത്തുക. സാമ്പത്തിക അവലോകനത്തിനും ഓഡിറ്റ് നടപടികൾക്കും ആവശ്യമായ റിപ്പോർട്ടുകൾ തയ്യാറാക്കുക.',
    icon: FiBarChart2,
    tint: { bg: '#FDE8E8', fg: '#D13B3B' },
  },
  {
    title: 'മഹല്ല് നോട്ടീസ് ബോർഡും അറിയിപ്പുകളും',
    body: 'മരണവാർത്തകൾ, മഹല്ല് യോഗങ്ങൾ, ദീനിപരിപാടികൾ, പൊതുഅറിയിപ്പുകൾ തുടങ്ങിയവ നിവാസികളിലേക്ക് സമയബന്ധിതമായി എത്തിക്കുക.',
    icon: FiBell,
    tint: { bg: '#E6EEFF', fg: '#2F62D3' },
  },
  {
    title: 'സുരക്ഷിതമായ വിവരസംരക്ഷണം',
    body: 'അംഗീകൃത ഉപയോക്താക്കൾക്ക് മാത്രം ആവശ്യമായ വിവരങ്ങൾ ലഭ്യമാക്കുന്ന നിയന്ത്രണങ്ങൾ, ഉപയോക്തൃ അധികാരങ്ങൾ, ഡാറ്റാ ബാക്കപ്പ്, വീണ്ടെടുക്കൽ എന്നിവയ്ക്കുള്ള അനുയോജ്യമായ സംവിധാനങ്ങൾ.',
    icon: FiShield,
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
};

export const DEMO_BAND = {
  headline: 'നിങ്ങളുടെ മഹല്ലിനെ ഡിജിറ്റൽ യുഗത്തിലേക്ക് നയിക്കൂ',
  body: 'മഹല്ലിന്റെ ഭരണപ്രവർത്തനങ്ങൾ കൂടുതൽ ചിട്ടയോടെയും കാര്യക്ഷമതയോടെയും നിർവഹിക്കാൻ ആഗ്രഹിക്കുന്നുണ്ടോ? ZAAD പരിചയപ്പെടൂ. നിങ്ങളുടെ മഹല്ലിന്റെ ആവശ്യങ്ങൾ പങ്കുവെക്കൂ. അനുയോജ്യമായ ഡിജിറ്റൽ പരിഹാരം കണ്ടെത്തൂ.',
};

export const ABOUT = {
  heading: 'ഞങ്ങളെക്കുറിച്ച്',
  /** This phrase in the paragraphs links to the council's site. */
  link: { text: 'Masjid Council Kerala – masjidcouncilkerala.org', href: 'https://masjidcouncilkerala.org/' },
  paragraphs: [
    'ZAAD മഹല്ലുകളുടെ ഭരണനിർവഹണം കൂടുതൽ ലളിതവും സുതാര്യവും കാര്യക്ഷമവുമാക്കുന്നതിനായി രൂപകൽപ്പന ചെയ്ത സമഗ്ര ഡിജിറ്റൽ പ്ലാറ്റ്‌ഫോമാണ്. മസ്ജിദ് കൗൺസിൽ കേരളയുടെ (Masjid Council Kerala – masjidcouncilkerala.org) പെയ്ഡ് സംരംഭമാണ് ZAAD. മഹല്ല് ഭരണസമിതികൾക്കായി വെബ് എഡിഷനും മഹല്ല് നിവാസികൾക്കായി മൊബൈൽ ആപ്പും ഇതിലൂടെ ലഭ്യമാക്കുന്നു.',
    'കുടുംബവിവര ശേഖരണം, വരിസംഖ്യാ പിരിവ്, സർട്ടിഫിക്കറ്റ് വിതരണം, അക്കൗണ്ടിംഗ്, സാമ്പത്തിക റിപ്പോർട്ടുകൾ, പൊതുഅറിയിപ്പുകൾ തുടങ്ങിയ പ്രവർത്തനങ്ങൾ ഒരൊറ്റ സംവിധാനത്തിലൂടെ ഏകോപിപ്പിക്കാൻ ZAAD സഹായിക്കുന്നു.',
    'ഓരോ മഹല്ലിന്റെയും ആവശ്യങ്ങൾക്കനുസരിച്ച് സൗകര്യങ്ങൾ ക്രമീകരിക്കാനും പുതിയ സംവിധാനങ്ങൾ കൂട്ടിച്ചേർക്കാനും കഴിയുന്ന രീതിയിലാണ് ZAAD രൂപകൽപ്പന ചെയ്തിരിക്കുന്നത്. മഹല്ല് ഭരണത്തിൽ സുതാര്യതയും കൃത്യതയും കാര്യക്ഷമതയും പ്രോത്സാഹിപ്പിക്കുകയാണ് ഈ സംരംഭത്തിന്റെ ലക്ഷ്യം.',
  ],
};

/** Section shortcuts in the footer, in page order. */
export const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'About Us', href: '#about-us' },
  { label: 'How it works', href: '#how-it-works' },
];

export const CONTACT = {
  phone: '+91 9562478805',
  email: 'help.zaad@gmail.com',
  address: ['Masjid Council Kerala,', 'Hira Centre, PB No. 833,', 'Mavoor Road, Kozhikode - 4,', '673004'],
  demoLabel: 'സൗജന്യ ഡെമോ ആവശ്യപ്പെടുക',
};

export const POWERED_BY = {
  name: 'D4DX Innovations LLP',
  href: 'https://d4dx.co',
  logo: '/d4dx_logo.png',
};
