import { BASE_URL } from "./Constants";
import { apiFetch } from "./apiClient";

function normalizeApiBaseUrl(value) {
  const text = String(value || "")
    .trim()
    .replace(/^['\"]|['\"]$/g, "")
    .replace(/\/$/, "");

  return text;
}

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL,
);
const FIREBASE_LOGIN_PATH = "/auth/firebase-login";
const FIREBASE_SIGNIN_PATH = "/auth/firebase-signin";
const USER_EMAIL_UPDATE_PATH = "/users/me/email";
const USER_PROFILE_PATH =
  process.env.EXPO_PUBLIC_USER_PROFILE_PATH || "/users/me/profile";
const LINKEDIN_INGEST_PATH =
  process.env.EXPO_PUBLIC_LINKEDIN_INGEST_PATH || "/linkedin-profile/ingest";
const INDUSTRIES_PATH =
  process.env.EXPO_PUBLIC_INDUSTRIES_PATH || "/industries";
const USER_MATCHES_PATH =
  process.env.EXPO_PUBLIC_USER_MATCHES_PATH || "/users/me/matches";
const USER_ENTITLEMENTS_PATH =
  process.env.EXPO_PUBLIC_USER_ENTITLEMENTS_PATH || "/users/me/entitlements";
const PRICING_PLANS_PATH =
  process.env.EXPO_PUBLIC_PRICING_PLANS_PATH || "/users/me/paywall/pricing";
const BILLING_CHECKOUT_SESSION_PATH =
  process.env.EXPO_PUBLIC_BILLING_CHECKOUT_SESSION_PATH ||
  "/users/me/billing/checkout-session";
const BILLING_PAYU_STATUS_PATH =
  process.env.EXPO_PUBLIC_BILLING_PAYU_STATUS_PATH || "/billing/payu/status";
const RECEIVED_INVITES_PATH =
  process.env.EXPO_PUBLIC_RECEIVED_INVITES_PATH || "/users/me/invites";
const SENT_INVITES_PATH =
  process.env.EXPO_PUBLIC_SENT_INVITES_PATH || "/users/me/invites/sent";
const SAVED_PROFILES_PATH =
  process.env.EXPO_PUBLIC_SAVED_PROFILES_PATH || "/users/me/saved";
const PASSED_PROFILES_PATH =
  process.env.EXPO_PUBLIC_PASSED_PROFILES_PATH || "/users/me/passed";
const INVITES_COUNTS_PATH =
  process.env.EXPO_PUBLIC_INVITES_COUNTS_PATH || "/users/me/invites/counts";
const DEVICE_TOKENS_PATH =
  process.env.EXPO_PUBLIC_DEVICE_TOKENS_PATH || "/users/me/device-tokens";
const IMAGE_UPLOAD_PATH =
  process.env.EXPO_PUBLIC_IMAGE_UPLOAD_PATH || "/images/upload";
const IMAGE_REMOVE_PATH =
  process.env.EXPO_PUBLIC_IMAGE_REMOVE_PATH || "/images/remove";

function createAuthHeaders(firebaseToken = "") {
  const headers = {
    "Content-Type": "application/json",
  };

  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  return headers;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createHttpError(response, payload, fallbackMessage) {
  const error = new Error(
    payload?.detail || payload?.message || fallbackMessage,
  );
  error.status = response.status;
  error.payload = payload;
  return error;
}

function normalizeListPayload(payload) {
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    nextCursor: payload?.next_cursor ?? payload?.nextCursor ?? null,
    hasMore:
      typeof payload?.has_more === "boolean"
        ? payload.has_more
        : typeof payload?.hasMore === "boolean"
          ? payload.hasMore
          : Boolean(payload?.next_cursor ?? payload?.nextCursor),
    planTier: String(payload?.plan_tier ?? payload?.planTier ?? "").trim(),
    paywallRequired:
      typeof payload?.paywall_required === "boolean"
        ? payload.paywall_required
        : typeof payload?.paywallRequired === "boolean"
          ? payload.paywallRequired
          : false,
    remainingUnlocksToday:
      payload?.remaining_unlocks_today ??
      payload?.remainingUnlocksToday ??
      null,
  };
}

async function fetchPaginatedList({
  firebaseToken = "",
  path,
  status,
  limit = 20,
  cursor = null,
} = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set(
    "limit",
    String(Math.min(Math.max(Number(limit) || 20, 1), 100)),
  );

  if (status) {
    queryParams.set("status", String(status));
  }

  if (cursor) {
    queryParams.set("cursor", String(cursor));
  }

  const response = await apiFetch(
    `${path}?${queryParams.toString()}`,
    {
      method: "GET",
      headers: createAuthHeaders(firebaseToken),
    },
  );

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createHttpError(
      response,
      payload,
      `Request failed with status ${response.status}`,
    );
  }

  return normalizeListPayload(payload || {});
}

