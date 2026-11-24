import { useLocation, useNavigate } from 'react-router-dom';
import { RiBookOpenLine, RiCheckLine } from 'react-icons/ri';
import { Button, Modal } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { useGuideProgress, useUserGuideProgress } from '../guideProgress';
import GuideText from './GuideText';

const COVERS = [
  'കുടുംബങ്ങൾ, അംഗങ്ങൾ, കുടുംബനാഥൻ, ലോഗിൻ വിവരങ്ങൾ',
  'പള്ളി, കമ്മിറ്റി, യോഗങ്ങൾ, ആസ്തികൾ, നിക്കാഹ് / മരണ രജിസ്ട്രേഷൻ, സർട്ടിഫിക്കറ്റ്',
  'വരിസംഖ്യ, അക്കൗണ്ട്, ലെഡ്ജർ, റിപ്പോർട്ടുകൾ, സ്ഥാപനങ്ങൾ, അറിയിപ്പുകൾ, യൂസർമാർ',
];

/**
 * Offered once, the first time a Mahallu admin lands on the dashboard. Either
 * answer — start or skip — is remembered for that user; the guide itself stays
 * in the sidebar ("User guide") for whenever they want it.
 */
export default function GuideWelcome() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isImpersonating = useAuthStore((state) => state.isImpersonating);
  const progress = useUserGuideProgress(user?.id);
  const setWelcomed = useGuideProgress((state) => state.setWelcomed);

  const shouldOffer =
    Boolean(user?.id) &&
    user?.role === 'mahall' &&
    !isImpersonating &&
    // A password an administrator issued is changed first; that page comes before any tour.
    !user?.passwordResetRequired &&
    !progress.welcomed &&
    pathname === ROUTES.DASHBOARD;

  if (!shouldOffer || !user) return null;

  const skip = () => setWelcomed(user.id);
  const start = () => {
    setWelcomed(user.id);
    navigate(ROUTES.GUIDE);
  };

  return (
    <Modal
      isOpen
      onClose={skip}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={skip}>
            പിന്നീട് നോക്കാം
          </Button>
          <Button onClick={start} icon={<RiBookOpenLine />}>
            ഗൈഡ് തുടങ്ങുക
          </Button>
        </>
      }
    >
      <div className="guide-prose" lang="ml">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <RiBookOpenLine className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground">ZAAD-ലേക്ക് സ്വാഗതം!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          മഹല്ല് അഡ്മിൻ എന്ന നിലയിൽ ചെയ്യേണ്ട കാര്യങ്ങളെല്ലാം ചിത്രങ്ങളോടുകൂടി, ഘട്ടം ഘട്ടമായി മലയാളത്തിൽ വിശദീകരിക്കുന്ന ഒരു ഗൈഡ്
          നിങ്ങൾക്കായി തയ്യാറാണ്.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-foreground">
          {COVERS.map((line) => (
            <li key={line} className="flex gap-2.5">
              <RiCheckLine className="mt-1 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
          <GuideText text="ഇപ്പോൾ ഒഴിവാക്കിയാലും കുഴപ്പമില്ല — സൈഡ്‌ബാറിലെ **User guide** വഴി ഈ ഗൈഡ് എപ്പോൾ വേണമെങ്കിലും തുറക്കാം." />
        </p>
      </div>
    </Modal>
  );
}
