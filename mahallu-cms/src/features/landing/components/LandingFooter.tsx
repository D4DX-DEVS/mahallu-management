import { useState, type FormEvent } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import { FaYoutube, FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { BRAND_NAME } from '@/constants/theme';
import BrandLogo from './BrandLogo';
import { FOOTER_COLUMNS } from '../content';
import { CONTAINER } from '../styles';
import Reveal from './Reveal';

const SOCIAL_LINKS = [
  { label: 'YouTube', icon: FaYoutube, href: '#' },
  { label: 'Facebook', icon: FaFacebookF, href: '#' },
  { label: 'Instagram', icon: FaInstagram, href: '#' },
  { label: 'LinkedIn', icon: FaLinkedinIn, href: '#' },
];

export default function LandingFooter() {
  const [subscribed, setSubscribed] = useState(false);

  // There is no mailing list yet: acknowledge the address locally so the form is not a dead end.
  const onSubscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubscribed(true);
  };

  return (
    <footer className="relative z-10 bg-[#0E3B27] text-white">
      <div className={`${CONTAINER} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.6fr]`}>
        <Reveal className="sm:col-span-2 lg:col-span-1">
          <BrandLogo tone="light" />
          <p className="mt-5 max-w-[280px] text-[13px] leading-[1.65] text-white/75">
            A digital office for Mahallus. Know every family. Serve every need. Develop the community.
          </p>
          <ul className="mt-5 flex gap-2">
            {SOCIAL_LINKS.map(({ label, icon: Icon, href }) => (
              <li key={label}>
                <a
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition-[background-color,color,transform] duration-200 hover:-translate-y-[2px] hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Reveal>

        {FOOTER_COLUMNS.map((column, index) => (
          <Reveal key={column.title} delay={100 + index * 90}>
            <nav aria-label={column.title}>
            <p className="text-[14px] font-bold">{column.title}</p>
            <ul className="mt-4 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-[13px] text-white/75 transition hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            </nav>
          </Reveal>
        ))}

        <Reveal className="sm:col-span-2 lg:col-span-1" delay={400}>
          <p className="text-[14px] font-bold">Subscribe to updates</p>
          <p className="mt-2 text-[13px] text-white/75">Get the latest news and updates from {BRAND_NAME}.</p>
          <form onSubmit={onSubscribe} className="mt-4 flex items-center rounded-full bg-white p-1 pl-4">
            <label htmlFor="landing-subscribe-email" className="sr-only">
              Email address
            </label>
            <input
              id="landing-subscribe-email"
              type="email"
              required
              placeholder="Enter your email"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#192024] placeholder:text-[#8A949A] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Subscribe"
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#15603B] text-white transition hover:bg-[#124F31]"
            >
              <FiArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-[2px]" aria-hidden="true" />
            </button>
          </form>
          {subscribed && (
            <p className="mt-2 text-[12px] text-[#8EDCB3]" role="status">
              Thanks! We will keep you posted.
            </p>
          )}
        </Reveal>
      </div>

      <div className="border-t border-white/10">
        <div className={`${CONTAINER} flex flex-col gap-2 py-5 text-[12px] text-white/60 sm:flex-row sm:items-center sm:justify-between`}>
          <p>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          <p>
            Made for Mahallus in Kerala
            <span className="mx-3">|</span>
            Know · Serve · Develop
          </p>
        </div>
      </div>
    </footer>
  );
}
