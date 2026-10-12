/**
 * B11 tests. Issue/return flows need a live DB, so what is pinned here is the
 * schema contract the CMS and controller rely on: enums rendered as dropdowns,
 * required refs, defaults for the copy-counting flow, and the indexes behind
 * the hot list queries.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import {
  LibraryBook,
  BookIssue,
  BOOK_CATEGORIES,
  RESOURCE_TYPES,
  BOOK_ISSUE_STATUSES,
} from '../models/Library';

test('book categories match the set the CMS offers', () => {
  assert.deepEqual(
    [...BOOK_CATEGORIES],
    ['quran', 'hadith', 'fiqh', 'history', 'children', 'women', 'youth', 'general']
  );
});

test('resource types are physical and digital, defaulting to physical', () => {
  assert.deepEqual([...RESOURCE_TYPES], ['physical', 'digital']);
  const resourceType = LibraryBook.schema.paths.resourceType as any;
  assert.equal(resourceType.defaultValue, 'physical');
});

test('issue statuses match the set the CMS offers', () => {
  assert.deepEqual([...BOOK_ISSUE_STATUSES], ['issued', 'returned', 'overdue']);
});

test('a book carries tenantId and the fields the list view reads', () => {
  const paths = LibraryBook.schema.paths;
  ['tenantId', 'title', 'author', 'category', 'resourceType', 'copies', 'availableCopies', 'status'].forEach(
    (field) => {
      assert.ok(paths[field], `LibraryBook is missing ${field}`);
    }
  );
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.title.isRequired, true);
  assert.equal(paths.author.isRequired, true);
});

test('copies and availableCopies both default to 1 so new books are issuable', () => {
  const paths = LibraryBook.schema.paths as any;
  assert.equal(paths.copies.defaultValue, 1);
  assert.equal(paths.availableCopies.defaultValue, 1);
});

test('an issue requires a tenant, a book and a member', () => {
  const paths = BookIssue.schema.paths;
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.bookId.isRequired, true);
  assert.equal(paths.memberId.isRequired, true);
});

test('books index the tenant list queries', () => {
  const indexes = LibraryBook.schema.indexes();
  const hasIndex = (fields: Record<string, number>) =>
    indexes.some(
      ([spec]: any[]) => Object.keys(fields).every((key) => spec[key] === fields[key])
    );
  assert.ok(hasIndex({ tenantId: 1, status: 1 }), 'missing (tenantId, status) index');
  assert.ok(hasIndex({ tenantId: 1, category: 1 }), 'missing (tenantId, category) index');
});

test('both collections timestamp their documents', () => {
  assert.ok(LibraryBook.schema.paths.createdAt, 'LibraryBook has no timestamps');
  assert.ok(BookIssue.schema.paths.createdAt, 'BookIssue has no timestamps');
});

test('a digital book without a resourceUrl fails schema validation', async () => {
  const book = new LibraryBook({
    tenantId: new mongoose.Types.ObjectId(),
    title: 'Digital tafsir',
    author: 'Unknown',
    category: 'quran',
    resourceType: 'digital',
  });
  await assert.rejects(() => book.validate(), /resourceUrl/);
});

test('a physical book needs no resourceUrl', async () => {
  const book = new LibraryBook({
    tenantId: new mongoose.Types.ObjectId(),
    title: 'Printed tafsir',
    author: 'Unknown',
    category: 'quran',
  });
  await book.validate();
  assert.equal(book.resourceType, 'physical');
});
