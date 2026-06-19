const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const FIREBASE_LOGIN_PATH = "/auth/firebase-login";
const FIREBASE_SIGNIN_PATH = "/auth/firebase-signin";
const USER_EMAIL_UPDATE_PATH = "/users/me/email";
const USER_PROFILE_PATH =
  process.env.EXPO_PUBLIC_USER_PROFILE_PATH || "/users/me/profile";
const LINKEDIN_INGEST_PATH =
  process.env.EXPO_PUBLIC_LINKEDIN_INGEST_PATH || "/linkedin-profile/ingest";
const INDUSTRIES_PATH = process.env.EXPO_PUBLIC_INDUSTRIES_PATH || "/industries";
const USER_MATCHES_PATH = process.env.EXPO_PUBLIC_USER_MATCHES_PATH || "/users/me/matches";
const IMAGE_UPLOAD_PATH = process.env.EXPO_PUBLIC_IMAGE_UPLOAD_PATH || "/images/upload";
const IMAGE_REMOVE_PATH = process.env.EXPO_PUBLIC_IMAGE_REMOVE_PATH || "/images/remove";

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
export async function sendFirebaseIdTokenToBackend(idToken, phone_number) {
  const response = await fetch(`${API_BASE_URL}${FIREBASE_LOGIN_PATH}`, {
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
  const response = await fetch(`${API_BASE_URL}${USER_EMAIL_UPDATE_PATH}`, {
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
  const response = await fetch(`${API_BASE_URL}${USER_PROFILE_PATH}`, {
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

export async function ingestLinkedinProfile(linkedinPayload, userId, firebaseToken = "") {
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

  const response = await fetch(`${API_BASE_URL}${LINKEDIN_INGEST_PATH}`, {
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

  const response = await fetch(`${API_BASE_URL}${INDUSTRIES_PATH}`, {
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

  if (payload && typeof payload === 'object' && payload?.candidate_id != null) {
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

export async function getMyMatches({
  firebaseToken,
  getFirebaseToken,
  mode = 'matchmaking',
  limit = 20,
  cursor = null,
  refresh = false,
} = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set('mode', mode === 'discover' ? 'discover' : 'matchmaking');
  queryParams.set('limit', String(Math.min(Math.max(Number(limit) || 20, 1), 100)));

  if (cursor) {
    queryParams.set('cursor', String(cursor));
  }

  if (refresh) {
    queryParams.set('refresh', 'true');
  }

  async function requestMatches(token) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${USER_MATCHES_PATH}?${queryParams.toString()}`, {
      method: 'GET',
      headers,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return { response, payload };
  }

  let token = firebaseToken || '';

  if (typeof getFirebaseToken === 'function') {
    token = await getFirebaseToken(false);
  }

  let { response, payload } = await requestMatches(token);

  if (response.status === 401 && typeof getFirebaseToken === 'function') {
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

  const response = await fetch(`${API_BASE_URL}${IMAGE_UPLOAD_PATH}`, {
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
  const response = await fetch(`${API_BASE_URL}${IMAGE_REMOVE_PATH}${query}`, {
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
  const response = await fetch(`${API_BASE_URL}${FIREBASE_SIGNIN_PATH}`, {
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

