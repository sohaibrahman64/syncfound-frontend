import { createBillingCheckoutSession, getPricingPlans } from '../utils/backendAuth';

describe('getPricingPlans', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it('calls the paywall pricing endpoint and normalizes Indian pricing payloads', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        user_id: 123,
        user_country_id: 101,
        india_country_id: 101,
        is_indian_user: true,
        currency_code: 'INR',
        plans: [
          {
            id: 1,
            code: 'premium_inr_monthly',
            name: 'Premium Plan Monthly (IN)',
            tier: 'premium',
            currency_code: 'INR',
            price_minor: 94873,
            billing_interval_months: 1,
            is_active: true,
          },
        ],
      }),
    });

    const result = await getPricingPlans('token-123');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me/paywall/pricing'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
    expect(result.currency_code).toBe('INR');
    expect(result.is_indian_user).toBe(true);
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].price_minor).toBe(94873);
  });

  it('normalizes non-Indian USD payloads', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        user_id: 123,
        user_country_id: 205,
        india_country_id: 101,
        is_indian_user: false,
        currency_code: 'USD',
        plans: [
          {
            id: 3,
            code: 'premium_usd_monthly',
            name: 'Premium Plan Monthly (US)',
            tier: 'premium',
            currency_code: 'USD',
            price_minor: 999,
            billing_interval_months: 1,
            is_active: true,
          },
        ],
      }),
    });

    const result = await getPricingPlans('token-123');

    expect(result.currency_code).toBe('USD');
    expect(result.is_indian_user).toBe(false);
    expect(result.plans[0].price_minor).toBe(999);
  });

  it('initializes checkout session with backend-selected provider payload', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        user_id: 123,
        user_country_id: 101,
        india_country_id: 101,
        is_indian_user: true,
        provider: 'payu',
        plan_id: 2,
        plan_code: 'premium_inr_monthly',
        amount_minor: 94873,
        currency_code: 'INR',
        checkout_session_id: 'sess_123',
        checkout_status: 'created',
        provider_payload: {
          flow: 'webview_post',
          method: 'POST',
          action_url: 'https://test.payu.in/_payment',
          post_data: 'key=xxxxx&txnid=123&amount=1.0&hash=abc',
          txnid: 'txn_123',
          surl: 'https://payu.example.com/success',
          furl: 'https://payu.example.com/failure',
        },
        message: 'Checkout session initialized.',
      }),
    });

    const result = await createBillingCheckoutSession({
      firebaseToken: 'token-123',
      planCode: 'premium_inr_monthly',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me/billing/checkout-session'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
        body: JSON.stringify({ plan_code: 'premium_inr_monthly' }),
      }),
    );
    expect(result.provider).toBe('payu');
    expect(result.user_id).toBe(123);
    expect(result.plan_code).toBe('premium_inr_monthly');
    expect(result.currency_code).toBe('INR');
    expect(result.amount_minor).toBe(94873);
    expect(result.checkout_session_id).toBe('sess_123');
    expect(result.checkout_status).toBe('created');
    expect(result.provider_payload).toEqual(
      expect.objectContaining({
        flow: 'webview_post',
        method: 'POST',
        action_url: 'https://test.payu.in/_payment',
        post_data: 'key=xxxxx&txnid=123&amount=1.0&hash=abc',
      }),
    );
  });

  it('accepts metadata-first checkout response without checkout_url', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        provider: 'payu',
        plan_code: 'premium_usd_monthly',
        amount_minor: 999,
        currency_code: 'USD',
        checkout_session_id: 'chk_9z8y',
        checkout_status: 'created',
        provider_payload: {
          flow: 'webview_post',
          method: 'POST',
          //action_url: 'https://secure.payu.in/_payment',
          action_url: 'https://test.payu.in/_payment',
          post_data: 'key=xxxxx&txnid=999&amount=9.99&hash=abc',
          txnid: 'txn_999',
          surl: 'https://payu.example.com/success',
          furl: 'https://payu.example.com/failure',
        },
      }),
    });

    const result = await createBillingCheckoutSession({
      firebaseToken: 'token-123',
      planCode: 'premium_usd_monthly',
    });

    expect(result.checkout_url).toBe('');
    expect(result.provider).toBe('payu');
    expect(result.provider_payload).toEqual(
      expect.objectContaining({
        flow: 'webview_post',
        method: 'POST',
        //action_url: 'https://secure.payu.in/_payment',
        action_url: 'https://test.payu.in/_payment',
      }),
    );
  });
});
