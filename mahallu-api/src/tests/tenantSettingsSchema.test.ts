import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import Tenant from '../models/Tenant';

/**
 * The CMS Settings page edits settings.varisangyaGrades and settings.areaOptions, and the family
 * forms read them back. With the paths missing from the schema, mongoose's strict mode dropped them
 * on every save, so nothing the admin added was ever stored or listed.
 */
describe('tenant settings schema', () => {
  test('grades and areas are schema paths, so they are saved rather than stripped', () => {
    const tenant = new Tenant({
      name: 'T',
      code: 'T1',
      address: { state: 's', district: 'd', lsgName: 'l', village: 'v' },
      settings: {
        varisangyaGrades: [{ name: 'Gold', amount: 500 }],
        areaOptions: ['North Ward'],
      },
    });
    const settings: any = tenant.toObject().settings;
    assert.deepEqual(settings.varisangyaGrades.map((g: any) => [g.name, g.amount]), [['Gold', 500]]);
    assert.deepEqual(settings.areaOptions, ['North Ward']);
  });

  test('an existing tenant stored without them still reads back the default grades and areas', () => {
    const tenant = Tenant.hydrate({ _id: new Tenant()._id, name: 'Old', settings: { varisangyaAmount: 100 } });
    const settings: any = tenant.toObject().settings;
    assert.deepEqual(settings.varisangyaGrades.map((g: any) => g.name), ['Grade A', 'Grade B', 'Grade C', 'Grade D']);
    assert.deepEqual(settings.areaOptions, ['Area A', 'Area B', 'Area C', 'Area D']);
  });
});
