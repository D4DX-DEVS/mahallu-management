import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

/*
 * The user guide is three things that have to agree: the chapter text
 * (src/features/guide/content/chapters), the screenshots (public/guide) and the
 * indicator positions (shots.json). Nothing at build time notices when one of
 * them is edited without the others — the page just shows a broken image, or a
 * step whose number has no indicator. Read as text on purpose: the chapter
 * modules import icon components and are not loadable under plain Node.
 */

const CHAPTERS_DIR = new URL('../src/features/guide/content/chapters/', import.meta.url);
const SHOTS_FILE = new URL('../src/features/guide/content/shots.json', import.meta.url);
const IMAGES_DIR = new URL('../public/guide/', import.meta.url);

const chapterSource = readdirSync(CHAPTERS_DIR)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => readFileSync(new URL(name, CHAPTERS_DIR), 'utf8'))
  .join('\n');

const shots: Record<string, { w: number; h: number; marks: { n: number; x: number; y: number; w: number; h: number }[] }> =
  JSON.parse(readFileSync(SHOTS_FILE, 'utf8'));

const figures = [...chapterSource.matchAll(/figure: '([^']+)'/g)].map((match) => match[1]);
const images = readdirSync(IMAGES_DIR)
  .filter((name) => name.endsWith('.webp'))
  .map((name) => name.replace(/\.webp$/, ''));

/** Each section as { figure, steps } — a section is one object literal holding an `id:` and a `title:`. */
function sections() {
  const result: { id: string; figure?: string; steps: number }[] = [];
  const starts = [...chapterSource.matchAll(/\n {8}id: '([^']+)',/g)];
  starts.forEach((start, index) => {
    const body = chapterSource.slice(start.index, starts[index + 1]?.index ?? chapterSource.length);
    const stepsBlock = /\n {8}steps: \[([\s\S]*?)\n {8}\],|\n {8}steps: \[(.*)\],/.exec(body);
    const stepText = stepsBlock ? (stepsBlock[1] ?? stepsBlock[2] ?? '') : '';
    // A step is one string literal; its closing quote is followed by a comma or the end of the list.
    const steps = stepText ? stepText.split(/',\s*(?=')|',?\s*$/).filter((piece) => piece.trim()).length : 0;
    result.push({ id: start[1], figure: /\n {8}figure: '([^']+)'/.exec(body)?.[1], steps });
  });
  return result;
}

describe('user guide content', () => {
  test('every figure has a screenshot and indicator data', () => {
    assert.ok(figures.length > 0, 'no figures found — did the chapter format change?');
    for (const id of new Set(figures)) {
      assert.ok(existsSync(new URL(`${id}.webp`, IMAGES_DIR)), `public/guide/${id}.webp is missing`);
      assert.ok(shots[id], `shots.json has no entry for "${id}"`);
    }
  });

  test('no screenshot or indicator entry is left unused', () => {
    const used = new Set(figures);
    assert.deepEqual(images.filter((id) => !used.has(id)), [], 'unused files in public/guide');
    assert.deepEqual(Object.keys(shots).filter((id) => !used.has(id)), [], 'unused entries in shots.json');
  });

  test('indicators sit inside the picture', () => {
    for (const [id, shot] of Object.entries(shots)) {
      for (const mark of shot.marks) {
        const where = `${id} indicator ${mark.n}`;
        assert.ok(mark.w > 1 && mark.h > 1, `${where} has no size`);
        assert.ok(mark.x >= 0 && mark.y >= 0, `${where} starts outside the picture`);
        assert.ok(mark.x + mark.w <= 100.5 && mark.y + mark.h <= 100.5, `${where} runs off the picture`);
      }
    }
  });

  test('every indicator number has a step to explain it', () => {
    const all = sections();
    assert.ok(all.length > 50, 'section parser found too few sections — did the chapter format change?');
    for (const section of all) {
      if (!section.figure) continue;
      const highest = Math.max(0, ...(shots[section.figure]?.marks ?? []).map((mark) => mark.n));
      assert.ok(
        highest <= section.steps,
        `section "${section.id}": screenshot "${section.figure}" has indicator ${highest} but only ${section.steps} step(s)`
      );
    }
  });

  test('section ids are unique within the guide', () => {
    const ids = sections().map((section) => section.id);
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual(repeated, [], 'section ids double as in-page anchors and must not repeat');
  });
});