function buildUploadFileName(contentType) {
  const normalizedType = String(contentType || "image/jpeg").toLowerCase();
  if (normalizedType.includes("png")) return "profile-photo.png";
  if (normalizedType.includes("webp")) return "profile-photo.webp";
  return "profile-photo.jpg";
}

function resolveToAbsoluteUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (!/^\//.test(text)) {
    return "";
  }

  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    return `${apiOrigin}${text}`;
  } catch {
    return "";
  }
}

function extractUploadedImageUri(payload) {
  const candidates = [
    payload?.image_url,
    payload?.imageUrl,
    payload?.url,
    payload?.uri,
    payload?.public_url,
    payload?.file_url,
    payload?.data?.image_url,
    payload?.data?.imageUrl,
    payload?.data?.url,
    payload?.data?.uri,
    payload?.data?.public_url,
  ];

  const firstValid = candidates
    .map((value) => resolveToAbsoluteUrl(value))
    .find((value) => Boolean(value));

  return firstValid || "";
}

/**
 * Step 1 handoff only: send Firebase idToken to backend.
 * Backend verification and JWT issuance are handled server-side in later steps.
 */
export async function sendFirebaseIdTokenToBackend(
  idToken,
  phone_number,
  country_id,
) {
  const response = await apiFetch(FIREBASE_LOGIN_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firebaseToken: idToken,
      idToken,
      phone_number,
      country_id,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `Backend token handoff failed with status ${response.status}`,
    );
  }

  return payload;
}

