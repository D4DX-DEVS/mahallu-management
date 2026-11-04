import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  applicantFill,
  dateInputValue,
  deceasedFill,
  familyAddressText,
  familyIdOf,
  graveFill,
  inheritanceFill,
  khateebFill,
  nikahPartyFill,
  phoneDigits,
  planAutofill,
  type Fill,
} from '../src/utils/memberAutofill.ts';

// The helpers only read plain fields, so a partial record is enough for each case.
const member = (over: Record<string, unknown> = {}) =>
  ({ id: 'm1', name: 'Abdul Rahman', nameMl: 'അബ്ദുൽ റഹ്മാൻ', familyId: 'f1', familyName: 'Puthiya House', mahallId: 'FID12-3', phone: '9876543210', age: 34, ...over }) as never;
const family = (over: Record<string, unknown> = {}) =>
  ({ id: 'f1', houseName: 'Puthiya House', houseNo: '12/45', area: 'North Ward', place: 'Perinthalmanna', postOffice: 'Perinthalmanna', pinCode: '679322', district: 'Malappuram', state: 'Kerala', ...over }) as never;

describe('small helpers', () => {
  test('familyIdOf reads a plain id or a populated family, and is empty for neither', () => {
    assert.equal(familyIdOf({ familyId: 'abc' }), 'abc');
    assert.equal(familyIdOf({ familyId: { id: 'x1', houseName: 'H' } }), 'x1');
    assert.equal(familyIdOf({ familyId: { _id: 'x2' } }), 'x2');
    assert.equal(familyIdOf({}), '');
    assert.equal(familyIdOf(null), '');
  });

  test('phoneDigits keeps digits only and the last ten when a country code is present', () => {
    assert.equal(phoneDigits('98765 43210'), '9876543210');
    assert.equal(phoneDigits('+91 98765-43210'), '9876543210');
    assert.equal(phoneDigits(undefined), '');
  });

  test('dateInputValue gives YYYY-MM-DD and nothing for a missing or bad date', () => {
    assert.equal(dateInputValue('2026-03-04T10:00:00.000Z'), '2026-03-04');
    assert.equal(dateInputValue(''), '');
    assert.equal(dateInputValue('not a date'), '');
  });
});

describe('familyAddressText', () => {
  test('builds a multi-line address from the family record and skips empty parts', () => {
    assert.equal(
      familyAddressText(family()),
      ['Puthiya House, House No. 12/45', 'North Ward, Perinthalmanna', 'Perinthalmanna - PIN 679322', 'Malappuram, Kerala'].join('\n')
    );
    assert.equal(familyAddressText(family({ houseNo: '', area: '', pinCode: '', postOffice: '' })), ['Puthiya House', 'Perinthalmanna', 'Malappuram, Kerala'].join('\n'));
  });

  test('a repeated part is shown once, and no family gives an empty address (nothing is invented)', () => {
    assert.equal(familyAddressText(family({ area: 'Perinthalmanna', place: 'perinthalmanna', via: '' })).split('\n')[1], 'Perinthalmanna');
    assert.equal(familyAddressText(null), '');
    assert.equal(familyAddressText({} as never), '');
  });

  test('is capped at the 500 characters the address fields accept', () => {
    assert.equal(familyAddressText(family({ houseName: 'x'.repeat(900) })).length, 500);
  });
});

