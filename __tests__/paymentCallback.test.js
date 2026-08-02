import { formatPaymentStatusLabel, parsePaymentCallbackFromUrl } from '../utils/paymentCallback';

describe('payment callback parsing', () => {
  it('parses syncfound://payment/success with query params', () => {
    const result = parsePaymentCallbackFromUrl(
      'syncfound://payment/success?checkout_session_id=sess_123&status=success&txnid=tx_456',
    );

    expect(result).toEqual({
      screen: 'paymentSuccess',
      params: {
        checkoutSessionId: 'sess_123',
        status: 'success',
        txnid: 'tx_456',
        errorCode: '',
        errorMessage: '',
        mihpayid: '',
        mode: '',
        amount: '',
        productinfo: '',
        email: '',
        phone: '',
        rawUrl: 'syncfound://payment/success?checkout_session_id=sess_123&status=success&txnid=tx_456',
      },
    });
  });

  it('parses syncfound://payment/failure with error params', () => {
    const result = parsePaymentCallbackFromUrl(
      'syncfound://payment/failure?checkout_session_id=sess_123&status=failed&error_code=E01&error_message=Declined',
    );

    expect(result).toEqual({
      screen: 'paymentFailure',
      params: {
        checkoutSessionId: 'sess_123',
        status: 'failed',
        txnid: '',
        errorCode: 'E01',
        errorMessage: 'Declined',
        mihpayid: '',
        mode: '',
        amount: '',
        productinfo: '',
        email: '',
        phone: '',
        rawUrl: 'syncfound://payment/failure?checkout_session_id=sess_123&status=failed&error_code=E01&error_message=Declined',
      },
    });
  });

  it('parses optional bridge callback metadata fields', () => {
    const result = parsePaymentCallbackFromUrl(
      'https://example.com/payment/success?checkout_session_id=sess_555&status=success&txnid=tx_abc&mihpayid=payu_777&mode=UPI&amount=99.00&productinfo=Premium%20Plan&email=user%40example.com&phone=9999999999',
    );

    expect(result).toEqual({
      screen: 'paymentSuccess',
      params: {
        checkoutSessionId: 'sess_555',
        status: 'success',
        txnid: 'tx_abc',
        errorCode: '',
        errorMessage: '',
        mihpayid: 'payu_777',
        mode: 'UPI',
        amount: '99.00',
        productinfo: 'Premium Plan',
        email: 'user@example.com',
        phone: '9999999999',
        rawUrl: 'https://example.com/payment/success?checkout_session_id=sess_555&status=success&txnid=tx_abc&mihpayid=payu_777&mode=UPI&amount=99.00&productinfo=Premium%20Plan&email=user%40example.com&phone=9999999999',
      },
    });
  });

  it('normalizes payment status labels', () => {
    expect(formatPaymentStatusLabel('success')).toBe('Success');
    expect(formatPaymentStatusLabel('failed')).toBe('Failed');
    expect(formatPaymentStatusLabel('pending')).toBe('Pending');
  });
});
