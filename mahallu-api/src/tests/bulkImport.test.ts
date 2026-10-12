/**
 * Bulk import validation tests: row-level validation for families and members.
 *
 * Runs on the Node built-in test runner with pure logic — no database, no HTTP.
 * Tests the validation behavior of CSV row parsers before insertMany.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Family bulk import validation: extract and validate a single row.
 * Returns validation error (if any) + the transformed document (if valid).
 */
function validateFamilyRow(
  row: any,
  rowNumber: number,
  nextMahallId: string
): { error?: { row: number; message: string }; doc?: any } {
  if (!row.houseName || typeof row.houseName !== 'string' || !row.houseName.trim()) {
    return { error: { row: rowNumber, message: 'houseName is required' } };
  }

  const doc = {
    houseName: row.houseName.trim(),
    houseNameMl: row.houseNameMl || row.house_name_ml || undefined,
    familyHead: row.familyHead || row.family_head || undefined,
    familyHeadMl: row.familyHeadMl || row.family_head_ml || undefined,
    contactNo: row.contactNo || row.contact_no || undefined,
    area: row.area || undefined,
    areaMl: row.areaMl || row.area_ml || undefined,
    place: row.place || undefined,
    placeMl: row.placeMl || row.place_ml || undefined,
    varisangyaGrade: row.varisangyaGrade || row.varisangyaGrade_grade || undefined,
    status: 'approved',
    mahallId: nextMahallId,
  };

  return { doc };
}

/**
 * Member bulk import validation: extract and validate a single row.
 * Returns validation error (if any) + the transformed document (if valid).
 */
function validateMemberRow(
  row: any,
  rowNumber: number,
  familyHouseName: string,
  nextMahallId: string
): { error?: { row: number; message: string }; doc?: any } {
  if (!row.name || typeof row.name !== 'string' || !row.name.trim()) {
    return { error: { row: rowNumber, message: 'name is required' } };
  }

  const doc = {
    name: row.name.trim(),
    nameMl: row.nameMl || row.name_ml || undefined,
    familyName: familyHouseName,
    gender: ['male', 'female'].includes(row.gender) ? row.gender : undefined,
    age: row.age && Number(row.age) > 0 ? Number(row.age) : undefined,
    maritalStatus: ['single', 'married', 'divorced', 'widowed'].includes(row.maritalStatus)
      ? row.maritalStatus
      : undefined,
    education: row.education || undefined,
    occupation: row.occupation || undefined,
    status: 'active',
    mahallId: nextMahallId,
  };

  return { doc };
}

test('Family bulk import: validates houseName is required', () => {
  const result = validateFamilyRow({}, 1, 'FID1');
  assert.ok(result.error);
  assert.equal(result.error.message, 'houseName is required');
  assert.equal(result.error.row, 1);
});

test('Family bulk import: accepts valid row with required fields', () => {
  const result = validateFamilyRow({ houseName: 'Al-Hamd House' }, 1, 'FID1');
  assert.ok(!result.error);
  assert.equal(result.doc.houseName, 'Al-Hamd House');
  assert.equal(result.doc.status, 'approved');
  assert.equal(result.doc.mahallId, 'FID1');
});

test('Family bulk import: trims houseName', () => {
  const result = validateFamilyRow({ houseName: '  My House  ' }, 1, 'FID1');
  assert.ok(!result.error);
  assert.equal(result.doc.houseName, 'My House');
});

test('Family bulk import: rejects empty houseName', () => {
  const result = validateFamilyRow({ houseName: '   ' }, 1, 'FID1');
  assert.ok(result.error);
  assert.equal(result.error.message, 'houseName is required');
});

test('Family bulk import: maps Malayalam name fields (both column variants)', () => {
  const result1 = validateFamilyRow(
    { houseName: 'House', houseNameMl: 'വീട്' },
    1,
    'FID1'
  );
  assert.ok(!result1.error);
  assert.equal(result1.doc.houseNameMl, 'വീട്');

  const result2 = validateFamilyRow(
    { houseName: 'House', house_name_ml: 'വീട്' },
    1,
    'FID1'
  );
  assert.ok(!result2.error);
  assert.equal(result2.doc.houseNameMl, 'വീട്');
});

test('Family bulk import: maps optional fields', () => {
  const result = validateFamilyRow(
    {
      houseName: 'Al-Hamd',
      familyHead: 'Ahmed',
      contactNo: '9876543210',
      area: 'Area A',
      place: 'Calicut',
      varisangyaGrade: 'Grade A',
    },
    1,
    'FID1'
  );
  assert.ok(!result.error);
  assert.equal(result.doc.familyHead, 'Ahmed');
  assert.equal(result.doc.contactNo, '9876543210');
  assert.equal(result.doc.area, 'Area A');
  assert.equal(result.doc.place, 'Calicut');
  assert.equal(result.doc.varisangyaGrade, 'Grade A');
});

