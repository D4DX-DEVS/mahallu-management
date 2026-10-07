import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { sanitizeRichText } from '../utils/htmlSanitizer';
import Member from '../models/Member';
import { NOC } from '../models/Registration';
import { requestNOC, resubmitRegistration } from '../controllers/memberUserController';
import { createNOC, updateNOC } from '../controllers/registrationController';
import { nocRequestValidation, resubmitRegistrationValidation } from '../validations/memberUserValidation';
import { createNOCValidation, updateNOCValidation } from '../validations/registrationValidation';

/**
 * Stored XSS in NOC rich text. The purpose / description a member (or an admin)
 * submits is stored and later rendered with dangerouslySetInnerHTML by the CMS,
 * so every write path must keep only the markup the editor can produce.
 */

const clean = (html: string) => sanitizeRichText(html);

/* ---- the sanitizer ---------------------------------------------------- */

test('script elements are removed together with their contents', () => {
  const out = clean('<p>Hello</p><script>alert(1)</script>');
  assert.equal(out, '<p>Hello</p>');
  assert.ok(!/script|alert/i.test(out));
});

test('mixed-case and split script tags are neutralised', () => {
  for (const payload of ['<ScRiPt>alert(1)</sCrIpT>', '<scr<script>ipt>alert(1)</scr</script>ipt>', '<script\n>alert(1)</script\n>']) {
    const out = clean(payload);
    assert.ok(!/<\s*script/i.test(out), `${payload} -> ${out}`);
  }
});

test('event handler attributes are stripped, the element text is kept', () => {
  const img = clean('<img src=x onerror="alert(1)">');
  assert.ok(!/onerror|<img/i.test(img), img);
  const p = clean('<p onclick="alert(1)" onmouseover=alert(2)>Hi</p>');
  assert.equal(p, '<p>Hi</p>');
  const b = clean('<b OnLoAd="alert(1)">x</b>');
  assert.equal(b, '<b>x</b>');
});

test('javascript: links lose their href', () => {
  const out = clean('<a href="javascript:alert(1)">click</a>');
  assert.ok(!/javascript/i.test(out), out);
  assert.ok(!/href/i.test(out), out);
  assert.match(out, />click</);
});

test('data: and vbscript: URLs are removed', () => {
  const data = clean('<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>');
  assert.ok(!/data:|href/i.test(data), data);
  const vb = clean('<a href="vbscript:msgbox(1)">x</a>');
  assert.ok(!/vbscript|href/i.test(vb), vb);
  const img = clean('<img src="data:image/svg+xml;base64,AAAA">');
  assert.ok(!/<img|data:/i.test(img), img);
});

test('obfuscated javascript: URLs (whitespace, control characters, entities, case) are neutralised', () => {
  const payloads = [
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="java\nscript:alert(1)">x</a>',
    '<a href="  javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>',
    '<a href="&#x6A;avascript&colon;alert(1)">x</a>',
    '<a href="javascript&#58;alert(1)">x</a>',
    '<a href="\u0001javascript:alert(1)">x</a>',
  ];
  for (const payload of payloads) {
    const out = clean(payload);
    assert.ok(!/href/i.test(out), `${JSON.stringify(payload)} -> ${out}`);
    assert.ok(!/script/i.test(out.replace(/>x</, '')), out);
  }
});

test('svg, iframe, object, embed, math, form and style elements are removed', () => {
  const cases: Array<[string, RegExp]> = [
    ['<svg onload="alert(1)"><circle/></svg>', /svg|onload/i],
    ['<svg><script>alert(1)</script></svg>', /svg|alert/i],
    ['<iframe src="https://evil.example"></iframe>', /iframe|evil/i],
    ['<iframe srcdoc="<script>alert(1)</script>"></iframe>', /iframe|srcdoc|alert/i],
    ['<object data="x.swf"></object>', /object|x\.swf/i],
    ['<embed src="x.swf">', /embed|x\.swf/i],
    ['<math><mi xlink:href="javascript:alert(1)">x</mi></math>', /math|javascript/i],
    ['<form action="https://evil.example"><input name=a></form>', /form|input|evil/i],
    ['<style>body{background:url(javascript:alert(1))}</style>', /style|javascript/i],
  ];
  for (const [payload, forbidden] of cases) {
    const out = clean(`<p>ok</p>${payload}`);
    assert.ok(!forbidden.test(out), `${payload} -> ${out}`);
    assert.match(out, /^<p>ok<\/p>/);
  }
});

test('inline styles: layout/formatting kept, anything that can load or run code dropped', () => {
  const ok = clean('<span style="color: red; font-weight: bold; text-decoration: underline">x</span>');
  assert.match(ok, /color:red/);
  assert.match(ok, /font-weight:bold/);
  const bad = clean('<span style="background:url(javascript:alert(1)); position:fixed; behavior:url(x); width:expression(alert(1))">x</span>');
  assert.ok(!/url|expression|position|behavior|javascript/i.test(bad), bad);
});

