import sanitizeHtmlLib, { IOptions } from 'sanitize-html';

/**
 * Allow-list sanitizer for the rich text the NOC editor produces.
 *
 * The CMS editor (RichTextEditor) is a contentEditable box driven by
 * `document.execCommand` — bold, italic, underline, font name, text colour,
 * undo/redo — so the markup it emits is b/i/u/strong/em, `<font face color>` (or
 * `<span style>` in Firefox) inside p/div/br wrappers, plus lists if text is
 * pasted in. Anything outside that set is dropped, and the stored value is
 * rendered with dangerouslySetInnerHTML on the NOC detail page, so this runs on
 * EVERY write path (validators, controllers and the model setter).
 *
 * Dropped, with their contents: script, style, iframe, object, embed, svg, math,
 * form controls, noscript, template. Dropped everywhere: every `on*` handler and
 * every attribute not listed below. Links keep http/https/mailto/tel only.
 */

const COLOR_PATTERNS = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i,
  /^[a-z]{3,20}$/i,
];

const ALLOWED_STYLES: IOptions['allowedStyles'] = {
  '*': {
    color: COLOR_PATTERNS,
    'background-color': COLOR_PATTERNS,
    'text-align': [/^(left|right|center|justify)$/i],
    'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
    'font-style': [/^(normal|italic|oblique)$/i],
    'text-decoration': [/^(none|underline|line-through)( (none|underline|line-through))*$/i],
    'font-family': [/^[\w\s,'"-]{1,120}$/],
    'font-size': [/^\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)$/i],
  },
};

const FONT_FACE = /^[\w\s,'"-]{1,120}$/;
const FONT_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i;
const FONT_SIZE = /^[1-7]$/;

const SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup',
    'p', 'br', 'div', 'span', 'blockquote',
    'ul', 'ol', 'li',
    'font', 'a',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    font: ['face', 'color', 'size'],
    p: ['style'],
    div: ['style'],
    span: ['style'],
    li: ['style'],
    blockquote: ['style'],
    b: ['style'],
    strong: ['style'],
    i: ['style'],
    em: ['style'],
    u: ['style'],
  },
  allowedStyles: ALLOWED_STYLES,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Drop these elements together with everything inside them (default is only
  // script/style/textarea/option, which would leak e.g. svg text content).
  nonTextTags: [
    'script', 'style', 'textarea', 'option', 'select', 'noscript', 'template',
    'iframe', 'object', 'embed', 'svg', 'math', 'form', 'frameset', 'applet',
  ],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer' },
    }),
    font: (tagName, attribs) => {
      const clean: Record<string, string> = {};
      if (attribs.face && FONT_FACE.test(attribs.face)) clean.face = attribs.face;
      if (attribs.color && FONT_COLOR.test(attribs.color)) clean.color = attribs.color;
      if (attribs.size && FONT_SIZE.test(attribs.size)) clean.size = attribs.size;
      return { tagName, attribs: clean };
    },
  },
};

/**
 * Returns `value` with anything outside the editor's allow-list removed.
 *
 * Non-strings are returned untouched (the caller's own type checks decide what
 * to do with them). A string with no `<` cannot contain a tag, so ordinary
 * plain text — including `&`, quotes and `>` — is returned byte-for-byte; the
 * browser renders entities in such text as text, never as markup.
 */
export function sanitizeRichText<T>(value: T): T {
  if (typeof value !== 'string') return value;
  if (!value.includes('<')) return value;
  return sanitizeHtmlLib(value, SANITIZE_OPTIONS) as unknown as T;
}
