import { test } from 'node:test';
import assert from 'assert/strict';
import { ASSISTANT_TOOLS, toolSchema, SYSTEM_PROMPT, DEFAULT_MODEL } from '../controllers/assistantController';

// Task C4 — the assistant's contract: a fixed read-only tool whitelist, a
// tenant-bound runner, and a prompt that keeps answers in the user's language.

test('default model is Gemini 2.5 Flash on OpenRouter', () => {
  assert.equal(DEFAULT_MODEL, 'google/gemini-2.5-flash');
});

test('tool whitelist is read-only aggregates only', () => {
  const names = ASSISTANT_TOOLS.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'get_annual_report',
    'get_community_summary',
    'get_development_index',
    'get_education_summary',
    'get_employment_summary',
    'get_finance_summary',
    'get_programs_and_projects_summary',
    'get_welfare_summary',
    'get_zakat_summary',
  ]);
  // Nothing that writes, deletes or reads an individual record.
  names.forEach((n) => assert.ok(/^get_/.test(n), `${n} is not a read-only tool`));
});

test('every tool takes tenantId as its first argument', () => {
  ASSISTANT_TOOLS.forEach((t) => {
    assert.equal(typeof t.run, 'function');
    // (tenantId, args) — the model supplies only the second one.
    assert.ok(t.run.length >= 1, `${t.name} does not accept tenantId`);
  });
});

test('no tool exposes a tenant parameter to the model', () => {
  ASSISTANT_TOOLS.forEach((t) => {
    const props = Object.keys(t.parameters?.properties || {});
    props.forEach((p) => assert.ok(!/tenant/i.test(p), `${t.name} lets the model choose the tenant`));
  });
});

test('tool schema is OpenAI-compatible', () => {
  const schema = toolSchema();
  assert.equal(schema.length, ASSISTANT_TOOLS.length);
  schema.forEach((s) => {
    assert.equal(s.type, 'function');
    assert.ok(s.function.name);
    assert.ok(s.function.description.length > 10);
    assert.equal(s.function.parameters.type, 'object');
  });
});

test('system prompt pins Malayalam answering and no invented figures', () => {
  assert.match(SYSTEM_PROMPT, /Malayalam/);
  assert.match(SYSTEM_PROMPT, /Manglish/);
  assert.match(SYSTEM_PROMPT, /സകാത്ത്/);
  assert.match(SYSTEM_PROMPT, /Never invent a figure/);
});