describe('what each form takes from a member', () => {
  test('death registration: name, Malayalam name, family and member id', () => {
    assert.deepEqual(deceasedFill(member()), { deceasedName: 'Abdul Rahman', deceasedNameMl: 'അബ്ദുൽ റഹ്മാൻ', familyId: 'f1', mahallId: 'FID12-3' });
    assert.equal(deceasedFill(member({ familyId: { id: 'f9', houseName: 'H' } })).familyId, 'f9');
  });

  test('NOC applicant: name, Malayalam name and phone (digits only)', () => {
    assert.deepEqual(applicantFill(member({ phone: '+91 98765 43210' })), { applicantName: 'Abdul Rahman', applicantNameMl: 'അബ്ദുൽ റഹ്മാൻ', applicantPhone: '9876543210' });
  });

  test('nikah: the groom side or the bride side, with age, member id and the family address', () => {
    const groom = nikahPartyFill('groom', member(), family());
    assert.equal(groom.groomName, 'Abdul Rahman');
    assert.equal(groom.groomNameMl, 'അബ്ദുൽ റഹ്മാൻ');
    assert.equal(groom.groomAge, 34);
    assert.equal(groom.mahallId, 'FID12-3');
    assert.match(String(groom.groomAddress), /^Puthiya House, House No\. 12\/45\n/);
    assert.ok(!('brideName' in groom));
    const bride = nikahPartyFill('bride', member(), null);
    assert.equal(bride.brideName, 'Abdul Rahman');
    assert.equal(bride.brideAddress, '', 'no family record -> no address');
  });

  test('nikah: no age on the record means no age is filled', () => {
    assert.equal(nikahPartyFill('groom', member({ age: undefined }), null).groomAge, undefined);
    assert.equal(nikahPartyFill('groom', member({ age: 0 }), null).groomAge, undefined);
  });

  test('grave: the date of death is filled only for a member already marked deceased', () => {
    assert.deepEqual(graveFill(member({ isDead: true, dateOfDeath: '2026-02-01T00:00:00.000Z' })), { deceasedName: 'Abdul Rahman', familyId: 'f1', dateOfDeath: '2026-02-01' });
    assert.equal(graveFill(member()).dateOfDeath, '');
  });

  test('inheritance and khateeb', () => {
    assert.deepEqual(inheritanceFill(member()), { deceasedName: 'Abdul Rahman' });
    assert.deepEqual(khateebFill(member()), { name: 'Abdul Rahman', nameMl: 'അബ്ദുൽ റഹ്മാൻ', contactNo: '9876543210' });
  });

  test('a member with missing data supplies empty values, never made-up ones', () => {
    const bare = member({ nameMl: undefined, phone: undefined, mahallId: undefined, age: undefined });
    assert.deepEqual(applicantFill(bare), { applicantName: 'Abdul Rahman', applicantNameMl: '', applicantPhone: '' });
    assert.equal(deceasedFill(bare).mahallId, '');
  });
});

describe('planAutofill: replace on change, no stale details, no overwriting typed values', () => {
  const read = (values: Record<string, unknown>) => (field: string) => values[field];

  test('the first selection sets every field the member has', () => {
    const plan = planAutofill({}, { applicantName: 'A', applicantPhone: '111' }, read({}));
    assert.deepEqual(plan.updates, [['applicantName', 'A'], ['applicantPhone', '111']]);
    assert.deepEqual(plan.remembered, { applicantName: 'A', applicantPhone: '111' });
  });

  test('selecting another member replaces the earlier details', () => {
    const first = planAutofill({}, { applicantName: 'A', applicantPhone: '111' }, read({}));
    const second = planAutofill(first.remembered, { applicantName: 'B', applicantPhone: '222' }, read({ applicantName: 'A', applicantPhone: '111' }));
    assert.deepEqual(second.updates, [['applicantName', 'B'], ['applicantPhone', '222']]);
  });

  test('a field the new member has nothing for is cleared if it still holds the old member’s value', () => {
    const first = planAutofill({}, { applicantName: 'A', applicantPhone: '111' }, read({}));
    const second = planAutofill(first.remembered, { applicantName: 'B', applicantPhone: '' }, read({ applicantName: 'A', applicantPhone: '111' }));
    assert.deepEqual(second.updates, [['applicantName', 'B'], ['applicantPhone', '']]);
    assert.deepEqual(second.remembered, { applicantName: 'B' });
  });

  test('...but is left alone when the person typed something else there', () => {
    const first = planAutofill({}, { applicantName: 'A', applicantPhone: '111' }, read({}));
    const second = planAutofill(first.remembered, { applicantName: 'B', applicantPhone: '' }, read({ applicantName: 'A', applicantPhone: '999 typed by hand' }));
    assert.deepEqual(second.updates, [['applicantName', 'B']]);
  });

  test('clearing the selection removes what the member put there (and only that)', () => {
    const first = planAutofill({}, { groomName: 'A', groomAge: 30, groomAddress: 'Somewhere' }, read({}));
    const cleared = planAutofill(first.remembered, {}, read({ groomName: 'A', groomAge: 30, groomAddress: 'Edited address' }));
    assert.deepEqual(cleared.updates, [['groomName', ''], ['groomAge', '']]);
    assert.deepEqual(cleared.remembered, {});
  });

  test('a field the member has no data for, and that was never filled, is not touched', () => {
    const plan = planAutofill({}, { applicantName: 'A', applicantPhone: '' }, read({ applicantPhone: 'typed' }));
    assert.deepEqual(plan.updates, [['applicantName', 'A']]);
  });

  test('numbers and their text form are treated as the same value', () => {
    const first: Fill = { groomAge: 34 };
    const plan = planAutofill(first, {}, read({ groomAge: '34' }));
    assert.deepEqual(plan.updates, [['groomAge', '']]);
  });
});