test('Member bulk import: validates name is required', () => {
  const result = validateMemberRow({}, 1, 'Al-Hamd House', 'FID1-1');
  assert.ok(result.error);
  assert.equal(result.error.message, 'name is required');
  assert.equal(result.error.row, 1);
});

test('Member bulk import: accepts valid row with required fields', () => {
  const result = validateMemberRow({ name: 'Ahmed Ali' }, 1, 'Al-Hamd House', 'FID1-1');
  assert.ok(!result.error);
  assert.equal(result.doc.name, 'Ahmed Ali');
  assert.equal(result.doc.familyName, 'Al-Hamd House');
  assert.equal(result.doc.status, 'active');
  assert.equal(result.doc.mahallId, 'FID1-1');
});

test('Member bulk import: trims name', () => {
  const result = validateMemberRow({ name: '  Ahmed  ' }, 1, 'Al-Hamd House', 'FID1-1');
  assert.ok(!result.error);
  assert.equal(result.doc.name, 'Ahmed');
});

test('Member bulk import: rejects empty name', () => {
  const result = validateMemberRow({ name: '   ' }, 1, 'Al-Hamd House', 'FID1-1');
  assert.ok(result.error);
  assert.equal(result.error.message, 'name is required');
});

test('Member bulk import: validates gender enum', () => {
  const validMale = validateMemberRow(
    { name: 'Ahmed', gender: 'male' },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!validMale.error);
  assert.equal(validMale.doc.gender, 'male');

  const validFemale = validateMemberRow(
    { name: 'Fatima', gender: 'female' },
    2,
    'Al-Hamd House',
    'FID1-2'
  );
  assert.ok(!validFemale.error);
  assert.equal(validFemale.doc.gender, 'female');

  const invalidGender = validateMemberRow(
    { name: 'Ali', gender: 'other' },
    3,
    'Al-Hamd House',
    'FID1-3'
  );
  assert.ok(!invalidGender.error);
  assert.equal(invalidGender.doc.gender, undefined);
});

test('Member bulk import: parses age as number', () => {
  const result = validateMemberRow(
    { name: 'Ahmed', age: '25' },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!result.error);
  assert.equal(result.doc.age, 25);
  assert.equal(typeof result.doc.age, 'number');
});

test('Member bulk import: rejects invalid age', () => {
  const resultZero = validateMemberRow(
    { name: 'Ahmed', age: 0 },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!resultZero.error);
  assert.equal(resultZero.doc.age, undefined);

  const resultNegative = validateMemberRow(
    { name: 'Ahmed', age: -5 },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!resultNegative.error);
  assert.equal(resultNegative.doc.age, undefined);
});

test('Member bulk import: validates maritalStatus enum', () => {
  const valid = validateMemberRow(
    { name: 'Ahmed', maritalStatus: 'married' },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!valid.error);
  assert.equal(valid.doc.maritalStatus, 'married');

  const invalid = validateMemberRow(
    { name: 'Ahmed', maritalStatus: 'engaged' },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!invalid.error);
  assert.equal(invalid.doc.maritalStatus, undefined);
});

test('Member bulk import: maps optional fields', () => {
  const result = validateMemberRow(
    {
      name: 'Ahmed',
      nameMl: 'അഹമ്മദ്',
      gender: 'male',
      age: 30,
      education: 'Bachelor',
      occupation: 'Engineer',
    },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!result.error);
  assert.equal(result.doc.nameMl, 'അഹമ്മദ്');
  assert.equal(result.doc.gender, 'male');
  assert.equal(result.doc.age, 30);
  assert.equal(result.doc.education, 'Bachelor');
  assert.equal(result.doc.occupation, 'Engineer');
});

test('Member bulk import: maps both name_ml and nameMl column variants', () => {
  const result1 = validateMemberRow(
    { name: 'Ahmed', nameMl: 'അഹമ്മദ്' },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!result1.error);
  assert.equal(result1.doc.nameMl, 'അഹമ്മദ്');

  const result2 = validateMemberRow(
    { name: 'Ahmed', name_ml: 'അഹമ്മദ്' },
    1,
    'Al-Hamd House',
    'FID1-1'
  );
  assert.ok(!result2.error);
  assert.equal(result2.doc.nameMl, 'അഹമ്മദ്');
});