test('unknown attributes and data attributes are dropped', () => {
  assert.equal(clean('<p id="a" class="b" data-x="1" formaction="x">Hi</p>'), '<p>Hi</p>');
});

test('safe formatting from the editor is preserved', () => {
  const html = '<p>To <b>whom</b> it <i>may</i> <u>concern</u>,<br></p><ul><li>one</li><li>two</li></ul><ol><li>a</li></ol>';
  assert.equal(clean(html), html.replace('<br>', '<br />'));
  const strong = '<p><strong>Subject</strong> and <em>more</em></p>';
  assert.equal(clean(strong), strong);
  const font = clean('<font face="Arial" color="#ff0000">x</font>');
  assert.equal(font, '<font face="Arial" color="#ff0000">x</font>');
});

test('font attributes that are not a plain face / colour / size are dropped', () => {
  const out = clean('<font face="a&quot; onload=&quot;alert(1)" color="expression(1)" size="9">x</font>');
  assert.equal(out, '<font>x</font>');
});

test('https, mailto and tel links are kept and always get rel="noopener noreferrer"', () => {
  const out = clean('<a href="https://example.com/a?b=1&c=2" target="_blank" rel="opener">site</a>');
  assert.match(out, /href="https:\/\/example\.com\/a\?b=1&amp;c=2"/);
  assert.match(out, /rel="noopener noreferrer"/);
  assert.ok(!/opener"/.test(out.replace('noopener noreferrer', '')), out);
  assert.ok(!/target/.test(out), out);
  assert.match(clean('<a href="mailto:a@b.com">m</a>'), /href="mailto:a@b\.com"/);
  assert.match(clean('<a href="tel:+911234567890">t</a>'), /href="tel:\+911234567890"/);
});

test('ftp and protocol-relative links are not allowed', () => {
  assert.ok(!/href/.test(clean('<a href="ftp://x.example/f">x</a>')));
  assert.ok(!/href/.test(clean('<a href="//evil.example/x">x</a>')));
});

test('plain text is returned unchanged', () => {
  for (const text of [
    'I need a certificate for travel.',
    'Fees & dues > 5 are paid; "quoted" and it\'s fine',
    'Rs 5 &amp; Rs 6',
    'മലയാളം text',
    '',
  ]) {
    assert.equal(clean(text), text);
  }
});

test('non-string values pass through for the validator / schema to judge', () => {
  assert.equal(sanitizeRichText(undefined), undefined);
  assert.equal(sanitizeRichText(null), null);
  assert.equal(sanitizeRichText(5 as any), 5);
});

test('sanitizing twice changes nothing (stored value is stable across edits)', () => {
  const once = clean('<p onclick="x">a &amp; b <script>1</script><a href="javascript:1">l</a> <b>b</b></p>');
  assert.equal(clean(once), once);
});

/* ---- write paths ------------------------------------------------------ */

const XSS = '<p>Need NOC</p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">go</a>';
const FORBIDDEN = /<script|onerror|javascript:|<img/i;

const runChains = async (chains: any[], body: any, params: any = {}) => {
  const req: any = { body, params, query: {} };
  for (const c of chains) await c.run(req);
  return { body: req.body, errors: validationResult(req).array().map((e: any) => `${e.path}: ${e.msg}`) };
};

test('validator: member NOC request sanitizes purpose and description', async () => {
  const { body, errors } = await runChains(nocRequestValidation, {
    type: 'common', purpose: XSS, purposeTitle: 'Title', purposeDescription: XSS,
  });
  assert.ok(!FORBIDDEN.test(body.purposeDescription), body.purposeDescription);
  assert.ok(!FORBIDDEN.test(body.purpose), body.purpose);
  assert.match(body.purposeDescription, /<p>Need NOC<\/p>/);
  assert.ok(!errors.some((e) => /purpose/i.test(e)), errors.join('|'));
});

test('validator: member NOC resubmit sanitizes purpose and description', async () => {
  const { body } = await runChains(resubmitRegistrationValidation, { purpose: XSS, purposeDescription: XSS },
    { type: 'noc', id: new mongoose.Types.ObjectId().toString() });
  assert.ok(!FORBIDDEN.test(body.purposeDescription), body.purposeDescription);
  assert.ok(!FORBIDDEN.test(body.purpose), body.purpose);
});

test('validator: admin create / update NOC sanitize purpose and description', async () => {
  const create = await runChains(createNOCValidation, {
    applicantName: 'Test Person', type: 'common', purposeTitle: 'Title', purposeDescription: XSS, purpose: XSS,
  });
  assert.ok(!FORBIDDEN.test(create.body.purposeDescription), create.body.purposeDescription);
  assert.ok(!FORBIDDEN.test(create.body.purpose), create.body.purpose);
  const update = await runChains(updateNOCValidation, { purposeDescription: XSS, purpose: XSS },
    { id: new mongoose.Types.ObjectId().toString() });
  assert.ok(!FORBIDDEN.test(update.body.purposeDescription), update.body.purposeDescription);
  assert.ok(!FORBIDDEN.test(update.body.purpose), update.body.purpose);
});

test('validator: plain text purpose / description are stored exactly as typed', async () => {
  const text = 'Travel to Dubai & back, amount > 5';
  const { body } = await runChains(nocRequestValidation, { type: 'common', purposeTitle: 'Travel', purposeDescription: text });
  assert.equal(body.purposeDescription, text);
});

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const MEMBER = { _id: oid(), tenantId: TENANT, name: 'Applicant', phone: '9876543210', isFamilyHead: true, familyId: oid() };

const call = async (fn: any, req: any) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await fn(req, res);
  return out;
};

