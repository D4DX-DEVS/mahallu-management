import { useCallback, useEffect, useState } from 'react';
import LandingHeader from '../components/LandingHeader';
import HeroSection from '../components/HeroSection';
import StatsStrip from '../components/StatsStrip';
import FeaturesSection from '../components/FeaturesSection';
import ProductSection from '../components/ProductSection';
import CommunitySection from '../components/CommunitySection';
import FaqSection from '../components/FaqSection';
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

  return (
    <DemoRequestContext.Provider value={openDemo}>
      <div className="min-h-screen overflow-x-clip bg-white font-sans text-[#192024] antialiased">
        <LandingHeader />
        <main>
          <HeroSection />
          <div className="relative z-10 bg-white lg:shadow-[0_-30px_80px_-40px_rgba(21,96,59,0.5)]">
            <StatsStrip />
            <FeaturesSection />
            <ProductSection />
            <CommunitySection />
            <FaqSection />
          </div>
        </main>
        <LandingFooter />
      </div>
      <DemoRequestDialog isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
    </DemoRequestContext.Provider>
  );
}
