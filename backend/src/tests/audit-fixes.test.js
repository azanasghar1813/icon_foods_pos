import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z, ZodError } from 'zod';
import { zodFirstMessage, zodIssueList } from '../utils/zodErrors.js';
import { normalizeOrderType } from '../constants/orderStates.js';
import { CATEGORY_BUCKET_SQL } from '../utils/saleScope.js';

test('Zod 4 issues are read from error.issues not error.errors', () => {
  const schema = z.object({ pin: z.string().min(4) });
  let caught;
  try {
    schema.parse({ pin: '12' });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ZodError);
  assert.ok(Array.isArray(caught.issues));
  assert.equal(typeof zodFirstMessage(caught), 'string');
  assert.ok(zodIssueList(caught).length >= 1);
});

test('drive-through aliases normalize to DRIVE_THROUGH', () => {
  assert.equal(normalizeOrderType('DRIVE_THRU'), 'DRIVE_THROUGH');
  assert.equal(normalizeOrderType('Drive Through'), 'DRIVE_THROUGH');
  assert.equal(normalizeOrderType('dine in'), 'DINE_IN');
});

test('soda bar bucket matches special drinks catalog names', () => {
  assert.match(CATEGORY_BUCKET_SQL, /special drinks/);
  assert.match(CATEGORY_BUCKET_SQL, /soda bar/);
  assert.match(CATEGORY_BUCKET_SQL, /potato chips/);
  assert.match(CATEGORY_BUCKET_SQL, /shani fries/);
});
