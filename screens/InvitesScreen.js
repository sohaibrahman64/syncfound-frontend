import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPassedProfiles,
  getReceivedInvites,
  getSavedProfiles,
  getSentInvites,
  mutateInvite,
  postMatchAction,
  registerDevicePushToken,
  withdrawSentInvite,
} from '../utils/backendAuth';
import { getCurrentFirebaseIdToken } from '../utils/firebaseAuth';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';
import InviteListCard from '../components/invites/InviteListCard';
import InvitesEmptyState from '../components/invites/InvitesEmptyState';
import InvitesErrorState from '../components/invites/InvitesErrorState';
import InvitesLoadingSkeleton from '../components/invites/InvitesLoadingSkeleton';
import InvitesTabHeader from '../components/invites/InvitesTabHeader';

const TAB_INVITATIONS = 'invitations';
const TAB_SENT = 'sent';
const TAB_SAVED = 'saved';
const TAB_PASSED = 'passed';
const PAGE_LIMIT = 20;
const CACHE_TTL_MS = 60 * 1000;

const TABS = [
  { key: TAB_INVITATIONS, label: 'Invitations' },
  { key: TAB_SENT, label: 'Sent' },
  { key: TAB_SAVED, label: 'Saved' },
  { key: TAB_PASSED, label: 'Passed' },
];

function createRequestId() {
  if (typeof globalThis?.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAuthError(error) {
  return (
    error?.status === 401
    || /invalid firebase token|unauthori[sz]ed|token|forbidden/i.test(String(error?.message || ''))
  );
}

function getActionErrorMessage(error, fallback) {
  if (error?.status === 400 || error?.status === 404 || error?.status === 409) {
    return String(error?.message || fallback);
  }

  return fallback;
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean)
    .join(', ');
}

function normalizeTextArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => safeText(item)).filter(Boolean);
}

function resolveProfileName(profile = {}) {
  const firstName = safeText(profile?.first_name || profile?.firstname);
  const lastName = safeText(profile?.last_name || profile?.lastname);
  const combined = `${firstName} ${lastName}`.trim();

  return safeText(
    profile?.display_name
      || profile?.full_name
      || profile?.name
      || combined,
    'Name unavailable',
  );
}

function resolveCandidateId(row = {}, profile = {}) {
  return (
    profile?.candidate_id
    || profile?.candidateId
    || profile?.user_id
    || profile?.userId
    || profile?.id
    || row?.candidate_id
    || row?.candidateId
    || row?.user_id
    || row?.userId
    || row?.id
    || null
  );
}

function getTopMessageForTab(tabKey, item) {
  if (tabKey === TAB_INVITATIONS) {
    return safeText(item.messagePreview, 'No message.');
  }

  if (tabKey === TAB_SENT) {
    return `You: ${safeText(item.messagePreview, 'No message.')}`;
  }

  if (tabKey === TAB_SAVED) {
    return `You saved ${item.displayName} profile`;
  }

  return `You passed on ${item.displayName} profile`;
}

function resolveDetailsProfile(row = {}, tabKey) {
  if (tabKey === TAB_INVITATIONS) {
    return row?.source_profile_details || row?.from_profile_details || row?.from_profile || {};
  }

  if (tabKey === TAB_SENT) {
    return row?.target_profile_details || row?.to_profile_details || row?.to_profile || {};
  }

  if (tabKey === TAB_SAVED || tabKey === TAB_PASSED) {
    return row?.profile_details || row?.target_profile_details || row?.profile || {};
  }

  return {};
}

function buildDetailFields(profile = {}) {
  const userSkills = normalizeTextArray(profile?.user_skills);
  const cofounderSkills = normalizeTextArray(profile?.cofounder_skills);
  const industries = normalizeTextArray(profile?.industries);
  const workPreferences = normalizeTextArray(profile?.work_preferences || profile?.work_preference || profile?.work_modes);
  const startupExperiences = normalizeTextArray(profile?.startup_experience || profile?.startup_experiences);
  const linkedinExperiences = Array.isArray(profile?.linkedin_experiences)
    ? profile.linkedin_experiences.filter(Boolean)
    : [];
    const educationEntries = Array.isArray(profile?.education_details)
      ? profile.education_details.filter(Boolean)
      : Array.isArray(profile?.education)
        ? profile.education.filter(Boolean)
        : Array.isArray(profile?.linkedin_education)
          ? profile.linkedin_education.filter(Boolean)
          : Array.isArray(profile?.linkedin_educations)
            ? profile.linkedin_educations.filter(Boolean)
            : [];
  const topEducationSchool = safeText(profile?.linkedin_top_education_school_name);
  const topEducationDegree = safeText(profile?.linkedin_top_education_degree);
  const topEducationField = safeText(profile?.linkedin_top_education_field_of_study);
  const topEducationDate = safeText(
    profile?.linkedin_top_education_date_range
      || profile?.linkedin_top_education_duration
      || profile?.linkedin_top_education_dates,
  );
  const normalizedEducation = educationEntries.length > 0
    ? educationEntries.map((item) => ({
      school: safeText(item?.school || item?.school_name || item?.institution),
      degree: safeText(item?.degree || item?.degree_name),
      degree_name: safeText(item?.degree_name),
      field_of_study: safeText(item?.field_of_study || item?.field || item?.major),
      duration: safeText(
        item?.duration
          || item?.date_range
          || item?.dates
          || [item?.start_month, item?.start_year].filter(Boolean).join(' ') +
            (item?.end_month || item?.end_year ? ` - ${[item?.end_month, item?.end_year].filter(Boolean).join(' ')}` : ''),
      ),
      start_year: item?.start_year,
      end_year: item?.end_year,
    }))
    : topEducationSchool
      ? [{
        school: topEducationSchool,
        degree: topEducationDegree,
        degree_name: topEducationDegree,
        field_of_study: topEducationField,
        duration: topEducationDate,
      }]
      : [];

  return {
    title: safeText(profile?.title),
    userRole: safeText(profile?.user_role),
    role: safeText(profile?.role),
    bio: safeText(profile?.bio),
    experienceSummary: safeText(profile?.experience_summary),
    startupIdea: safeText(profile?.startup_idea),
    linkedinUrl: safeText(profile?.linkedin_url),
    linkedinHeadline: safeText(profile?.linkedin_headline),
    linkedinCurrentCompany: safeText(profile?.linkedin_current_company),
    age: safeText(profile?.age),
    dateOfBirth: safeText(profile?.date_of_birth || profile?.dob || profile?.birth_date),
    motivation: safeText(profile?.motivation),
    superpower: safeText(profile?.superpower || profile?.strength),
    passionAbout: safeText(profile?.passion_about),
    userSkills,
    cofounderSkills,
    industriesText: industries.join(', '),
    industries,
    workPreferences,
    startupExperiences,
    linkedinExperiences,
    educationEntries: normalizedEducation,
  };
}

