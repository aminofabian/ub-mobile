import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAPSE_MARGIN_MS, nextRetryDelayMs } from '../src/lib/basket';
import { MAX_UNMOVED_ANSWERS, READ_AFTER_MS } from '../src/lib/basket-sync';
import { MAX_CART_LINES, MAX_GUEST_KEY_LENGTH } from '../src/lib/shop-api';
import { POKE_DELAY_MS } from '../src/lib/basket-scheduler';
import { DRAFT_MAX_AGE_MS, MAX_CONTACT_NAME_PART } from '../src/lib/checkout-form';
import { FACTS_MAX_AGE_MS, WAIT_FOR_SHOP_MS } from '../src/lib/checkout-facts';
import { MAX_ORDER_NOTES } from '../src/lib/checkout-notes';
import { IN_DOUBT_MIN_GAP_MS, MATCH_SLACK_MS } from '../src/lib/checkout-outcome';
import { MAX_ADDRESSES } from '../src/lib/saved-addresses';
import { DEFAULT_TIMEOUT_MS } from '../src/lib/shop-http';

// The numbers the order's safety and the shopper's patience rest on. The other tests read them from the code,
// so a change to one would pass them all; this one says what each is meant to be, so a change is a decision.
test('the numbers that checkout rests on are what the design says', () => {
  assert.equal(IN_DOUBT_MIN_GAP_MS, 20_000, 'an order is not sent again within 20 s of the last try');
  assert.equal(LAPSE_MARGIN_MS, 60_000, 'a cart within a minute of its end is not ordered from');
  assert.equal(MATCH_SLACK_MS, 5 * 60_000, 'a placed order is recognised within five minutes of the phone\'s clock');
  assert.equal(POKE_DELAY_MS, 350, 'a burst of taps is one send');
  assert.equal(READ_AFTER_MS, 2 * 60_000, 'the shop is asked for its prices again when a screen opens and its last word is two minutes old');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(nextRetryDelayMs), [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
  assert.equal(nextRetryDelayMs(0), 0);
  assert.equal(MAX_ADDRESSES, 5);
  assert.equal(DRAFT_MAX_AGE_MS, 24 * 60 * 60 * 1000, 'a half-filled form is kept for a day');
  assert.equal(FACTS_MAX_AGE_MS, 14 * 24 * 60 * 60 * 1000, 'what the shop said is trusted for a fortnight');
  assert.equal(MAX_ORDER_NOTES, 2000, 'the server takes 2000 characters of notes');
  assert.equal(MAX_CONTACT_NAME_PART, 120, 'the contact step takes 120 of the first name and 120 of the rest');
  assert.equal(WAIT_FOR_SHOP_MS, 8_000, 'the form waits eight seconds for the shop when it has nothing to go on');
  assert.equal(DEFAULT_TIMEOUT_MS, 20_000);
  assert.equal(MAX_UNMOVED_ANSWERS, 3, 'a line the shop answers three times and still has not taken is not asked again at once');
  assert.equal(MAX_CART_LINES, 200, 'a cart of more lines than that is not a cart');
  assert.equal(MAX_GUEST_KEY_LENGTH, 200, 'a guest key of more characters than that is not kept');
});
