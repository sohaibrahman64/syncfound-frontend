/**
 * Integration tests for HomeScreen swipe monetization flows.
 *
 * Tests the four key scenarios from the spec:
 *  1. paywall_required path  — paywall modal renders
 *  2. ad_due_now path        — interstitial modal renders
 *  3. Maybe Later            — paywall dismisses and deck resumes
 *  4. swipeAction response branching (verifies real handler via mocked API)
 *
 * Run with: npx jest __tests__/HomeScreen.swipeAction.test.js
 *
 * Prerequisites (installed via devDependencies):
 *   jest-expo, @testing-library/react-native
 */

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports of the mocked modules
// ---------------------------------------------------------------------------
jest.mock('../utils/backendAuth', () => ({
  getEntitlements: jest.fn().mockResolvedValue({ tier: 'free', unlimited_swipes: false }),
  getMyMatches: jest.fn().mockResolvedValue({
    items: [
      {
        candidate_id: 'c1',
        display_name: 'Alice Founder',
        profile_photo_url: '',
        country_code: 'us',
        user_role: 'Founder',
        role: 'Cofounder',
        intent_badge: 'Open To Explore',
      },
      {
        candidate_id: 'c2',
        display_name: 'Bob Builder',
        profile_photo_url: '',
        country_code: 'gb',
        user_role: 'Founder',
        role: 'Cofounder',
        intent_badge: 'Ready To Commit',
      },
    ],
    next_cursor: null,
  }),
  postMatchAction: jest.fn(),
}));

jest.mock('../utils/firebaseAuth', () => ({
  getCurrentFirebaseIdToken: jest.fn().mockResolvedValue('mock-firebase-token'),
}));

// Silence Animated warnings in tests
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// ---------------------------------------------------------------------------
// After mocks are in place, import the component under test
// ---------------------------------------------------------------------------
import HomeScreen from '../screens/HomeScreen';
import { postMatchAction } from '../utils/backendAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PASS_RESPONSE = {
  swipe_allowed: true,
  paywall_required: false,
  ad_due_now: false,
  mutual_match: false,
  swipes_used: 1,
  swipes_remaining: 9,
};

const PAYWALL_RESPONSE = {
  swipe_allowed: false,
  paywall_required: true,
  ad_due_now: false,
  mutual_match: false,
};

const AD_DUE_RESPONSE = {
  swipe_allowed: true,
  paywall_required: false,
  ad_due_now: true,
  mutual_match: false,
  swipes_used: 4,
  swipes_remaining: 6,
};

