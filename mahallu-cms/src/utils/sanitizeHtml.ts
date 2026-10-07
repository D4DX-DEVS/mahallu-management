import DOMPurify from 'dompurify';

/**
 * Allow-list HTML sanitizer for the NOC rich text. It mirrors the server policy
 * in mahallu-api/src/utils/htmlSanitizer.ts: only the markup the RichTextEditor
 * can produce survives. The server sanitizes on every write; this is the second
 * layer, applied on every read that ends up in innerHTML (and so also protects
 * against records stored before the server fix).
 *
 * Removed: script, style, iframe, object, embed, svg, math, form controls, every
 * `on*` handler, and any URL that is not http(s), mailto or tel.
 */

const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup',
  'p', 'br', 'div', 'span', 'blockquote',
  'ul', 'ol', 'li',
  'font', 'a',
];

const ALLOWED_ATTR = ['href', 'title', 'rel', 'face', 'color', 'size', 'style'];

const FORBID_TAGS = [
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form',
  'input', 'button', 'select', 'textarea', 'option', 'link', 'meta', 'base',
  'frame', 'frameset', 'applet', 'noscript', 'template',
];

// Elements dropped together with their text, not just unwrapped.
const FORBID_CONTENTS = [
  ...FORBID_TAGS,
  'annotation-xml', 'audio', 'colgroup', 'desc', 'foreignobject', 'head', 'mi', 'mn', 'mo',
  'ms', 'mtext', 'noembed', 'noframes', 'plaintext', 'thead', 'title', 'video', 'xmp',
];

// DOMPurify's default pattern with the scheme list cut down to http(s), mailto and tel.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

const COLOR_PATTERNS = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i,
  /^[a-z]{3,20}$/i,
];

const ALLOWED_STYLES: Record<string, RegExp[]> = {
  color: COLOR_PATTERNS,
  'background-color': COLOR_PATTERNS,
  'text-align': [/^(left|right|center|justify)$/i],
  'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
  'font-style': [/^(normal|italic|oblique)$/i],
  'text-decoration': [/^(none|underline|line-through)( (none|underline|line-through))*$/i],
  'font-family': [/^[\w\s,'"-]{1,120}$/],
  'font-size': [/^\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)$/i],
};

const FONT_FACE = /^[\w\s,'"-]{1,120}$/;
const FONT_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i;
const FONT_SIZE = /^[1-7]$/;

/** Keeps only the allow-listed declarations of an inline style; '' when none are left. */
const filterStyle = (style: string): string =>
  style
    .split(';')
    .map((declaration) => {
      const at = declaration.indexOf(':');
      if (at < 0) return '';
      const property = declaration.slice(0, at).trim().toLowerCase();
      const value = declaration.slice(at + 1).trim();
      const patterns = ALLOWED_STYLES[property];
      return patterns && patterns.some((pattern) => pattern.test(value)) ? `${property}: ${value}` : '';
    })
    .filter(Boolean)
    .join('; ');

let hooked = false;
const installHooks = () => {
  if (hooked) return;
  hooked = true;

  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    const name = data.attrName;
    if (name === 'style') {
      const filtered = filterStyle(data.attrValue);
      if (filtered) data.attrValue = filtered;
      else data.keepAttr = false;
      return;
    }
    if (node.nodeName === 'FONT') {
      const value = data.attrValue;
      const valid =
        (name === 'face' && FONT_FACE.test(value)) ||
        (name === 'color' && FONT_COLOR.test(value)) ||
        (name === 'size' && FONT_SIZE.test(value));
      if (!valid) data.keepAttr = false;
    }
  });

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      node.removeAttribute('target');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
};

/**
 * Returns `html` reduced to the editor's allow-list. Fails closed: if the
 * browser APIs DOMPurify needs are missing, nothing is returned.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (!DOMPurify.isSupported) return '';
  installHooks();
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_CONTENTS,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  }) as string;
}
