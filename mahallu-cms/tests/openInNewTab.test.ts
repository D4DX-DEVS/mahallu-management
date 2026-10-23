import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isHttpUrl, openInNewTab } from '../src/utils/openInNewTab.ts';
import { CAUSE_OF_DEATH_CHOICES, canonicalCause, causeOfDeathOptions } from '../src/features/registrations/deathCause.ts';

interface FakeTab {
  opener: unknown;
  closed: boolean;
  navigatedTo: string | null;
  document: { title: string };
  location: { replace: (url: string) => void };
  close: () => void;
}

const makeTab = (): FakeTab => {
  const tab: FakeTab = {
    opener: 'the app window',
    closed: false,
    navigatedTo: null,
    document: { title: '' },
    location: { replace: (url) => void (tab.navigatedTo = url) },
    close: () => void (tab.closed = true),
  };
  return tab;
};

describe('openInNewTab', () => {
  let tab: FakeTab | null;
  const opened: string[][] = [];
  const events: string[] = [];

  beforeEach(() => {
    tab = makeTab();
    opened.length = 0;
    events.length = 0;
    (globalThis as unknown as { window: unknown }).window = {
      open: (...args: string[]) => {
        events.push('window.open');
        opened.push(args);
        return tab;
      },
    };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  test('opens the tab FIRST (inside the click), then fetches the link and sends the tab there', async () => {
    const result = await openInNewTab(async () => {
      events.push('fetch link');
      return 'https://files.example.com/cert.pdf?sig=1';
    });
    assert.equal(result, 'opened');
    assert.deepEqual(events, ['window.open', 'fetch link'], 'the tab is opened before anything is awaited');
    assert.deepEqual(opened[0], ['about:blank', '_blank']);
    assert.equal(tab!.navigatedTo, 'https://files.example.com/cert.pdf?sig=1');
    assert.equal(tab!.closed, false);
  });

  test('the new tab is detached from the application tab', async () => {
    await openInNewTab(async () => 'https://files.example.com/a.pdf');
    assert.equal(tab!.opener, null);
  });

  test('a blocked pop-up is reported without fetching anything', async () => {
    tab = null;
    let fetched = false;
    const result = await openInNewTab(async () => {
      fetched = true;
      return 'https://files.example.com/a.pdf';
    });
    assert.equal(result, 'blocked');
    assert.equal(fetched, false);
  });

  test('if the link cannot be fetched, the empty tab is closed and the error is passed on', async () => {
    await assert.rejects(
      openInNewTab(async () => {
        throw new Error('403');
      }),
      /403/
    );
    assert.equal(tab!.closed, true);
    assert.equal(tab!.navigatedTo, null);
  });

  test('a link that is not a web address is never followed', async () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>1</script>', '', 'not a url']) {
      tab = makeTab();
      await assert.rejects(openInNewTab(async () => bad));
      assert.equal(tab.closed, true, `closed for ${JSON.stringify(bad)}`);
      assert.equal(tab.navigatedTo, null);
    }
  });

  test('isHttpUrl accepts http(s) only', () => {
    assert.equal(isHttpUrl('https://a.example/x'), true);
    assert.equal(isHttpUrl('http://localhost:4000/x'), true);
    assert.equal(isHttpUrl('ftp://a.example/x'), false);
    assert.equal(isHttpUrl('javascript:1'), false);
    assert.equal(isHttpUrl(undefined), false);
  });
});

describe('Cause of Death choices', () => {
  test('the dropdown offers exactly Accident and Normal Death (plus the empty prompt)', () => {
    assert.deepEqual([...CAUSE_OF_DEATH_CHOICES], ['Accident', 'Normal Death']);
    assert.deepEqual(causeOfDeathOptions(''), [
      { value: '', label: 'Select cause of death...' },
      { value: 'Accident', label: 'Accident' },
      { value: 'Normal Death', label: 'Normal Death' },
    ]);
    assert.deepEqual(causeOfDeathOptions('Accident').map((o) => o.value), ['', 'Accident', 'Normal Death']);
  });

  test('an older record’s own wording is kept as an extra option, so opening and saving it loses nothing', () => {
    const options = causeOfDeathOptions('Heart attack');
    assert.deepEqual(options.map((o) => o.value), ['', 'Accident', 'Normal Death', 'Heart attack']);
    assert.equal(options[3].label, 'Heart attack');
  });

  test('old wording that differs only by case or spacing is read as the matching choice', () => {
    assert.equal(canonicalCause('accident'), 'Accident');
    assert.equal(canonicalCause('  NORMAL DEATH '), 'Normal Death');
    assert.equal(canonicalCause('Accidental fall'), 'Accidental fall', 'anything else is left exactly as it was');
    assert.equal(canonicalCause(undefined), '');
    assert.deepEqual(causeOfDeathOptions('accident').map((o) => o.value), ['', 'Accident', 'Normal Death']);
  });
});