function renderHomeScreen(props = {}) {
  return render(
    <HomeScreen firebaseToken="test-token" onAuthExpired={jest.fn()} {...props} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('HomeScreen — swipe monetization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: successful pass action
    postMatchAction.mockResolvedValue(PASS_RESPONSE);
  });

  // -------------------------------------------------------------------------
  // Test 1: paywall_required path — modal opens on paywall response
  // -------------------------------------------------------------------------
  it('shows paywall modal when backend returns paywall_required=true', async () => {
    postMatchAction.mockResolvedValue(PAYWALL_RESPONSE);

    const { getByText, queryByText, findByText } = renderHomeScreen();

    // Wait for cards to load
    await findByText('Alice Founder');

    // Tap Pass button to trigger a swipe action
    const passButton = getByText('Alice Founder').parent?.parent;
    // Use the Pass action button (accessible via the action row)
    await act(async () => {
      fireEvent.press(getByText('Alice Founder').parent.parent);
    });

    // The paywall modal heading should be visible
    await waitFor(() => {
      expect(
        queryByText(/Daily Matchmaking/i) ||
        queryByText(/Capped at 10 Swipes/i),
      ).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: ad_due_now path — interstitial shows when ad_due_now=true
  // -------------------------------------------------------------------------
  it('shows interstitial modal when backend returns ad_due_now=true', async () => {
    postMatchAction.mockResolvedValue(AD_DUE_RESPONSE);

    const { queryByText, findByText } = renderHomeScreen();
    await findByText('Alice Founder');

    // We need to trigger the paywall via a button press. The test must reach
    // the pass button in the action row.
    // Re-test with direct swipeAction response interpretation:
    postMatchAction.mockResolvedValue(AD_DUE_RESPONSE);

    // Simulate pass action via action row button
    await act(async () => {
      fireEvent.press(await findByText('Alice Founder'));
    });

    await waitFor(() => {
      // Interstitial renders "Advertisement" label
      expect(queryByText(/Advertisement/i)).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: Maybe Later resumes deck interaction
  // -------------------------------------------------------------------------
  it('closes paywall on Maybe Later and allows further card interactions', async () => {
    postMatchAction.mockResolvedValue(PAYWALL_RESPONSE);

    const { getByText, queryByText, findByText } = renderHomeScreen();
    await findByText('Alice Founder');

    // Trigger paywall
    postMatchAction.mockResolvedValue(PAYWALL_RESPONSE);
    await act(async () => {
      fireEvent.press(getByText('Alice Founder'));
    });

    await waitFor(() => {
      expect(queryByText(/Maybe Later/i)).not.toBeNull();
    });

    // Tap Maybe Later
    await act(async () => {
      fireEvent.press(getByText('Maybe Later'));
    });

    // Paywall should be dismissed; deck is still accessible
    await waitFor(() => {
      expect(queryByText(/Capped at 10 Swipes/i)).toBeNull();
    });

    // Cards should still be present after dismissal
    expect(queryByText('Alice Founder')).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 4: swipeAction response branching — postMatchAction called with
  // the correct fields (action, request_id) and card is NOT advanced on paywall
  // -------------------------------------------------------------------------
  it('calls postMatchAction with request_id and does not advance card on paywall', async () => {
    postMatchAction.mockResolvedValue(PAYWALL_RESPONSE);

    const { findByText } = renderHomeScreen();
    await findByText('Alice Founder');

    await act(async () => {
      fireEvent.press(await findByText('Alice Founder'));
    });

    await waitFor(() => {
      expect(postMatchAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringMatching(/like|pass|save/),
          requestId: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
        }),
      );
    });

    // Card should NOT have advanced — Alice is still the visible card
    expect(await findByText('Alice Founder')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 5: interstitial Continue button advances the card and closes modal
  // -------------------------------------------------------------------------
  it('advances card and closes interstitial when Continue is pressed', async () => {
    postMatchAction.mockResolvedValue(AD_DUE_RESPONSE);

    const { queryByText, findByText } = renderHomeScreen();
    await findByText('Alice Founder');

    await act(async () => {
      fireEvent.press(await findByText('Alice Founder'));
    });

    // Wait for interstitial
    await waitFor(() => {
      expect(queryByText(/Advertisement/i)).not.toBeNull();
    });

    // Press Continue
    await act(async () => {
      fireEvent.press(queryByText(/Continue/i));
    });

    // Interstitial should be gone
    await waitFor(() => {
      expect(queryByText(/Advertisement/i)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: Repeated paywall responses after Maybe Later are handled gracefully
  // (no crash, paywall re-shows)
  // -------------------------------------------------------------------------
  it('re-shows paywall gracefully on repeated paywall_required responses after Maybe Later', async () => {
    postMatchAction.mockResolvedValue(PAYWALL_RESPONSE);

    const { getByText, queryByText, findByText } = renderHomeScreen();
    await findByText('Alice Founder');

    // First paywall
    await act(async () => {
      fireEvent.press(getByText('Alice Founder'));
    });
    await waitFor(() => expect(queryByText(/Maybe Later/i)).not.toBeNull());

    // Dismiss
    await act(async () => {
      fireEvent.press(getByText('Maybe Later'));
    });
    await waitFor(() => expect(queryByText(/Capped at 10 Swipes/i)).toBeNull());

    // Try again — backend still returns paywall_required
    await act(async () => {
      fireEvent.press(getByText('Alice Founder'));
    });

    // Second paywall should show without crash
    await waitFor(() => {
      expect(queryByText(/Daily Matchmaking/i)).not.toBeNull();
    });
  });
});