function deriveAgeText(item = {}) {
  const explicitAge = Number(item?.age);
  if (Number.isFinite(explicitAge) && explicitAge > 0) {
    return `${Math.trunc(explicitAge)} years old`;
  }

  const dobRaw = safeText(item?.dateOfBirth);
  if (!dobRaw) {
    return '';
  }

  const date = new Date(dobRaw);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    years -= 1;
  }

  return years > 0 ? `${years} years old` : '';
}

function normalizeCommitmentText(value) {
  const text = safeText(value);
  if (!text) {
    return '';
  }

  if (/full[-\s]?time/i.test(text)) {
    return 'Full Time';
  }

  return text;
}

function createTabState() {
  return {
    items: [],
    isLoading: false,
    isRefreshing: false,
    isPaginating: false,
    error: '',
    nextCursor: null,
    hasMore: true,
  };
}

function normalizeInvitations(items = []) {
  return items.map((row) => {
    const invite = row?.invite || {};
    const profile = resolveDetailsProfile(row, TAB_INVITATIONS);
    const personName = resolveProfileName(profile);
    const candidateId = resolveCandidateId(row, profile);
    const detailFields = buildDetailFields(profile);

    return {
      key: `invite-${invite?.invite_id || invite?.id || Math.random()}`,
      inviteId: safeText(invite?.invite_id || invite?.id),
      candidateId,
      displayName: personName,
      previewName: personName,
      messagePreview: safeText(invite?.message, 'No message.'),
      photoUrl: safeText(profile?.profile_photo_url),
      locationText: safeText(profile?.location_text, 'Location unavailable'),
      intentBadge: safeText(profile?.intent_badge, 'Looking for a cofounder to join existing idea'),
      timeCommitment: safeText(profile?.time_commitment, 'Full Time Commitment'),
      roleTagsText: normalizeTags(profile?.role_tags) || 'Operations, Product, Sales/Marketing',
      readAt: invite?.read_at || null,
      status: safeText(invite?.status, 'pending').toLowerCase(),
      ...detailFields,
    };
  });
}

function normalizeSent(items = []) {
  return items.map((row) => {
    const invite = row?.invite || {};
    const profile = resolveDetailsProfile(row, TAB_SENT);
    const personName = resolveProfileName(profile);
    const candidateId = resolveCandidateId(row, profile);
    const detailFields = buildDetailFields(profile);

    return {
      key: `sent-${invite?.invite_id || invite?.id || Math.random()}`,
      inviteId: safeText(invite?.invite_id || invite?.id),
      candidateId,
      displayName: personName,
      previewName: 'You',
      messagePreview: safeText(invite?.message, 'No message.'),
      photoUrl: safeText(profile?.profile_photo_url),
      locationText: safeText(profile?.location_text, 'Location unavailable'),
      intentBadge: safeText(profile?.intent_badge, 'Looking for a cofounder to join existing idea'),
      timeCommitment: safeText(profile?.time_commitment, 'Already full-time on a startup'),
      roleTagsText: normalizeTags(profile?.role_tags) || 'Design, Operations, Product, Sales/Marketing',
      status: safeText(invite?.status, 'pending').toLowerCase(),
      ...detailFields,
    };
  });
}

function normalizeSaved(items = []) {
  return items.map((row) => {
    const profile = resolveDetailsProfile(row, TAB_SAVED);
    const personName = resolveProfileName(profile);
    const candidateId = resolveCandidateId(row, profile);
    const detailFields = buildDetailFields(profile);

    return {
      key: `saved-${row?.saved_id || row?.id || Math.random()}`,
      savedId: row?.saved_id || row?.id || null,
      candidateId,
      displayName: personName,
      previewName: personName,
      messagePreview: '',
      photoUrl: safeText(profile?.profile_photo_url),
      locationText: safeText(profile?.location_text, 'Location unavailable'),
      intentBadge: safeText(profile?.intent_badge, 'Looking for a cofounder to join existing idea'),
      timeCommitment: safeText(profile?.time_commitment, 'Ready to go full-time in the next year'),
      roleTagsText: normalizeTags(profile?.role_tags) || 'Operations, Product, Sales/Marketing',
      ...detailFields,
    };
  });
}

function normalizePassed(items = []) {
  return items.map((row) => {
    const profile = resolveDetailsProfile(row, TAB_PASSED);
    const personName = resolveProfileName(profile);
    const candidateId = resolveCandidateId(row, profile);
    const detailFields = buildDetailFields(profile);

    return {
      key: `passed-${row?.passed_id || row?.id || Math.random()}`,
      passedId: row?.passed_id || row?.id || null,
      candidateId,
      displayName: personName,
      previewName: personName,
      messagePreview: '',
      photoUrl: safeText(profile?.profile_photo_url),
      locationText: safeText(profile?.location_text, 'Location unavailable'),
      intentBadge: safeText(profile?.intent_badge, 'Looking for a cofounder to join existing idea'),
      timeCommitment: safeText(profile?.time_commitment, 'Ready to go full-time with the right co-founder'),
      roleTagsText: normalizeTags(profile?.role_tags) || 'AI/ML, Design, Engineering',
      ...detailFields,
    };
  });
}

