/**
 * Unit tests for swipeMonetization pure helpers.
 *
 * Run with: npx jest __tests__/swipeMonetization.test.js
 */

import {
  generateRequestId,
  processActionResponse,
  shouldShowFallbackAd,
} from '../utils/swipeMonetization';

// ---------------------------------------------------------------------------
// processActionResponse
// ---------------------------------------------------------------------------
describe('processActionResponse', () => {
  test('paywall: swipe_allowed=false AND paywall_required=true → isPaywallRequired=true', () => {
    const result = processActionResponse({ swipe_allowed: false, paywall_required: true });
    expect(result.isPaywallRequired).toBe(true);
    expect(result.isAdDueNow).toBe(false);
    expect(result.isMutualMatch).toBe(false);
  });

  test('no paywall when swipe_allowed=true even if paywall_required=true', () => {
    // Only the combination of BOTH flags should trigger the wall
    const result = processActionResponse({ swipe_allowed: true, paywall_required: true });
    expect(result.isPaywallRequired).toBe(false);
  });

  test('no paywall when only swipe_allowed=false (paywall_required omitted)', () => {
    const result = processActionResponse({ swipe_allowed: false });
    expect(result.isPaywallRequired).toBe(false);
  });

  test('ad: ad_due_now=true → isAdDueNow=true, isPaywallRequired=false', () => {
    const result = processActionResponse({ swipe_allowed: true, ad_due_now: true });
    expect(result.isAdDueNow).toBe(true);
    expect(result.isPaywallRequired).toBe(false);
  });

  test('mutual match: mutual_match=true → isMutualMatch=true', () => {
    const result = processActionResponse({ mutual_match: true });
    expect(result.isMutualMatch).toBe(true);
  });

  test('paywall takes precedence — ad_due_now and paywall_required both true', () => {
    // Backend should not send this combo, but frontend must handle gracefully.
    // Paywall check happens first in swipeAction, so ad_due_now is irrelevant here
    // but processActionResponse should still parse both correctly.
    const result = processActionResponse({
      swipe_allowed: false,
      paywall_required: true,
      ad_due_now: true,
    });
    expect(result.isPaywallRequired).toBe(true);
    expect(result.isAdDueNow).toBe(true); // both flags present; swipeAction logic handles priority
  });

  test('swipes_used and swipes_remaining extracted', () => {
    const result = processActionResponse({ swipes_used: 7, swipes_remaining: 3 });
    expect(result.swipesUsed).toBe(7);
    expect(result.swipesRemaining).toBe(3);
  });

  test('swipes null when fields are absent', () => {
    const result = processActionResponse({ mutual_match: false });
    expect(result.swipesUsed).toBe(null);
    expect(result.swipesRemaining).toBe(null);
  });

  test('handles null result without throwing', () => {
    const result = processActionResponse(null);
    expect(result.isPaywallRequired).toBe(false);
    expect(result.isAdDueNow).toBe(false);
    expect(result.isMutualMatch).toBe(false);
    expect(result.swipesUsed).toBe(null);
    expect(result.swipesRemaining).toBe(null);
  });

  test('handles undefined result without throwing', () => {
    const result = processActionResponse(undefined);
    expect(result.isPaywallRequired).toBe(false);
  });

  test('handles empty object result', () => {
    const result = processActionResponse({});
    expect(result.isPaywallRequired).toBe(false);
    expect(result.isAdDueNow).toBe(false);
    expect(result.isMutualMatch).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldShowFallbackAd
// ---------------------------------------------------------------------------
describe('shouldShowFallbackAd', () => {
  test('fires exactly at threshold=4', () => {
    expect(shouldShowFallbackAd(4)).toBe(true);
  });

  test('fires at multiples of 4 (8, 12)', () => {
    expect(shouldShowFallbackAd(8)).toBe(true);
    expect(shouldShowFallbackAd(12)).toBe(true);
  });

  test('does not fire at 0', () => {
    expect(shouldShowFallbackAd(0)).toBe(false);
  });

  test('does not fire before first threshold (1, 2, 3)', () => {
    expect(shouldShowFallbackAd(1)).toBe(false);
    expect(shouldShowFallbackAd(2)).toBe(false);
    expect(shouldShowFallbackAd(3)).toBe(false);
  });

  test('does not fire between thresholds (5, 6, 7)', () => {
    expect(shouldShowFallbackAd(5)).toBe(false);
    expect(shouldShowFallbackAd(6)).toBe(false);
    expect(shouldShowFallbackAd(7)).toBe(false);
  });

  test('respects custom threshold=2', () => {
    expect(shouldShowFallbackAd(2, 2)).toBe(true);
    expect(shouldShowFallbackAd(4, 2)).toBe(true);
    expect(shouldShowFallbackAd(1, 2)).toBe(false);
    expect(shouldShowFallbackAd(3, 2)).toBe(false);
  });

  test('respects custom threshold=5', () => {
    expect(shouldShowFallbackAd(5, 5)).toBe(true);
    expect(shouldShowFallbackAd(3, 5)).toBe(false);
  });

  test('threshold=0 never fires (guard against division by zero)', () => {
    expect(shouldShowFallbackAd(4, 0)).toBe(false);
  });

  test('negative count never fires', () => {
    expect(shouldShowFallbackAd(-1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateRequestId
// ---------------------------------------------------------------------------
describe('generateRequestId', () => {
  const UUID_V4_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  test('produces a valid UUID v4 format string', () => {
    expect(generateRequestId()).toMatch(UUID_V4_PATTERN);
  });

  test('all characters are lowercase hex', () => {
    const id = generateRequestId();
    expect(id).toBe(id.toLowerCase());
  });

  test('generates unique values across 200 calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateRequestId()));
    expect(ids.size).toBe(200);
  });

  test('version nibble is always 4', () => {
    for (let i = 0; i < 20; i++) {
      const id = generateRequestId();
      // 15th character (index 14) must be '4' — see UUID v4 spec
      expect(id[14]).toBe('4');
    }
  });

  test('variant nibble is always 8, 9, a, or b', () => {
    for (let i = 0; i < 20; i++) {
      const id = generateRequestId();
      // 20th character (index 19) must be in [89ab]
      expect(['8', '9', 'a', 'b']).toContain(id[19]);
    }
  });
});
