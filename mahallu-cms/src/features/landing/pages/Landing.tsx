import { useCallback, useEffect, useState } from 'react';
import LandingHeader from '../components/LandingHeader';
import HeroSection from '../components/HeroSection';
import ScriptureSection from '../components/ScriptureSection';
import StatsStrip from '../components/StatsStrip';
import { HowItWorks, KeyFeatures } from '../components/FeaturesSection';
import BenefitsSection from '../components/BenefitsSection';
import ProductSection from '../components/ProductSection';
import AboutSection from '../components/AboutSection';
import LandingFooter from '../components/LandingFooter';
import DemoRequestDialog from '../components/DemoRequestDialog';
import { DemoRequestContext } from '../demoRequestContext';
import '../landing.css';

/**
 * The public front door at "/". Everything on it is static marketing content;
 * the sign-in page is reached from its header, and every "Request a demo"
 * button opens the one demo-request form owned here.
 *
 * On wide screens the hero is pinned (see HeroSection) and the rest of the
 * page is a raised sheet that slides over it as the visitor scrolls.
 */
export default function Landing() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = useCallback(() => setDemoOpen(true), []);

  // In-page anchors glide to their section while this page is mounted.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'smooth';
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  // "#home" must always mean the top of the page. On wide screens the hero is `position: sticky`, so it
  // counts as already in view wherever the visitor is, and the browser's own jump to "#home" barely scrolls.
  useEffect(() => {
    const goTop = () => window.scrollTo({ top: 0 });
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href="#home"]');
      if (!link) return;
      event.preventDefault();
      if (window.location.hash !== '#home') window.location.hash = '#home';
      goTop();
    };
    // Back/forward onto a "#home" entry, or a hand-typed hash, goes through the same sticky-hero jump.
    const onHashChange = () => {
      if (window.location.hash === '#home') goTop();
    };
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return (
    <DemoRequestContext.Provider value={openDemo}>
      <div className="min-h-screen overflow-x-clip bg-white font-landing text-[#192024] antialiased">
        <LandingHeader />
        <main>
          <HeroSection />
          <div className="relative z-10 bg-white lg:shadow-[0_-30px_80px_-40px_rgba(21,96,59,0.5)]">
            <ScriptureSection />
            <StatsStrip />
            <KeyFeatures />
            <BenefitsSection />
            <AboutSection />
            <HowItWorks />
            <ProductSection />
          </div>
        </main>
        <LandingFooter />
      </div>
      <DemoRequestDialog isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
    </DemoRequestContext.Provider>
  );
}
