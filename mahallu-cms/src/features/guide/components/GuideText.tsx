import { Fragment } from 'react';

/**
 * Guide copy is Malayalam with the names of on-screen controls left in English
 * and wrapped in **double asterisks**. Those render as a small "key cap" so the
 * reader can tell at a glance which words to look for on the screen.
 */
export default function GuideText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} lang="en" className="guide-ui-label">
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  );
}
