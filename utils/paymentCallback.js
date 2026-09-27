function normalizePaymentStatus(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (raw === 'success' || raw === 'succeeded' || raw === 'paid' || raw === 'completed') {
    return 'success';
  }

  if (raw === 'pending' || raw === 'processing' || raw === 'initiated') {
    return 'pending';
  }

  if (raw === 'cancelled' || raw === 'canceled') {
    return 'cancelled';
  }

  if (raw === 'failed' || raw === 'failure' || raw === 'error') {
    return 'failed';
  }

  return raw;
}

function parseUrlQueryParams(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) {
    return {};
  }

  try {
    const parsed = new URL(rawUrl);
    const pairs = parsed.searchParams.entries();
    const result = {};
    for (const [key, value] of pairs) {
      result[String(key || '').trim()] = String(value || '').trim();
    }
    return result;
  } catch {
    const queryString = rawUrl.split('?')[1] || '';
    if (!queryString) {
      return {};
    }

    return queryString
      .split('&')
      .filter(Boolean)
      .reduce((acc, pair) => {
        const [rawKey, rawValue = ''] = pair.split('=');
        const key = decodeURIComponent(String(rawKey || '').trim());
        if (!key) {
          return acc;
        }

        acc[key] = decodeURIComponent(String(rawValue || '').trim());
        return acc;
      }, {});
  }
}

function parseUrlParts(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) {
    return { pathname: '', host: '', protocol: '' };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      pathname: String(parsed.pathname || '').trim().toLowerCase(),
      host: String(parsed.host || '').trim().toLowerCase(),
      protocol: String(parsed.protocol || '').trim().toLowerCase(),
    };
  } catch {
    const withoutQuery = rawUrl.split('?')[0] || '';
    return {
      pathname: String(withoutQuery || '').trim().toLowerCase(),
      host: '',
      protocol: '',
    };
  }
}

export function parsePaymentCallbackFromUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) {
    return null;
  }

  const params = parseUrlQueryParams(rawUrl);
  const { pathname, host, protocol } = parseUrlParts(rawUrl);

  const isSuccessPath = pathname.endsWith('/api/v1/billing/payu/success');
  const isFailurePath = pathname.endsWith('/api/v1/billing/payu/failure');
  const isSuccessSubPath = pathname === '/success' || pathname.endsWith('/success');
  const isFailureSubPath = pathname === '/failure' || pathname.endsWith('/failure');
  const isPaymentHostPath = host === 'payment' && (isSuccessSubPath || isFailureSubPath);
  const isAppScheme = protocol === 'syncfound:';
  const isPaymentReturnHost = host === 'payment-return' || pathname.endsWith('/payment-return');

  const checkoutSessionId = String(
    params.checkout_session_id || params.session_id || '',
  ).trim();
  const normalizedStatus = normalizePaymentStatus(params.status || params.checkout_status || '');
  const txnid = String(params.txnid || params.transaction_id || '').trim();
  const errorCode = String(params.error_code || '').trim();
  const errorMessage = String(params.error_message || params.message || '').trim();
  const mihpayid = String(params.mihpayid || '').trim();
  const mode = String(params.mode || '').trim();
  const amount = String(params.amount || '').trim();
  const productinfo = String(params.productinfo || '').trim();
  const email = String(params.email || '').trim();
  const phone = String(params.phone || '').trim();

  const hasCallbackData = Boolean(
    checkoutSessionId ||
    normalizedStatus ||
    txnid ||
    errorCode ||
    errorMessage ||
    mihpayid ||
    mode ||
    amount ||
    productinfo ||
    email ||
    phone,
  );
  const hasKnownRoute =
    isSuccessPath ||
    isFailurePath ||
    isPaymentReturnHost ||
    (isAppScheme && isPaymentHostPath);

  if (!hasKnownRoute && !hasCallbackData) {
    return null;
  }

  const shouldRouteToFailure =
    isFailurePath ||
    isFailureSubPath ||
    normalizedStatus === 'failed' ||
    normalizedStatus === 'cancelled';

  return {
    screen: shouldRouteToFailure ? 'paymentFailure' : 'paymentSuccess',
    params: {
      checkoutSessionId,
      status: normalizedStatus,
      txnid,
      errorCode,
      errorMessage,
      mihpayid,
      mode,
      amount,
      productinfo,
      email,
      phone,
      rawUrl,
    },
  };
}

export function formatPaymentStatusLabel(status) {
  const normalized = normalizePaymentStatus(status);
  if (!normalized) {
    return 'Unknown';
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}
