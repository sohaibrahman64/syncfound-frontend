import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useProfileWizard } from '../context/ProfileWizardContext';
import { submitUserProfile } from '../utils/backendAuth';
import ProfileDobScreen from './ProfileDobScreen';
import ProfileBioDetailsScreen from './ProfileBioDetailsScreen';
import ProfileExperienceScreen from './ProfileExperienceScreen';
import ProfileCofounderSkillsScreen from './ProfileCofounderSkillsScreen';
import ProfileCofounderRoleScreen from './ProfileCofounderRoleScreen';
import ProfileLocationScreen from './ProfileLocationScreen';
import ProfileLocationPreferenceScreen from './ProfileLocationPreferenceScreen';
import ProfileLinkedinScreen from './ProfileLinkedinScreen';
import ProfileMatchingPurposeScreen from './ProfileMatchingPurposeScreen';
import ProfileNameScreen from './ProfileNameScreen';
import ProfileEditPictureScreen from './ProfileEditPictureScreen';
import ProfilePhotoUploadScreen from './ProfilePhotoUploadScreen';
import ProfileIndustriesScreen from './ProfileIndustriesScreen';
import ProfileUserRoleScreen from './ProfileUserRoleScreen';
import ProfileUserSkillsScreen from './ProfileUserSkillsScreen';

// Import future wizard step screens here as they are created:

/**
 * ProfileWizardScreen
 *
 * Acts as the router for the multi-step profile creation wizard.
 * Each step screen is driven by ProfileWizardContext — no individual
 * step screen needs to know the full wizard flow.
 *
 * Props:
 *   firebaseToken  — bearer token for the final API submission
 *   onBack         — called when the user backs out of step 0 (goes to cofoundersIntro)
 *   onComplete     — called after successful profile submission
 */
