import { CONTAINER } from '../styles';
import Reveal from './Reveal';

const COUNCIL_SITE = 'https://masjidcouncilkerala.org/';

/**
 * The Masjid Council Kerala banner between the features and the benefits; the whole image links to the
 * council's site. Phones get the taller artwork, where the wide one's text would be too small to read.
 */
export default function CouncilBanner() {
  return (
    <div className="pb-12 sm:pb-20">
      <div className={CONTAINER}>
        <Reveal variant="scale">
          <a
            href={COUNCIL_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-[18px] shadow-[0_18px_40px_-30px_rgba(25,32,36,0.35)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] hover:shadow-[0_24px_44px_-28px_rgba(21,96,59,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15603B] focus-visible:ring-offset-2"
          >
            <picture>
              <source media="(max-width: 767px)" srcSet="/mobile-banner.jpeg" width={1600} height={819} />
              <img
                src="/banner.jpeg"
                alt="Masjid Council Kerala – Making Mosques Centers of Excellence. Visit masjidcouncilkerala.org"
                width={1600}
                height={533}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </picture>
          </a>
        </Reveal>
      </div>
    </div>
  );
}