test('controller: member requestNOC stores sanitized description even if the validator were bypassed', async () => {
  const origFind = Member.findById;
  const origSave = NOC.prototype.save;
  const origFindNoc = NOC.findById;
  const saved: any[] = [];
  (Member as any).findById = async () => MEMBER;
  (NOC.prototype as any).save = async function () { saved.push(this); return this; };
  (NOC as any).findById = () => ({ populate: async () => ({}) });
  try {
    const out = await call(requestNOC, {
      user: { memberId: MEMBER._id, phone: '9876543210' },
      body: { type: 'common', purposeTitle: 'Title', purposeDescription: XSS, remarks: 'r' },
    });
    assert.equal(out.status, 201);
    assert.equal(saved.length, 1);
    assert.ok(!FORBIDDEN.test(saved[0].purposeDescription), saved[0].purposeDescription);
    assert.match(saved[0].purposeDescription, /<p>Need NOC<\/p>/);
  } finally {
    (Member as any).findById = origFind;
    (NOC.prototype as any).save = origSave;
    (NOC as any).findById = origFindNoc;
  }
});

test('controller: member resubmit of a NOC stores sanitized purpose and description', async () => {
  const origFind = Member.findById;
  const origFindOne = NOC.findOne;
  const reg: any = { _id: oid(), documents: [], status: 'correction_required', save: async () => reg };
  (Member as any).findById = async () => MEMBER;
  (NOC as any).findOne = async () => reg;
  try {
    const out = await call(resubmitRegistration, {
      user: { memberId: MEMBER._id },
      params: { type: 'noc', id: String(reg._id) },
      body: { purposeDescription: XSS, purpose: XSS, purposeTitle: 'Title' },
    });
    assert.equal(out.status, 200);
    assert.ok(!FORBIDDEN.test(reg.purposeDescription), reg.purposeDescription);
    assert.ok(!FORBIDDEN.test(reg.purpose), reg.purpose);
    assert.equal(reg.purposeTitle, 'Title');
  } finally {
    (Member as any).findById = origFind;
    (NOC as any).findOne = origFindOne;
  }
});

test('controller: admin createNOC stores sanitized purpose and description', async () => {
  const origSave = NOC.prototype.save;
  const saved: any[] = [];
  (NOC.prototype as any).save = async function () { saved.push(this); return this; };
  try {
    const out = await call(createNOC, {
      tenantId: String(TENANT), isSuperAdmin: false, user: { name: 'Admin' },
      body: { applicantName: 'P', type: 'common', purposeTitle: 'T', purposeDescription: XSS, purpose: XSS },
    });
    assert.equal(out.status, 201);
    assert.ok(!FORBIDDEN.test(saved[0].purposeDescription), saved[0].purposeDescription);
    assert.ok(!FORBIDDEN.test(saved[0].purpose), saved[0].purpose);
  } finally {
    (NOC.prototype as any).save = origSave;
  }
});

test('controller: admin updateNOC sends sanitized purpose and description to the database', async () => {
  const origFindById = NOC.findById;
  const origUpdate = NOC.findByIdAndUpdate;
  let update: any;
  (NOC as any).findById = async () => ({ _id: oid(), tenantId: TENANT });
  (NOC as any).findByIdAndUpdate = (_id: any, data: any) => {
    update = data;
    const chain: any = { populate: () => chain, then: (r: any) => r({}) };
    return chain;
  };
  try {
    const out = await call(updateNOC, {
      tenantId: String(TENANT), isSuperAdmin: false, user: { name: 'Admin' },
      params: { id: String(oid()) }, body: { purposeDescription: XSS, purpose: XSS },
    });
    assert.equal(out.status, 200);
    assert.ok(!FORBIDDEN.test(update.purposeDescription), update.purposeDescription);
    assert.ok(!FORBIDDEN.test(update.purpose), update.purpose);
  } finally {
    (NOC as any).findById = origFindById;
    (NOC as any).findByIdAndUpdate = origUpdate;
  }
});

test('model: the NOC schema itself refuses unsafe markup, on construction and on assignment', () => {
  const doc: any = new NOC({
    tenantId: TENANT, applicantName: 'P', type: 'common', purposeDescription: XSS, purpose: XSS,
  });
  assert.ok(!FORBIDDEN.test(doc.purposeDescription), doc.purposeDescription);
  assert.ok(!FORBIDDEN.test(doc.purpose), doc.purpose);
  doc.purposeDescription = '<svg onload=alert(1)>x</svg><b>kept</b>';
  assert.equal(doc.purposeDescription, '<b>kept</b>');
});
