import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Step Registry ────────────────────────────────────────────────────────────
// Add / remove steps here only. Order defines the wizard flow.
export const WIZARD_STEPS = [
  'profileName',
  'profileDob',
  'profileLocation',
  'profileLocationPreference',
  'profileMatchingPurpose',
  'profileUserRole',
  'profileCofounderRole',
  'profileUserSkills',
  'profileCofounderSkills',
  'profileBioDetails',
  'profileExperience',
  'profileLinkedin',
  'profilePhotoUpload',
  'profileEditPicture',
  'profileIndustries',
  // Future steps: 'profileRole', 'profileBio', 'profileSkills', etc.
];

const STORAGE_KEY = '@syncfound/profile_wizard';

// ─── Initial State ────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  stepIndex: 0,
  draft: {},
  isHydrated: false,
};

function sanitizeDraft(draft) {
  const nextDraft = { ...(draft || {}) };

  delete nextDraft.openToRemoteWork;
  delete nextDraft.remoteWorkPreference;
  delete nextDraft.willingToRelocate;

  return nextDraft;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
function wizardReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        stepIndex: action.payload.stepIndex ?? 0,
        draft: sanitizeDraft(action.payload.draft ?? {}),
        isHydrated: true,
      };

    case 'ADVANCE': {
      const nextDraft = sanitizeDraft({ ...state.draft, ...action.payload });
      const nextIndex = Math.min(state.stepIndex + 1, WIZARD_STEPS.length - 1);
      return { ...state, stepIndex: nextIndex, draft: nextDraft };
    }

    case 'BACK': {
      const prevIndex = Math.max(state.stepIndex - 1, 0);
      return { ...state, stepIndex: prevIndex };
    }

    case 'MERGE_DRAFT': {
      return {
        ...state,
        draft: sanitizeDraft({ ...state.draft, ...action.payload }),
      };
    }

    case 'RESET':
      return { ...INITIAL_STATE, isHydrated: true };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ProfileWizardContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ProfileWizardProvider({ children }) {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            dispatch({ type: 'HYDRATE', payload: saved });
          } catch {
            dispatch({ type: 'HYDRATE', payload: {} });
          }
        } else {
          dispatch({ type: 'HYDRATE', payload: {} });
        }
      })
      .catch(() => {
        dispatch({ type: 'HYDRATE', payload: {} });
      });
  }, []);

  // Persist to AsyncStorage whenever stepIndex or draft changes (after hydration)
  useEffect(() => {
    if (!state.isHydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepIndex: state.stepIndex, draft: state.draft }),
    ).catch(() => {});
  }, [state.stepIndex, state.draft, state.isHydrated]);

  const advance = useCallback((fields = {}) => {
    dispatch({ type: 'ADVANCE', payload: fields });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: 'BACK' });
  }, []);

  const mergeDraft = useCallback((fields = {}) => {
    dispatch({ type: 'MERGE_DRAFT', payload: fields });
  }, []);

  const reset = useCallback(() => {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    dispatch({ type: 'RESET' });
  }, []);

  const value = {
    draft: state.draft,
    stepIndex: state.stepIndex,
    currentStep: WIZARD_STEPS[state.stepIndex] ?? WIZARD_STEPS[0],
    totalSteps: WIZARD_STEPS.length,
    isHydrated: state.isHydrated,
    isLastStep: state.stepIndex === WIZARD_STEPS.length - 1,
    advance,
    back,
    mergeDraft,
    reset,
  };

  return (
    <ProfileWizardContext.Provider value={value}>
      {children}
    </ProfileWizardContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useProfileWizard() {
  const ctx = useContext(ProfileWizardContext);
  if (!ctx) {
    throw new Error('useProfileWizard must be used inside <ProfileWizardProvider>');
  }
  return ctx;
}
