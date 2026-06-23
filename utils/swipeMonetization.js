/**
 * Pure logic helpers for swipe monetization orchestration.
 * No React or RN imports — fully unit-testable in isolation.
 */

/**
 * Generate a UUID v4 using Math.random.
 * Suitable as an idempotency key; does not rely on native crypto.
 */
export function generateRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Interpret the POST action response from the backend and return a
 * structured object describing what the UI should do next.
 *
 * Rules:
 *  - paywall_required=true AND swipe_allowed=false → block card advance, open paywall
 *  - ad_due_now=true                               → show interstitial before advancing
 *  - mutual_match=true                             → fire mutual-match analytics/UI
 *
 * @param {object|null} result - Raw JSON from postMatchAction
 * @returns {{
 *   isPaywallRequired: boolean,
 *   isAdDueNow: boolean,
 *   isMutualMatch: boolean,
 *   swipesUsed: number|null,
 *   swipesRemaining: number|null,
 * }}
 */
export function processActionResponse(result) {
  return {
    // Backend caveat: free users hit a 10-swipe daily cap.
    // Only block when BOTH flags are set; swipe_allowed alone being false
    // (without paywall_required) is treated as a soft refusal, not a hard wall.
    isPaywallRequired: result?.swipe_allowed === false && result?.paywall_required === true,
    isAdDueNow: result?.ad_due_now === true,
    isMutualMatch: result?.mutual_match === true,
    swipesUsed: result?.swipes_used ?? null,
    swipesRemaining: result?.swipes_remaining ?? null,
  };
}

/**
 * Determine whether the local fallback interstitial should fire.
 *
 * This is only active while the user is in "resumed after Maybe Later" state,
 * as a secondary guard for when the backend's ad_due_now is not returned.
 *
 * @param {number} actionCountSinceResume - Incremented on each successful swipe after resume
 * @param {number} [threshold=4]          - Fire every N actions (default 4)
 * @returns {boolean}
 */
export function shouldShowFallbackAd(actionCountSinceResume, threshold = 4) {
  if (actionCountSinceResume <= 0 || threshold <= 0) {
    return false;
  }
  return actionCountSinceResume % threshold === 0;
}

/**
 * Emit an analytics event.
 * Replace the console.log body with your analytics SDK (e.g. Firebase Analytics).
 *
 * @param {string} event
 * @param {object} [params]
 */
export function logAnalyticsEvent(event, params = {}) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[Analytics]', event, params);
  }
  // TODO: wire to analytics SDK, e.g.:
  // analytics().logEvent(event, params);
}