export default function ProfileWizardScreen({
  firebaseToken,
  backendUserId = null,
  selectedCountry,
  onBack,
  onComplete,
}) {
  const { currentStep, draft, advance, back, mergeDraft, stepIndex, isLastStep, isHydrated, reset } =
    useProfileWizard();

  if (!isHydrated) {
    // Wait for AsyncStorage hydration before rendering to avoid flash of wrong step
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f3f3' }}>
        <ActivityIndicator size="large" color="#31c6d5" />
      </View>
    );
  }

  // ── Helper: advance last step → submit ──────────────────────────────────────
  async function handleAdvance(fields) {
    if (isLastStep) {
      const fullProfile = { ...draft, ...fields };
      try {
        await submitUserProfile(fullProfile, firebaseToken);
        reset();      // clear persisted progress after successful submission
        onComplete?.();
      } catch (error) {
        // Surface error to individual step screen if needed via thrown error.
        // For now, rethrow so caller (step screen) can show UI feedback.
        throw error;
      }
    } else {
      advance(fields);
    }
  }

  // ── Step routing ────────────────────────────────────────────────────────────
  switch (currentStep) {
    case 'profileName':
      return (
        <ProfileNameScreen
          initialFirstName={draft.firstName ?? ''}
          initialLastName={draft.lastName ?? ''}
          onBack={stepIndex === 0 ? onBack : back}
          onContinue={({ firstName, lastName }) => handleAdvance({ firstName, lastName })}
        />
      );

    case 'profileDob':
      return (
        <ProfileDobScreen
          initialDob={draft.dateOfBirth ?? draft.dob ?? ''}
          onBack={back}
          onContinue={({ dateOfBirth, age }) => handleAdvance({ dateOfBirth, age })}
        />
      );

    case 'profileLocation':
      return (
        <ProfileLocationScreen
          initialState={draft.state ?? ''}
          initialCity={draft.city ?? ''}
          countryIso3={selectedCountry?.iso3 ?? ''}
          countryPhoneCode={selectedCountry?.phoneCode ?? String(selectedCountry?.dial || '').replace(/^\+/, '')}
          onBack={back}
          onContinue={({ state, city }) => handleAdvance({ state, city })}
        />
      );

    case 'profileLocationPreference':
      return (
        <ProfileLocationPreferenceScreen
          initialLocationPreference={draft.locationPreference ?? []}
          onBack={back}
          onContinue={({ locationPreference }) =>
            handleAdvance({ locationPreference })
          }
        />
      );

    case 'profileMatchingPurpose':
      return (
        <ProfileMatchingPurposeScreen
          initialMatchingPurpose={draft.matchingPurpose ?? ''}
          onBack={back}
          onContinue={({ matchingPurpose }) => handleAdvance({ matchingPurpose })}
        />
      );

    case 'profileUserRole':
      return (
        <ProfileUserRoleScreen
          initialUserRole={draft.userRole ?? ''}
          onBack={back}
          onContinue={({ userRole }) => handleAdvance({ userRole })}
        />
      );

    case 'profileCofounderRole':
      return (
        <ProfileCofounderRoleScreen
          initialCofounderRole={draft.cofounderRole ?? ''}
          onBack={back}
          onContinue={({ cofounderRole }) => handleAdvance({ cofounderRole })}
        />
      );

    case 'profileUserSkills':
      return (
        <ProfileUserSkillsScreen
          initialUserSkills={draft.userSkills ?? []}
          onBack={back}
          onContinue={({ userSkills }) => handleAdvance({ userSkills })}
        />
      );

    case 'profileCofounderSkills':
      return (
        <ProfileCofounderSkillsScreen
          initialCofounderSkills={draft.cofounderSkills ?? []}
          onBack={back}
          onContinue={({ cofounderSkills }) => handleAdvance({ cofounderSkills })}
        />
      );

    case 'profileBioDetails':
      return (
        <ProfileBioDetailsScreen
          initialTitle={draft.title ?? ''}
          initialPrimaryRole={draft.primaryRole ?? ''}
          initialSecondaryRole={draft.secondaryRole ?? ''}
          initialBio={draft.bio ?? ''}
          initialStartupIdea={draft.startupIdea ?? ''}
          initialFundingStage={draft.fundingStage ?? ''}
          initialTimeCommitment={draft.timeCommitment ?? ''}
          initialRiskAppetite={draft.riskAppetite ?? ''}
          onBack={back}
          onContinue={(fields) => handleAdvance(fields)}
        />
      );

    case 'profileExperience':
      return (
        <ProfileExperienceScreen
          initialEmploymentType={draft.employmentType ?? ''}
          initialCompanyName={draft.companyName ?? ''}
          initialLocation={draft.experienceLocation ?? ''}
          initialLocationType={draft.locationType ?? ''}
          initialStartDate={draft.startDate ?? ''}
          initialCurrentlyWorkHere={draft.currentlyWorkHere ?? false}
          initialEndDate={draft.endDate ?? ''}
          onBack={back}
          onContinue={(fields) => handleAdvance({
            employmentType: fields.employmentType,
            companyName: fields.companyName,
            experienceLocation: fields.location,
            locationType: fields.locationType,
            startDate: fields.startDate,
            currentlyWorkHere: fields.currentlyWorkHere,
            endDate: fields.endDate,
          })}
        />
      );

    case 'profileLinkedin':
      return (
        <ProfileLinkedinScreen
          backendUserId={backendUserId}
          firebaseToken={firebaseToken}
          initialLinkedinUsername={draft.linkedinUsername ?? ''}
          initialLinkedinUrl={draft.linkedinUrl ?? ''}
          initialLinkedinProfilePreview={draft.linkedinProfilePreview ?? null}
          onBack={back}
          onContinue={(fields) => handleAdvance(fields)}
        />
      );

    case 'profilePhotoUpload':
      return (
        <ProfilePhotoUploadScreen
          firebaseToken={firebaseToken}
          initialLinkedinProfilePictureUrl={draft.linkedinProfilePictureUrl ?? ''}
          initialProfileImageUri={draft.profileImageUri ?? ''}
          initialProfileImageSource={draft.profileImageSource ?? ''}
          initialProfileImageRotation={Number(draft.profileImageRotation ?? 0)}
          initialProfileImageScale={Number(draft.profileImageScale ?? 1)}
          initialProfileImageTranslateX={Number(draft.profileImageTranslateX ?? 0)}
          initialProfileImageTranslateY={Number(draft.profileImageTranslateY ?? 0)}
          initialProfileImageCropRect={draft.profileImageCropRect ?? null}
          onBack={back}
          onContinue={(fields) => {
            if (fields?.pendingProfileImageUri) {
              handleAdvance(fields);
              return;
            }

            handleAdvance(fields);
            advance({});
          }}
        />
      );

    case 'profileEditPicture':
      return (
        <ProfileEditPictureScreen
          initialImageUri={draft.pendingProfileImageUri || draft.profileImageUri || ''}
          initialImageSource={draft.pendingProfileImageSource || draft.profileImageSource || ''}
          initialRotation={Number(draft.profileImageRotation ?? 0)}
          initialScale={Number(draft.profileImageScale ?? 1)}
          initialTranslateX={Number(draft.profileImageTranslateX ?? 0)}
          initialTranslateY={Number(draft.profileImageTranslateY ?? 0)}
          initialCropRect={draft.profileImageCropRect ?? null}
          onBack={back}
          onContinue={(fields) => {
            mergeDraft(fields);
            back();
          }}
        />
      );

    case 'profileIndustries':
      return (
        <ProfileIndustriesScreen
          firebaseToken={firebaseToken}
          initialIndustries={draft.industries ?? []}
          onBack={() => {
            back();
            back();
          }}
          onContinue={({ industries }) => handleAdvance({ industries })}
        />
      );

    // Add more cases as new screens are built

    default:
      return null;
  }
}
