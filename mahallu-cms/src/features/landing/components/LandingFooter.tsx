import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import { BRAND_NAME, BRAND_TAGLINE } from '@/constants/theme';
import BrandLogo from './BrandLogo';
import { CONTACT, FOOTER_LINKS, POWERED_BY } from '../content';
import { BTN_INVERSE, CONTAINER } from '../styles';
import { RequestDemoButton } from './shared';
import Reveal from './Reveal';

function ContactRow({ icon: Icon, label, children }: { icon: IconType; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#8EDCB3]">
        <Icon className="h-[14px] w-[14px]" aria-hidden="true" />
      </span>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

export default function LandingFooter() {
  return (
    <footer className="relative z-10 bg-[#0E3B27] text-white">
      <div className={`${CONTAINER} grid grid-cols-[auto_minmax(0,1fr)] gap-8 py-10 sm:grid-cols-2 sm:gap-10 sm:py-14 lg:grid-cols-[1.5fr_1fr_1.3fr]`}>
        {/* Phones: the brand and demo button on top, then quick links and contact side by side. */}
        <Reveal className="col-span-2 lg:col-span-1">
          <BrandLogo tone="light" tagline={false} />
          <p className="mt-5 max-w-[280px] text-[13px] leading-[1.65] text-white/75">{BRAND_TAGLINE}</p>
          <RequestDemoButton label={CONTACT.demoLabel} className={`${BTN_INVERSE} mt-6 px-5 py-[10px] text-[13px]`} />
        </Reveal>

        <Reveal delay={100}>
          <nav aria-label="Quick links">
            <p className="text-[14px] font-bold">Quick links</p>
            <ul className="mt-4 space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-[13px] text-white/75 transition hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Reveal>

        <Reveal delay={200}>
          <p className="text-[14px] font-bold">Contact us</p>
          <dl className="mt-4 space-y-3 text-[13px] leading-[1.6]">
            <ContactRow icon={FiPhone} label="Mobile">
              <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="text-white/85 transition hover:text-white">
                {CONTACT.phone}
              </a>
            </ContactRow>
            <ContactRow icon={FiMail} label="Mail ID">
              <a href={`mailto:${CONTACT.email}`} className="break-all text-white/85 transition hover:text-white">
                {CONTACT.email}
              </a>
            </ContactRow>
            <ContactRow icon={FiMapPin} label="Address">
              <address className="not-italic text-white/85">
                {CONTACT.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </ContactRow>
          </dl>
        </Reveal>
      </div>

      <div className="border-t border-white/10">
        <div className={`${CONTAINER} flex flex-col gap-3 py-5 text-[12px] text-white/60 sm:flex-row sm:items-center sm:justify-between`}>
          <p>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          <a
            href={POWERED_BY.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 transition hover:text-white"
          >
            Powered by
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white p-[3px]">
              <img src={POWERED_BY.logo} alt="" className="h-full w-full object-contain" />
            </span>
            <span className="font-semibold text-white/85 group-hover:text-white">{POWERED_BY.name}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