export async function updateUserEmailInBackend(email, firebaseToken) {
  const response = await apiFetch(USER_EMAIL_UPDATE_PATH, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firebaseToken}`,
    },
    body: JSON.stringify({
      email,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Email update failed with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function submitUserProfile(profileData, firebaseToken) {
  const response = await apiFetch(USER_PROFILE_PATH, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firebaseToken}`,
    },
    body: JSON.stringify(profileData),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Profile submission failed with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function ingestLinkedinProfile(
  linkedinPayload,
  userId,
  firebaseToken = "",
) {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    throw new Error("Could not determine user id for LinkedIn profile ingest.");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const body = {
    userid: numericUserId,
    ...(linkedinPayload || {}),
  };

  const response = await apiFetch(LINKEDIN_INGEST_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `LinkedIn ingest failed with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function getIndustries(firebaseToken = "") {
  const headers = {
    "Content-Type": "application/json",
  };

  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const response = await apiFetch(INDUSTRIES_PATH, {
    method: "GET",
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Failed to load industries with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function normalizeMatchesPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      nextCursor: null,
    };
  }

  if (Array.isArray(payload?.items)) {
    return {
      items: payload.items,
      nextCursor: payload?.next_cursor ?? payload?.nextCursor ?? null,
    };
  }

  if (Array.isArray(payload?.data)) {
    return {
      items: payload.data,
      nextCursor: payload?.next_cursor ?? payload?.nextCursor ?? null,
    };
  }

  if (payload && typeof payload === "object" && payload?.candidate_id != null) {
    return {
      items: [payload],
      nextCursor: payload?.next_cursor ?? payload?.nextCursor ?? null,
    };
  }

  return {
    items: [],
    nextCursor: payload?.next_cursor ?? payload?.nextCursor ?? null,
  };
}

function normalizePaywallPricingPayload(payload) {
  const normalizePlan = (plan) => {
    const code = String(plan?.plan_code || plan?.code || "").trim();
    const currencyCode = String(plan?.currency_code || "")
      .trim()
      .toUpperCase();
    const amountMinor = Number(plan?.amount_minor ?? plan?.price_minor);

    return {
      ...plan,
      plan_code: code,
      code,
      currency_code: currencyCode,
      amount_minor: Number.isFinite(amountMinor)
        ? Math.round(amountMinor)
        : null,
      price_minor: Number.isFinite(amountMinor)
        ? Math.round(amountMinor)
        : null,
    };
  };

  if (Array.isArray(payload)) {
    return {
      plans: payload
        .map(normalizePlan)
        .filter((plan) => Boolean(plan.plan_code)),
      currency_code: "",
      is_indian_user: false,
      india_country_id: null,
      user_country_id: null,
    };
  }

  return {
    user_id: payload?.user_id ?? null,
    user_country_id: payload?.user_country_id ?? null,
    india_country_id: payload?.india_country_id ?? null,
    is_indian_user: Boolean(payload?.is_indian_user),
    currency_code: String(payload?.currency_code || "")
      .trim()
      .toUpperCase(),
    plans: Array.isArray(payload?.plans)
      ? payload.plans
          .map(normalizePlan)
          .filter((plan) => Boolean(plan.plan_code))
      : [],
  };
}

export async function getMyMatches({
  firebaseToken,
  getFirebaseToken,
  mode = "matchmaking",
  limit = 20,
  cursor = null,
  refresh = false,
} = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set("mode", mode === "discover" ? "discover" : "matchmaking");
  queryParams.set(
    "limit",
    String(Math.min(Math.max(Number(limit) || 20, 1), 100)),
  );

  if (cursor) {
    queryParams.set("cursor", String(cursor));
  }

  if (refresh) {
    queryParams.set("refresh", "true");
  }

  async function requestMatches(token) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await apiFetch(
      `${USER_MATCHES_PATH}?${queryParams.toString()}`,
      {
        method: "GET",
        headers,
      },
    );

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return { response, payload };
  }

  let token = firebaseToken || "";

  if (typeof getFirebaseToken === "function") {
    token = await getFirebaseToken(false);
  }

  let { response, payload } = await requestMatches(token);

  if (response.status === 401 && typeof getFirebaseToken === "function") {
    const refreshedToken = await getFirebaseToken(true);
    ({ response, payload } = await requestMatches(refreshedToken));
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Failed to load matches with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return normalizeMatchesPayload(payload);
}

export async function postMatchAction({
  firebaseToken,
  candidateId,
  action,
  connectionMessage = "",
  requestId = "",
} = {}) {
  if (!candidateId) {
    throw new Error("candidateId is required for match action.");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const body = {
    action: String(action || "").trim(),
  };

  const trimmedMessage = String(connectionMessage || "").trim();
  if (trimmedMessage) {
    body.connection_message = trimmedMessage;
  }

  const trimmedRequestId = String(requestId || "").trim();
  if (trimmedRequestId) {
    body.request_id = trimmedRequestId;
  }

  const response = await apiFetch(
    `${USER_MATCHES_PATH}/${encodeURIComponent(candidateId)}/actions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Match action failed with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function getEntitlements(firebaseToken = "") {
  const headers = {
    "Content-Type": "application/json",
  };

  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const response = await apiFetch(USER_ENTITLEMENTS_PATH, {
    method: "GET",
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Failed to load entitlements with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function getPayUCheckoutStatus({
  firebaseToken = "",
  checkoutSessionId = "",
} = {}) {
  const normalizedSessionId = String(checkoutSessionId || "").trim();
  if (!normalizedSessionId) {
    throw new Error("checkout_session_id is required to load PayU status.");
  }

  const query = new URLSearchParams({
    checkout_session_id: normalizedSessionId,
  });
  const response = await apiFetch(
    `${BILLING_PAYU_STATUS_PATH}?${query.toString()}`,
    {
      method: "GET",
      headers: createAuthHeaders(firebaseToken),
    },
  );

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(
      response,
      payload,
      `Failed to load PayU checkout status with status ${response.status}`,
    );
  }

  const data = payload?.data && typeof payload.data === "object"
    ? payload.data
    : payload || {};

  return {
    ...data,
    checkout_session_id: String(
      data?.checkout_session_id || normalizedSessionId,
    ).trim(),
    status: String(data?.status || data?.payment_status || data?.checkout_status || "")
      .trim()
      .toLowerCase(),
    tier: String(data?.tier || data?.plan_tier || data?.entitlement?.tier || "")
      .trim()
      .toLowerCase(),
    is_premium: data?.is_premium === true ||
      String(data?.tier || data?.plan_tier || data?.entitlement?.tier || "")
        .trim()
        .toLowerCase() === "premium",
    raw: payload,
  };
}

export async function getPricingPlans(firebaseToken = "") {
  const headers = {
    "Content-Type": "application/json",
  };

  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const response = await apiFetch(PRICING_PLANS_PATH, {
    method: "GET",
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Failed to load pricing plans with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (Array.isArray(payload)) {
    return normalizePaywallPricingPayload(payload);
  }

  if (Array.isArray(payload?.data)) {
    return normalizePaywallPricingPayload({ ...payload, plans: payload.data });
  }

  return normalizePaywallPricingPayload(payload || {});
}

export async function createBillingCheckoutSession({
  firebaseToken = "",
  planCode = "",
} = {}) {
  const normalizedPlanCode = String(planCode || "").trim();
  if (!normalizedPlanCode) {
    throw new Error("plan_code is required to initialize checkout."); 
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const response = await apiFetch(
    BILLING_CHECKOUT_SESSION_PATH,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ plan_code: normalizedPlanCode }),
    },
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.detail ||
        payload?.message ||
        `Failed to initialize checkout with status ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const providerPayload =
    payload?.provider_payload && typeof payload.provider_payload === "object"
      ? payload.provider_payload
      : null;

  const normalizedProviderPayload = providerPayload
    ? {
        ...providerPayload,
        flow: String(providerPayload?.flow || "")
          .trim()
          .toLowerCase(),
        method: String(providerPayload?.method || "")
          .trim()
          .toUpperCase(),
        action_url: String(
          providerPayload?.action_url || providerPayload?.checkout_url || "",
        ).trim(),
        post_data:
          typeof providerPayload?.post_data === "string"
            ? providerPayload.post_data
            : typeof providerPayload?.postData === "string"
              ? providerPayload.postData
              : typeof providerPayload?.request_body === "string"
                ? providerPayload.request_body
                : typeof providerPayload?.body === "string"
                  ? providerPayload.body
                  : "",
        txnid: String(providerPayload?.txnid || "").trim(),
        surl: String(providerPayload?.surl || "").trim(),
        furl: String(providerPayload?.furl || "").trim(),
      }
    : null;

  return {
    user_id: payload?.user_id ?? null,
    user_country_id: payload?.user_country_id ?? null,
    india_country_id: payload?.india_country_id ?? null,
    is_indian_user: Boolean(payload?.is_indian_user),
    provider: String(payload?.provider || "")
      .trim()
      .toLowerCase(),
    plan_id: payload?.plan_id ?? null,
    plan_code: String(payload?.plan_code || "").trim(),
    amount_minor: Number.isFinite(Number(payload?.amount_minor))
      ? Math.round(Number(payload?.amount_minor))
      : null,
    currency_code: String(payload?.currency_code || "")
      .trim()
      .toUpperCase(),
    checkout_session_id: String(payload?.checkout_session_id || "").trim(),
    checkout_status: String(payload?.checkout_status || "")
      .trim()
      .toLowerCase(),
    checkout_url: String(
      payload?.checkout_url || payload?.payment_url || "",
    ).trim(),
    provider_payload: normalizedProviderPayload,
    message: String(payload?.message || "").trim(),
    raw: payload,
  };
}

export async function getReceivedInvites({
  firebaseToken = "",
  status = "pending",
  limit = 20,
  cursor = null,
} = {}) {
  return fetchPaginatedList({
    firebaseToken,
    path: RECEIVED_INVITES_PATH,
    status,
    limit,
    cursor,
  });
}

export async function getSentInvites({
  firebaseToken = "",
  status = "all",
  limit = 20,
  cursor = null,
} = {}) {
  return fetchPaginatedList({
    firebaseToken,
    path: SENT_INVITES_PATH,
    status,
    limit,
    cursor,
  });
}

export async function getSavedProfiles({
  firebaseToken = "",
  limit = 20,
  cursor = null,
} = {}) {
  return fetchPaginatedList({
    firebaseToken,
    path: SAVED_PROFILES_PATH,
    limit,
    cursor,
  });
}

export async function getPassedProfiles({
  firebaseToken = "",
  limit = 20,
  cursor = null,
} = {}) {
  return fetchPaginatedList({
    firebaseToken,
    path: PASSED_PROFILES_PATH,
    limit,
    cursor,
  });
}

export async function getInviteCounts({ firebaseToken = "" } = {}) {
  const response = await apiFetch(INVITES_COUNTS_PATH, {
    method: "GET",
    headers: createAuthHeaders(firebaseToken),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createHttpError(
      response,
      payload,
      `Failed to fetch invite counts with status ${response.status}`,
    );
  }

  return payload || {};
}

export async function mutateInvite({
  firebaseToken = "",
  inviteId,
  action,
  acceptanceMessage = "",
  requestId,
} = {}) {
  if (!inviteId) {
    throw new Error("inviteId is required.");
  }

  const body = {
    action: String(action || "").trim(),
  };

  const trimmedMessage = String(acceptanceMessage || "").trim();
  if (trimmedMessage) {
    body.acceptance_message = trimmedMessage;
  }

  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    body.request_id = normalizedRequestId;
  }

  const response = await apiFetch(
    `${RECEIVED_INVITES_PATH}/${encodeURIComponent(inviteId)}`,
    {
      method: "PATCH",
      headers: createAuthHeaders(firebaseToken),
      body: JSON.stringify(body),
    },
  );

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createHttpError(
      response,
      payload,
      `Failed to update invite with status ${response.status}`,
    );
  }

  return payload;
}

export async function withdrawSentInvite({
  firebaseToken = "",
  inviteId,
  requestId,
} = {}) {
  if (!inviteId) {
    throw new Error("inviteId is required.");
  }

  const body = {};
  const normalizedRequestId = String(requestId || "").trim();
  if (normalizedRequestId) {
    body.request_id = normalizedRequestId;
  }

  const response = await apiFetch(
    `${RECEIVED_INVITES_PATH}/${encodeURIComponent(inviteId)}/withdraw`,
    {
      method: "POST",
      headers: createAuthHeaders(firebaseToken),
      body: JSON.stringify(body),
    },
  );

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createHttpError(
      response,
      payload,
      `Failed to withdraw invite with status ${response.status}`,
    );
  }

  return payload;
}

export async function registerDevicePushToken({
  firebaseToken = "",
  token,
  provider,
  platform,
  device_id,
  app_version,
} = {}) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return null;
  }

  const body = {
    token: normalizedToken,
    provider: String(provider || "fcm").trim() || "fcm",
    platform: String(platform || "").trim(),
    device_id: String(device_id || "").trim(),
    app_version: String(app_version || "").trim(),
  };

  const response = await apiFetch(DEVICE_TOKENS_PATH, {
    method: "PUT",
    headers: createAuthHeaders(firebaseToken),
    body: JSON.stringify(body),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createHttpError(
      response,
      payload,
      `Failed to register device token with status ${response.status}`,
    );
  }

  return payload;
}

export async function deactivateDevicePushToken({
  firebaseToken = "",
  token,
} = {}) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return null;
  }

  const response = await apiFetch(DEVICE_TOKENS_PATH, {
    method: "DELETE",
    headers: createAuthHeaders(firebaseToken),
    body: JSON.stringify({ token: normalizedToken }),
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createHttpError(
      response,
      payload,
      `Failed to deactivate device token with status ${response.status}`,
    );
  }

  return payload;
}

export async function uploadProfileImage(imageUri, firebaseToken) {
  const normalizedUri = String(imageUri || "").trim();

  if (!normalizedUri) {
    throw new Error("No image URI provided for upload.");
  }

  const fileResponse = await fetch(normalizedUri);
  if (!fileResponse.ok) {
    throw new Error("Could not read the selected image for upload.");
  }

  const blob = await fileResponse.blob();
  const contentType = blob?.type || "image/jpeg";
  const fileName = buildUploadFileName(contentType);

  const formData = new FormData();
  formData.append("file", blob, fileName);

  const headers = {};
  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const response = await apiFetch(IMAGE_UPLOAD_PATH, {
    method: "POST",
    headers,
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `Image upload failed with status ${response.status}`,
    );
  }

  const uploadedImageUri = extractUploadedImageUri(payload);
  if (!uploadedImageUri) {
    throw new Error("Image upload succeeded but no image URL was returned.");
  }

  return {
    imageUri: uploadedImageUri,
    payload,
  };
}

function resolveRemovalUrlPath(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const parsed = new URL(text);
      return parsed.pathname || "";
    } catch {
      return "";
    }
  }

  return text.startsWith("/") ? text : `/${text}`;
}

export async function removeProfileImage(imageUrl, firebaseToken) {
  const normalizedUrl = resolveRemovalUrlPath(imageUrl);

  if (!normalizedUrl) {
    throw new Error("No image URL was provided for removal.");
  }

  const headers = {};
  if (firebaseToken) {
    headers.Authorization = `Bearer ${firebaseToken}`;
  }

  const query = `?url=${encodeURIComponent(normalizedUrl)}`;
  const response = await apiFetch(`${IMAGE_REMOVE_PATH}${query}`, {
    method: "DELETE",
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `Image removal failed with status ${response.status}`,
    );
  }

  return payload;
}

/**
 * Sign in an existing user via Firebase idToken.
 * Calls /auth/firebase-signin — only succeeds if the user already exists.
 */
export async function signInWithFirebaseToken(idToken, phone_number) {
  const response = await apiFetch(FIREBASE_SIGNIN_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firebaseToken: idToken,
      idToken,
      phone_number,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const err = new Error(
      payload?.detail ||
        payload?.message ||
        `Sign in failed with status ${response.status}`,
    );
    err.status = response.status;
    throw err;
  }

  return payload;
}