function dedupeByKey(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const key = safeText(item?.key);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mapInviteItemToPassed(item = {}) {
  const fallbackKey = `passed-from-invite-${Math.random()}`;

  return {
    ...item,
    key: safeText(item?.passedId ? `passed-${item.passedId}` : item?.key?.replace(/^invite-/, 'passed-')) || fallbackKey,
    passedId: item?.passedId || item?.inviteId || null,
    inviteId: '',
    messagePreview: '',
  };
}

export default function InvitesScreen({ firebaseToken = '', onAuthExpired, onNavigate }) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(metrics, insets), [metrics, insets.top, insets.bottom]);

  const [activeTab, setActiveTab] = useState(TAB_INVITATIONS);
  const [actionError, setActionError] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isDetailActionLoading, setIsDetailActionLoading] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [tabsState, setTabsState] = useState({
    [TAB_INVITATIONS]: createTabState(),
    [TAB_SENT]: createTabState(),
    [TAB_SAVED]: createTabState(),
    [TAB_PASSED]: createTabState(),
  });

  const appStateRef = useRef(AppState.currentState);
  const tabsStateRef = useRef(tabsState);
  const snackbarTimeoutRef = useRef(null);
  const loadedAtRef = useRef({
    [TAB_INVITATIONS]: 0,
    [TAB_SENT]: 0,
    [TAB_SAVED]: 0,
    [TAB_PASSED]: 0,
  });

  useEffect(() => {
    tabsStateRef.current = tabsState;
  }, [tabsState]);

  useEffect(() => () => {
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
    }
  }, []);

  const showSnackbar = useCallback((message) => {
    const nextMessage = safeText(message);
    if (!nextMessage) {
      return;
    }

    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
    }

    setSnackbarMessage(nextMessage);
    snackbarTimeoutRef.current = setTimeout(() => {
      setSnackbarMessage('');
      snackbarTimeoutRef.current = null;
    }, 3000);
  }, []);

  const withToken = useCallback(async (requestFn) => {
    const token = await getCurrentFirebaseIdToken(false).catch(() => firebaseToken);
    return requestFn(token);
  }, [firebaseToken]);

  const patchTabState = useCallback((tabKey, patch) => {
    setTabsState((prev) => ({
      ...prev,
      [tabKey]: {
        ...prev[tabKey],
        ...patch,
      },
    }));
  }, []);

  const registerTokenIfAvailable = useCallback(async () => {
    const pushToken = safeText(process.env.EXPO_PUBLIC_DEVICE_PUSH_TOKEN);
    if (!pushToken) {
      return;
    }

    try {
      await withToken((token) => registerDevicePushToken({
        firebaseToken: token,
        token: pushToken,
        provider: 'fcm',
        platform: Platform.OS,
        device_id: safeText(process.env.EXPO_PUBLIC_DEVICE_ID, `${Platform.OS}-unknown`),
        app_version: safeText(process.env.EXPO_PUBLIC_APP_VERSION, '1.0.0'),
      }));
    } catch {
      // Best effort.
    }
  }, [withToken]);

  const loadTabData = useCallback(async ({ tabKey, refresh = false, paginate = false, force = false } = {}) => {
    const current = tabsStateRef.current[tabKey] || createTabState();
    const stale = Date.now() - Number(loadedAtRef.current[tabKey] || 0) > CACHE_TTL_MS;

    if (!force && !refresh && !paginate && loadedAtRef.current[tabKey] && !stale) {
      return;
    }

    if (paginate && (!current.hasMore || current.isPaginating || current.isLoading || current.isRefreshing)) {
      return;
    }

    patchTabState(tabKey, {
      isLoading: !refresh && !paginate,
      isRefreshing: refresh,
      isPaginating: paginate,
      error: refresh ? '' : current.error,
    });

    try {
      const payload = await withToken((token) => {
        const cursor = paginate ? current.nextCursor : null;

        if (tabKey === TAB_INVITATIONS) {
          return getReceivedInvites({ firebaseToken: token, status: 'pending', limit: PAGE_LIMIT, cursor });
        }

        if (tabKey === TAB_SENT) {
          return getSentInvites({ firebaseToken: token, status: 'all', limit: PAGE_LIMIT, cursor });
        }

        if (tabKey === TAB_SAVED) {
          return getSavedProfiles({ firebaseToken: token, limit: PAGE_LIMIT, cursor });
        }

        return getPassedProfiles({ firebaseToken: token, limit: PAGE_LIMIT, cursor });
      });

      let mapped = [];
      if (tabKey === TAB_INVITATIONS) {
        mapped = normalizeInvitations(payload?.items || []);
      } else if (tabKey === TAB_SENT) {
        mapped = normalizeSent(payload?.items || []);
      } else if (tabKey === TAB_SAVED) {
        mapped = normalizeSaved(payload?.items || []);
      } else {
        mapped = normalizePassed(payload?.items || []);
      }

      setTabsState((prev) => {
        const previousItems = paginate ? prev[tabKey].items || [] : [];
        return {
          ...prev,
          [tabKey]: {
            ...prev[tabKey],
            items: dedupeByKey([...previousItems, ...mapped]),
            isLoading: false,
            isRefreshing: false,
            isPaginating: false,
            error: '',
            nextCursor: payload?.nextCursor || null,
            hasMore: Boolean(payload?.hasMore),
          },
        };
      });

      loadedAtRef.current[tabKey] = Date.now();
    } catch (error) {
      if (isAuthError(error)) {
        onAuthExpired?.();
        return;
      }

      patchTabState(tabKey, {
        isLoading: false,
        isRefreshing: false,
        isPaginating: false,
        error: safeText(error?.message, 'Unable to load this tab.'),
      });
    }
  }, [onAuthExpired, patchTabState, withToken]);

  useEffect(() => {
    void registerTokenIfAvailable();
    void loadTabData({ tabKey: TAB_INVITATIONS, force: true });
  }, [loadTabData, registerTokenIfAvailable]);

  useEffect(() => {
    void loadTabData({ tabKey: activeTab });
  }, [activeTab, loadTabData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current !== 'active';
      appStateRef.current = nextState;

      if (nextState === 'active' && wasBackground) {
        void loadTabData({ tabKey: activeTab, force: true });
      }
    });

    return () => subscription.remove();
  }, [activeTab, loadTabData]);

  const handleInviteAction = useCallback(async (item, action) => {
    if (!item?.inviteId) {
      return false;
    }

    const rollbackItems = tabsStateRef.current[TAB_INVITATIONS]?.items || [];

    setActionError('');
    patchTabState(TAB_INVITATIONS, {
      items: rollbackItems.filter((row) => row.key !== item.key),
    });

    try {
      await withToken((token) => mutateInvite({
        firebaseToken: token,
        inviteId: item.inviteId,
        action,
        requestId: createRequestId(),
      }));

      if (action === 'decline') {
        setTabsState((prev) => {
          const passedState = prev[TAB_PASSED] || createTabState();
          const passedItem = mapInviteItemToPassed(item);

          return {
            ...prev,
            [TAB_PASSED]: {
              ...passedState,
              items: dedupeByKey([passedItem, ...(passedState.items || [])]),
            },
          };
        });
      }

      return true;
    } catch (error) {
      if (isAuthError(error)) {
        onAuthExpired?.();
        return false;
      }

      patchTabState(TAB_INVITATIONS, { items: rollbackItems });
      setActionError(getActionErrorMessage(error, `Failed to ${action} invite.`));
      return false;
    }
  }, [onAuthExpired, patchTabState, withToken]);

  const onInviteCardPress = useCallback((item) => {
    setSelectedProfile(item || null);

    if (activeTab === TAB_INVITATIONS) {
      void withToken(async (token) => {
        if (!item?.inviteId || item?.readAt) {
          return;
        }

        try {
          await mutateInvite({
            firebaseToken: token,
            inviteId: item.inviteId,
            action: 'mark_read',
            requestId: createRequestId(),
          });

          patchTabState(TAB_INVITATIONS, {
            items: (tabsStateRef.current[TAB_INVITATIONS]?.items || []).map((row) => (
              row.key === item.key ? { ...row, readAt: new Date().toISOString() } : row
            )),
          });
        } catch (error) {
          if (isAuthError(error)) {
            onAuthExpired?.();
            return;
          }

          setActionError(getActionErrorMessage(error, 'Could not mark invite as read.'));
        }
      });
    }
  }, [activeTab, onAuthExpired, patchTabState, withToken]);

  const runCandidateAction = useCallback(async (item, action) => {
    if (!item?.candidateId) {
      Alert.alert('Action unavailable', 'Profile action is not available for this item.');
      return;
    }

    setIsDetailActionLoading(true);
    setActionError('');

    try {
      await withToken((token) => postMatchAction({
        firebaseToken: token,
        candidateId: item.candidateId,
        action,
        requestId: createRequestId(),
      }));
      setSelectedProfile(null);
    } catch (error) {
      if (isAuthError(error)) {
        onAuthExpired?.();
        return;
      }
      setActionError(getActionErrorMessage(error, `Could not ${action} this profile.`));
    } finally {
      setIsDetailActionLoading(false);
    }
  }, [onAuthExpired, withToken]);

  const handleDetailPass = useCallback(async () => {
    if (!selectedProfile) {
      return;
    }

    if (activeTab === TAB_INVITATIONS) {
      const success = await handleInviteAction(selectedProfile, 'decline');
      if (success) {
        showSnackbar(`You have declined ${selectedProfile.displayName}'s invitation`);
        setSelectedProfile(null);
      }
      return;
    }

    await runCandidateAction(selectedProfile, 'pass');
  }, [activeTab, handleInviteAction, runCandidateAction, selectedProfile, showSnackbar]);

  const handleDetailSave = useCallback(async () => {
    if (!selectedProfile) {
      return;
    }

    if (activeTab === TAB_SENT && selectedProfile?.status === 'pending' && selectedProfile?.inviteId) {
      const rollbackItems = tabsStateRef.current[TAB_SENT]?.items || [];
      patchTabState(TAB_SENT, {
        items: rollbackItems.map((row) => (
          row.key === selectedProfile.key ? { ...row, status: 'withdrawn' } : row
        )),
      });

      setIsDetailActionLoading(true);

      try {
        await withToken((token) => withdrawSentInvite({
          firebaseToken: token,
          inviteId: selectedProfile.inviteId,
          requestId: createRequestId(),
        }));
        setSelectedProfile(null);
      } catch (error) {
        if (isAuthError(error)) {
          onAuthExpired?.();
          return;
        }
        patchTabState(TAB_SENT, { items: rollbackItems });
        setActionError(getActionErrorMessage(error, 'Could not withdraw invite.'));
      } finally {
        setIsDetailActionLoading(false);
      }
      return;
    }

    await runCandidateAction(selectedProfile, 'save');
  }, [activeTab, onAuthExpired, patchTabState, runCandidateAction, selectedProfile, withToken]);

  const handleDetailLike = useCallback(async () => {
    if (!selectedProfile) {
      return;
    }

    if (activeTab === TAB_INVITATIONS) {
      const success = await handleInviteAction(selectedProfile, 'accept');
      if (success) {
        showSnackbar(`You have accepted ${selectedProfile.displayName}'s invitation`);
        setSelectedProfile(null);
      }
      return;
    }

    await runCandidateAction(selectedProfile, 'like');
  }, [activeTab, handleInviteAction, runCandidateAction, selectedProfile, showSnackbar]);

  const activeTabState = tabsState[activeTab] || createTabState();

  const onRefresh = useCallback(() => {
    void loadTabData({ tabKey: activeTab, refresh: true, force: true });
  }, [activeTab, loadTabData]);

  const onEndReached = useCallback(() => {
    void loadTabData({ tabKey: activeTab, paginate: true });
  }, [activeTab, loadTabData]);

  const navItems = useMemo(() => [
    { key: 'invites', label: 'Invites', icon: require('../assets/invites-active.png'), active: true },
    { key: 'sync', label: 'Sync', icon: require('../assets/sync-inactive.png'), active: false },
    { key: 'chat', label: 'Chat', icon: require('../assets/chat-inactive.png'), active: false },
    { key: 'profile', label: 'Profile', icon: require('../assets/profile-inactive.png'), active: false },
  ], []);

  const shouldShowDetailActions = selectedProfile && activeTab !== TAB_SENT;
  const shouldShowSaveAction = activeTab !== TAB_INVITATIONS && activeTab !== TAB_PASSED;

  if (selectedProfile) {
    const topMessage = getTopMessageForTab(activeTab, selectedProfile);
    const hasExperienceSection = selectedProfile.linkedinExperiences.length > 0 || selectedProfile.experienceSummary || selectedProfile.title;
    const ideaText = safeText(selectedProfile.startupIdea || selectedProfile.messagePreview, 'No additional details shared yet.');
    const linkedinUrl = safeText(selectedProfile.linkedinUrl);
    const founderIntentText = /build\s*a\s*team/i.test(selectedProfile.intentBadge)
      ? 'Looking to Build A Team'
      : safeText(selectedProfile.intentBadge, 'Looking for a cofounder to join existing idea');
    const commitmentText = normalizeCommitmentText(selectedProfile.timeCommitment);
    const ageText = deriveAgeText(selectedProfile);
    const hasEducationSection = Array.isArray(selectedProfile.educationEntries) && selectedProfile.educationEntries.length > 0;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.detailHeaderRow}>
          <Pressable style={styles.detailBackButton} onPress={() => setSelectedProfile(null)}>
            <Image source={require('../assets/back_arrow.png')} style={styles.detailBackIcon} />
          </Pressable>
          <Text style={styles.detailHeaderTitle} numberOfLines={1}>{selectedProfile.displayName}</Text>
          <View style={styles.detailHeaderSpacer} />
        </View>

        {!!actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailMessageBubble}>
            {activeTab === TAB_INVITATIONS ? (
              <>
                <View style={styles.detailMessageHeaderRow}>
                  <Image source={require('../assets/invites-inbox.png')} style={styles.detailMessageHeaderIcon} />
                  <Text style={styles.detailMessageHeading}>
                    {`${selectedProfile.displayName} has sent you an invitation`}
                  </Text>
                </View>
                <Text style={styles.detailMessageBodyText}>{topMessage}</Text>
              </>
            ) : (
              <Text style={styles.detailMessageText}>{topMessage}</Text>
            )}
          </View>

          <View style={styles.detailHeroWrap}>
            <View style={styles.detailHeroTopRow}>
              <View style={styles.profileRow}>
                <View style={styles.avatarWrap}>
                  {selectedProfile.photoUrl ? (
                    <Image source={{ uri: selectedProfile.photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <Image source={require('../assets/cofounders.jpg')} style={styles.avatarImage} />
                  )}
                </View>

                <View style={styles.profileTextWrap}>
                  <Text style={styles.profileName} numberOfLines={1}>{selectedProfile.displayName}</Text>
                  <View style={styles.locationRow}>
                    <Image source={require('../assets/user.png')} style={styles.locationIcon} />
                    <Text style={styles.profileLocation} numberOfLines={1}>{selectedProfile.locationText}</Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Image source={require('../assets/teamwork.png')} style={styles.locationIcon} />
                    <Text style={styles.profileLocation} numberOfLines={1}>{safeText(selectedProfile.userRole || selectedProfile.role, 'Open to remote work')}</Text>
                  </View>
                </View>
              </View>

              {!!linkedinUrl && (
                <Pressable
                  style={styles.linkedinButton}
                  onPress={() => {
                    const resolvedUrl = /^https?:\/\//i.test(linkedinUrl) ? linkedinUrl : `https://${linkedinUrl}`;
                    void Linking.openURL(resolvedUrl).catch(() => {
                      Alert.alert('Unable to open', 'Could not open LinkedIn profile right now.');
                    });
                  }}
                >
                  <Image source={require('../assets/linkedin.png')} style={styles.linkedinIcon} />
                </Pressable>
              )}
            </View>

            <View style={styles.heroIntentBadge}>
              <Text style={styles.heroIntentText}>{safeText(selectedProfile.intentBadge, 'Seeking cofounder')}</Text>
            </View>

            {!!selectedProfile.bio && <Text style={styles.heroBioText}>{selectedProfile.bio}</Text>}
          </View>

          <View style={styles.detailIdeaCard}>
            <Text style={styles.detailIdeaTitle}>My idea</Text>
            <Text style={styles.detailIdeaBody}>{ideaText}</Text>
          </View>

          <View style={styles.detailFounderCard}>
            <Text style={styles.detailSectionTitle}>As a founder, I am...</Text>

            <View style={styles.founderRow}>
              <Image source={require('../assets/search.png')} style={styles.detailIcon} />
              <Text style={styles.detailText}>{founderIntentText}</Text>
            </View>
            <View style={styles.founderDivider} />

            {!!commitmentText && (
              <>
                <View style={styles.founderRow}>
                  <Image source={require('../assets/teamwork.png')} style={styles.detailIcon} />
                  <Text style={styles.detailText}>{commitmentText}</Text>
                </View>
                <View style={styles.founderDivider} />
              </>
            )}

            <View style={styles.founderRow}>
              <Image source={require('../assets/internship.png')} style={styles.detailIcon} />
              <Text style={styles.detailText}>{selectedProfile.roleTagsText}</Text>
            </View>
            <View style={styles.founderDivider} />

            {!!ageText && (
              <View style={styles.founderRow}>
                <Image source={require('../assets/user.png')} style={styles.detailIcon} />
                <Text style={styles.detailText}>{ageText}</Text>
              </View>
            )}
          </View>

          {selectedProfile.industries.length > 0 && (
            <View style={styles.detailBadgeSection}>
              <Text style={styles.detailSectionTitle}>Industries & interests</Text>
              <View style={styles.badgesWrap}>
                {selectedProfile.industries.map((industry) => (
                  <View key={`ind-${selectedProfile.key}-${industry}`} style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>{industry}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {selectedProfile.startupExperiences.length > 0 && (
            <View style={styles.detailBadgeSection}>
              <Text style={styles.detailSectionTitle}>Startup experience</Text>
              <View style={styles.badgesWrap}>
                {selectedProfile.startupExperiences.map((entry) => (
                  <View key={`startup-${selectedProfile.key}-${entry}`} style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>{entry}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {selectedProfile.workPreferences.length > 0 && (
            <View style={styles.detailBadgeSection}>
              <Text style={styles.detailSectionTitle}>Work Preferences</Text>
              <View style={styles.badgesWrap}>
                {selectedProfile.workPreferences.map((entry) => (
                  <View key={`work-${selectedProfile.key}-${entry}`} style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>{entry}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!!selectedProfile.motivation && (
            <View style={styles.detailSectionCard}>
              <Text style={styles.detailSectionTitle}>My motivation to build a startup</Text>
              <Text style={styles.detailSectionBody}>{selectedProfile.motivation}</Text>
            </View>
          )}

          {!!selectedProfile.superpower && (
            <View style={styles.detailSectionCard}>
              <Text style={styles.detailSectionTitle}>My strength / superpower</Text>
              <Text style={styles.detailSectionBody}>{selectedProfile.superpower}</Text>
            </View>
          )}

          {hasExperienceSection && (
            <View style={styles.detailSectionCard}>
              <Text style={styles.detailSectionTitle}>Experiences</Text>
              {selectedProfile.linkedinExperiences.length > 0 ? (
                selectedProfile.linkedinExperiences.map((experience, index) => (
                  <View
                    key={`${experience?.company || 'company'}-${experience?.title || 'title'}-${index}`}
                    style={[
                      styles.experienceListItem,
                      index < selectedProfile.linkedinExperiences.length - 1 && styles.experienceListItemBorder,
                    ]}
                  >
                    <Image source={require('../assets/briefcase.png')} style={styles.experienceCardIcon} />
                    <View style={styles.experienceCardBody}>
                      {!!safeText(experience?.title) && <Text style={styles.expTitle}>{safeText(experience?.title)}</Text>}
                      {!!safeText(experience?.company) && <Text style={styles.expCompany}>{safeText(experience?.company)}</Text>}
                      {!!safeText(experience?.duration) && <Text style={styles.expMeta}>{safeText(experience?.duration)}</Text>}
                      {!!safeText(experience?.description) && <Text style={styles.expDescription} numberOfLines={3}>{safeText(experience?.description)}</Text>}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.detailSectionBody}>{selectedProfile.experienceSummary || selectedProfile.title}</Text>
              )}
            </View>
          )}

          {hasEducationSection && (
            <View style={styles.detailSectionCard}>
              <Text style={styles.detailSectionTitle}>Education</Text>
              {selectedProfile.educationEntries.map((education, index) => {
                const school = safeText(education?.school || education?.school_name || education?.institution);
                const degree = safeText(education?.degree_name || education?.degree);
                const field = safeText(education?.field_of_study || education?.field || education?.major);
                const dateRange = safeText(
                  education?.date_range
                    || education?.duration
                    || education?.dates
                    || [
                      [education?.start_month, education?.start_year].filter(Boolean).join(' '),
                      [education?.end_month, education?.end_year].filter(Boolean).join(' '),
                    ].filter(Boolean).join(' - ')
                    || [education?.start_year, education?.end_year].filter(Boolean).join(' - '),
                );

                return (
                  <View
                    key={`${school || 'school'}-${degree || 'degree'}-${index}`}
                    style={[
                      styles.experienceListItem,
                      index < selectedProfile.educationEntries.length - 1 && styles.experienceListItemBorder,
                    ]}
                  >
                    <Image source={require('../assets/graduation.png')} style={styles.educationIcon} />
                    <View style={styles.experienceCardBody}>
                      {!!school && <Text style={styles.expTitle}>{school}</Text>}
                      {!!degree && <Text style={styles.expCompany}>{degree}</Text>}
                      {!!field && <Text style={styles.expDescription}>{field}</Text>}
                      {!!dateRange && <Text style={styles.expMeta}>{dateRange}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {!!selectedProfile.passionAbout && (
            <View style={styles.detailSectionCard}>
              <Text style={styles.detailSectionTitle}>I'm passionate about</Text>
              <Text style={styles.detailSectionBody}>{selectedProfile.passionAbout}</Text>
            </View>
          )}

          <View style={styles.detailBottomSpacer} />
        </ScrollView>

        {shouldShowDetailActions ? (
          <View style={styles.detailActionRow}>
            <Pressable style={styles.detailActionButton} onPress={() => { void handleDetailPass(); }} disabled={isDetailActionLoading}>
              <Image source={require('../assets/pass.png')} style={styles.detailActionIcon} />
            </Pressable>

            {shouldShowSaveAction ? (
              <Pressable style={styles.detailActionButton} onPress={() => { void handleDetailSave(); }} disabled={isDetailActionLoading}>
                <Image source={require('../assets/save.png')} style={styles.detailActionIcon} />
              </Pressable>
            ) : null}

            <Pressable style={styles.detailActionButton} onPress={() => { void handleDetailLike(); }} disabled={isDetailActionLoading}>
              <Image source={require('../assets/heart.png')} style={styles.detailActionIcon} />
            </Pressable>
          </View>
        ) : null}

        {!!snackbarMessage && (
          <View style={styles.snackbarWrap}>
            <Text style={styles.snackbarText}>{snackbarMessage}</Text>
          </View>
        )}

        <View style={styles.bottomTabBar}>
          {navItems.map((item) => (
            <Pressable key={item.key} style={styles.navItem} onPress={() => onNavigate?.(item.key)}>
              <Image source={item.icon} style={styles.navIcon} />
              <Text style={item.active ? styles.navTextActive : styles.navText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Invites</Text>

      <InvitesTabHeader tabs={TABS} activeTab={activeTab} onTabPress={setActiveTab} styles={styles} />

      {!!actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}

      <View style={styles.bodyWrap}>
        {activeTabState.isLoading && activeTabState.items.length === 0 ? (
          <InvitesLoadingSkeleton styles={styles} />
        ) : activeTabState.error && activeTabState.items.length === 0 ? (
          <InvitesErrorState
            styles={styles}
            message={activeTabState.error}
            onRetry={() => loadTabData({ tabKey: activeTab, refresh: true, force: true })}
          />
        ) : activeTabState.items.length === 0 ? (
          <InvitesEmptyState
            tabKey={activeTab}
            styles={styles}
            onRetry={() => loadTabData({ tabKey: activeTab, refresh: true, force: true })}
          />
        ) : (
          <FlatList
            data={activeTabState.items}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <InviteListCard item={item} tabKey={activeTab} styles={styles} onPress={onInviteCardPress} />
            )}
            contentContainerStyle={styles.listContentWrap}
            showsVerticalScrollIndicator={false}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={activeTabState.isRefreshing}
                onRefresh={onRefresh}
                tintColor="#2cbfcd"
                colors={['#2cbfcd']}
              />
            }
            ListFooterComponent={
              activeTabState.isPaginating ? (
                <View style={styles.paginationLoaderWrap}>
                  <ActivityIndicator size="small" color="#2cbfcd" />
                </View>
              ) : null
            }
          />
        )}
      </View>

      {!!snackbarMessage && (
        <View style={styles.snackbarWrap}>
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </View>
      )}

      <View style={styles.bottomTabBar}>
        {navItems.map((item) => (
          <Pressable key={item.key} style={styles.navItem} onPress={() => onNavigate?.(item.key)}>
            <Image source={item.icon} style={styles.navIcon} />
            <Text style={item.active ? styles.navTextActive : styles.navText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }, insets = {}) {
  const isNarrowScreen = width < 370;
  const isShortScreen = height < 760;
  const topInset = insets?.top || 0;
  const bottomInset = insets?.bottom || 0;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#dfddd5',
      paddingTop: topInset + vh(isShortScreen ? 1.2 : 2.2),
      paddingBottom: moderateScale(92) + bottomInset,
      paddingHorizontal: vw(5),
    },
    pageTitle: {
      color: '#111111',
      fontSize: responsiveFont(38, 30, 44),
      lineHeight: responsiveFont(42, 34, 48),
      fontWeight: '700',
      marginLeft: vw(3.4),
      marginBottom: vh(3.4),
    },
    tabsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 0,
      marginBottom: vh(0.8),
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      minHeight: moderateScale(34),
      justifyContent: 'flex-end',
      paddingBottom: moderateScale(7),
      paddingHorizontal: moderateScale(2),
    },
    tabText: {
      color: '#111111',
      fontSize: responsiveFont(18, 15, 20),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '600',
      includeFontPadding: false,
    },
    tabTextActive: {
      color: '#2cbfcd',
    },
    tabUnderline: {
      marginTop: moderateScale(8),
      width: '88%',
      height: moderateScale(4),
      backgroundColor: 'transparent',
      borderRadius: moderateScale(4),
    },
    tabUnderlineActive: {
      backgroundColor: '#2cbfcd',
    },
    actionErrorText: {
      marginBottom: vh(0.6),
      color: '#a75454',
      fontSize: responsiveFont(13, 11, 14),
      lineHeight: responsiveFont(17, 15, 18),
      fontWeight: '400',
    },
    detailHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: moderateScale(8),
      paddingHorizontal: moderateScale(6),
    },
    detailBackButton: {
      width: moderateScale(36),
      height: moderateScale(36),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: moderateScale(6),
    },
    detailBackIcon: {
      width: moderateScale(22),
      height: moderateScale(22),
      resizeMode: 'contain',
      tintColor: '#7f8696',
    },
    detailHeaderTitle: {
      flex: 1,
      color: '#111111',
      fontSize: responsiveFont(28, 22, 32),
      lineHeight: responsiveFont(34, 27, 38),
      fontWeight: '700',
    },
    detailHeaderSpacer: {
      width: moderateScale(42),
    },
    detailScroll: {
      flex: 1,
    },
    detailScrollContent: {
      paddingBottom: moderateScale(118) + bottomInset,
    },
    detailMessageBubble: {
      borderRadius: moderateScale(18),
      backgroundColor: '#cbcbcd',
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(12),
      marginHorizontal: moderateScale(12),
      marginBottom: moderateScale(14),
    },
    detailMessageText: {
      color: '#111111',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(21, 17, 23),
      fontWeight: '500',
    },
    detailMessageHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: moderateScale(10),
    },
    detailMessageHeaderIcon: {
      width: moderateScale(20),
      height: moderateScale(20),
      resizeMode: 'contain',
      marginRight: moderateScale(10),
    },
    detailMessageHeading: {
      flex: 1,
      color: '#111111',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(23, 19, 24),
      fontWeight: '700',
    },
    detailMessageBodyText: {
      color: '#111111',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(23, 19, 24),
      fontWeight: '400',
    },
    detailHeroWrap: {
      marginHorizontal: moderateScale(12),
      marginBottom: moderateScale(10),
    },
    detailHeroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    linkedinButton: {
      marginLeft: moderateScale(10),
      marginTop: moderateScale(6),
      width: moderateScale(30),
      height: moderateScale(30),
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkedinIcon: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    locationRow: {
      marginTop: moderateScale(2),
      flexDirection: 'row',
      alignItems: 'center',
    },
    locationIcon: {
      width: moderateScale(12),
      height: moderateScale(12),
      resizeMode: 'contain',
      marginRight: moderateScale(6),
      tintColor: '#555555',
    },
    heroIntentBadge: {
      marginTop: moderateScale(10),
      alignSelf: 'flex-start',
      borderRadius: moderateScale(9),
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(5),
      backgroundColor: '#7f8da8',
    },
    heroIntentText: {
      color: '#ffffff',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '500',
    },
    heroBioText: {
      marginTop: moderateScale(8),
      color: '#111111',
      fontSize: responsiveFont(20, 16, 22),
      lineHeight: responsiveFont(29, 23, 32),
      fontWeight: '700',
    },
    detailIdeaCard: {
      borderRadius: moderateScale(24),
      backgroundColor: '#f1f1f1',
      padding: moderateScale(16),
      marginHorizontal: moderateScale(12),
      marginTop: moderateScale(8),
    },
    detailFounderCard: {
      borderRadius: moderateScale(24),
      backgroundColor: '#f1f1f1',
      padding: moderateScale(16),
      marginHorizontal: moderateScale(12),
      marginTop: moderateScale(8),
    },
    founderRow: {
      marginTop: moderateScale(9),
      flexDirection: 'row',
      alignItems: 'center',
    },
    founderDivider: {
      marginTop: moderateScale(10),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#a8a8a8',
    },
    detailBadgeSection: {
      marginHorizontal: moderateScale(12),
      marginTop: moderateScale(14),
    },
    badgesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(10),
    },
    primaryBadge: {
      borderRadius: 999,
      backgroundColor: '#1098b6',
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(8),
    },
    primaryBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '500',
    },
    detailSectionCard: {
      borderRadius: moderateScale(24),
      backgroundColor: '#f1f1f1',
      padding: moderateScale(16),
      marginHorizontal: moderateScale(12),
      marginTop: moderateScale(8),
    },
    detailSectionTitle: {
      color: '#111111',
      fontSize: responsiveFont(21, 17, 23),
      lineHeight: responsiveFont(28, 22, 30),
      fontWeight: '700',
      marginBottom: moderateScale(8),
    },
    detailSectionBody: {
      color: '#1a1a1a',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(23, 19, 25),
      fontWeight: '400',
    },
    detailIdeaTitle: {
      color: '#111111',
      fontSize: responsiveFont(21, 17, 23),
      lineHeight: responsiveFont(28, 22, 30),
      fontWeight: '700',
      marginBottom: moderateScale(8),
    },
    detailIdeaBody: {
      color: '#1a1a1a',
      fontSize: responsiveFont(17, 15, 19),
      lineHeight: responsiveFont(24, 20, 26),
      fontWeight: '400',
    },
    detailActionRow: {
      position: 'absolute',
      left: vw(10),
      right: vw(10),
      bottom: moderateScale(86) + bottomInset,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 5,
    },
    detailActionButton: {
      width: moderateScale(64),
      height: moderateScale(64),
      borderRadius: 999,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    detailActionIcon: {
      width: moderateScale(36),
      height: moderateScale(36),
      resizeMode: 'contain',
    },
    snackbarWrap: {
      position: 'absolute',
      left: vw(6),
      right: vw(6),
      bottom: moderateScale(158) + bottomInset,
      borderRadius: moderateScale(12),
      backgroundColor: '#1f1f1f',
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(12),
      zIndex: 6,
      elevation: 6,
    },
    snackbarText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '500',
      textAlign: 'center',
    },
    bodyWrap: {
      flex: 1,
      marginTop: vh(1.2),
    },
    listContentWrap: {
      paddingTop: moderateScale(10),
      paddingHorizontal: moderateScale(8),
      paddingBottom: vh(2.6),
      gap: moderateScale(10),
    },
    cardWrap: {
      borderRadius: moderateScale(24),
      backgroundColor: '#f1f1f1',
      padding: moderateScale(14),
      marginHorizontal: moderateScale(6),
      marginVertical: moderateScale(3),
    },
    cardTopBubble: {
      borderRadius: moderateScale(12),
      backgroundColor: '#cbcbcd',
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
    },
    cardTopText: {
      color: '#111111',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(20, 16, 22),
      fontWeight: '500',
    },
    cardTopTextMuted: {
      color: '#9c9c9c',
      fontWeight: '400',
    },
    cardDivider: {
      marginTop: moderateScale(10),
      marginBottom: moderateScale(10),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#bebebe',
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatarWrap: {
      width: moderateScale(isNarrowScreen ? 52 : 58),
      height: moderateScale(isNarrowScreen ? 52 : 58),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      backgroundColor: '#d1d1d1',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    profileTextWrap: {
      marginLeft: moderateScale(10),
      flex: 1,
    },
    profileName: {
      color: '#111111',
      fontSize: responsiveFont(22, 17, 24),
      lineHeight: responsiveFont(28, 22, 30),
      fontWeight: '700',
    },
    profileLocation: {
      color: '#626981',
      fontStyle: 'italic',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(20, 17, 21),
      fontWeight: '400',
    },
    detailRow: {
      marginTop: moderateScale(9),
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailIcon: {
      width: moderateScale(18),
      height: moderateScale(18),
      resizeMode: 'contain',
      tintColor: '#2a2a2a',
      marginRight: moderateScale(8),
    },
    detailText: {
      flex: 1,
      color: '#1d1d1d',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(24, 20, 25),
      fontWeight: '400',
    },
    experienceListItem: {
      marginTop: moderateScale(10),
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingBottom: moderateScale(12),
    },
    experienceListItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#d5d5d5',
      marginBottom: moderateScale(2),
    },
    experienceCardIcon: {
      width: moderateScale(44),
      height: moderateScale(44),
      resizeMode: 'contain',
      marginRight: moderateScale(10),
    },
    educationIcon: {
      width: moderateScale(44),
      height: moderateScale(44),
      resizeMode: 'contain',
      marginRight: moderateScale(10),
    },
    experienceCardBody: {
      flex: 1,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(8),
    },
    skillChip: {
      borderRadius: 999,
      backgroundColor: '#ffffff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#d4d4d4',
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
    },
    skillChipText: {
      color: '#242424',
      fontSize: responsiveFont(13, 11, 14),
      lineHeight: responsiveFont(17, 14, 18),
      fontWeight: '500',
    },
    expItem: {
      paddingVertical: moderateScale(8),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#d4d4d4',
    },
    expTitle: {
      color: '#111111',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(21, 17, 22),
      fontWeight: '600',
    },
    expCompany: {
      color: '#2e2e2e',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '500',
      marginTop: moderateScale(2),
    },
    expMeta: {
      color: '#5e5e5e',
      fontSize: responsiveFont(13, 11, 14),
      lineHeight: responsiveFont(18, 15, 19),
      fontWeight: '400',
      marginTop: moderateScale(2),
    },
    expDescription: {
      color: '#272727',
      fontSize: responsiveFont(13, 11, 14),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '400',
      marginTop: moderateScale(4),
    },
    detailBottomSpacer: {
      height: moderateScale(16),
    },
    stateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(8),
    },
    stateText: {
      color: '#4f4f4f',
      textAlign: 'center',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '400',
    },
    stateErrorText: {
      color: '#565656',
      textAlign: 'center',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '400',
    },
    stateButton: {
      marginTop: moderateScale(14),
      borderRadius: 999,
      backgroundColor: '#2cbfcd',
      minHeight: moderateScale(42),
      paddingHorizontal: moderateScale(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stateButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '600',
    },
    skeletonCard: {
      borderRadius: moderateScale(24),
      backgroundColor: '#f0f0f0',
      padding: moderateScale(12),
      marginBottom: moderateScale(16),
    },
    skeletonTop: {
      height: moderateScale(48),
      borderRadius: moderateScale(12),
      backgroundColor: '#d4d4d4',
    },
    skeletonDivider: {
      marginTop: moderateScale(10),
      marginBottom: moderateScale(10),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#c0c0c0',
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    skeletonAvatar: {
      width: moderateScale(58),
      height: moderateScale(58),
      borderRadius: moderateScale(12),
      backgroundColor: '#d4d4d4',
    },
    skeletonLinesWrap: {
      marginLeft: moderateScale(10),
      flex: 1,
    },
    skeletonLineLarge: {
      width: '56%',
      height: moderateScale(18),
      borderRadius: moderateScale(8),
      backgroundColor: '#d4d4d4',
    },
    skeletonLineMedium: {
      marginTop: moderateScale(7),
      width: '72%',
      height: moderateScale(16),
      borderRadius: moderateScale(8),
      backgroundColor: '#d4d4d4',
    },
    skeletonLineSmall: {
      marginTop: moderateScale(9),
      height: moderateScale(16),
      borderRadius: moderateScale(8),
      backgroundColor: '#d4d4d4',
    },
    skeletonLineShort: {
      marginTop: moderateScale(9),
      width: '80%',
      height: moderateScale(16),
      borderRadius: moderateScale(8),
      backgroundColor: '#d4d4d4',
    },
    paginationLoaderWrap: {
      paddingVertical: moderateScale(16),
      alignItems: 'center',
    },
    bottomTabBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: bottomInset + vh(0.6),
      minHeight: moderateScale(66),
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#e0e0e0',
      paddingTop: vh(0.8),
      paddingBottom: Math.min(bottomInset, moderateScale(6)) + vh(0.35),
      paddingHorizontal: vw(2),
      backgroundColor: '#ffffff',
      zIndex: 4,
      elevation: 4,
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIcon: {
      width: moderateScale(32),
      height: moderateScale(32),
      resizeMode: 'contain',
    },
    navText: {
      marginTop: vh(0.2),
      color: '#9e9e9e',
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '400',
    },
    navTextActive: {
      marginTop: vh(0.2),
      color: '#2eb8c6',
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '500',
    },
  }));
}
