import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';
import { BASE_URL } from '../utils/Constants';

const FIELD_CONFIG = {
  primaryRole: {
    label: 'Primary Role',
    endpoint: '/primary-roles',
    responseKey: 'primary_role_name',
  },
  secondaryRole: {
    label: 'Secondary Role',
    endpoint: '/secondary-roles',
    responseKey: 'secondary_role_name',
  },
  fundingStage: {
    label: 'Funding Stage',
    endpoint: '/funding-stages',
    responseKey: 'funding_stage_name',
  },
  timeCommitment: {
    label: 'Time Commitment',
    endpoint: '/time-commitments',
    responseKey: 'time_commitment_name',
  },
  riskAppetite: {
    label: 'Risk Appetite',
    endpoint: '/risk-appetites',
    responseKey: 'risk_appetite_name',
  },
};

function buildEndpoint(path) {
  const normalizedBase = String(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL || '').replace(/\/$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function toOptionModel(item, responseKey) {
  const label = String(item?.[responseKey] || item?.label || item?.name || '').trim();
  const parsedId = Number(item?.id);

  return {
    value: Number.isFinite(parsedId) ? parsedId : null,
    label,
    description: String(item?.description || '').trim(),
  };
}

function ModalPickerField({
  label,
  value,
  isOpen,
  onToggle,
  onClear,
  styles,
  loading,
  errorMessage,
  options,
  modalTitle,
  onSelect,
}) {
  return (
    <View style={styles.fieldGroup}>
      <Pressable
        style={[styles.dropdownTrigger, isOpen && styles.inputFocused]}
        onPress={onToggle}
      >
        <Text style={[styles.dropdownValueText, !value && styles.placeholderText]}>
          {value || label}
        </Text>
        <Text style={styles.dropdownChevron}>{isOpen ? '▲' : '▼'}</Text>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClear}>
        <Pressable style={styles.modalBackdrop} onPress={onClear}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>

            {loading ? <Text style={styles.modalStatus}>Loading options...</Text> : null}
            {!loading && errorMessage ? <Text style={styles.modalError}>{errorMessage}</Text> : null}

            {!loading && !errorMessage ? (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {options.map((option) => (
                  <Pressable
                    key={String(option.value)}
                    style={styles.modalItem}
                    onPress={() => onSelect(option)}
                  >
                    <Text style={styles.modalItemText}>{option.label}</Text>
                    {option.description ? (
                      <Text style={styles.modalItemDescription}>{option.description}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function ProfileBioDetailsScreen({
  onBack,
  onContinue,
  initialTitle = '',
  initialPrimaryRole = '',
  initialSecondaryRole = '',
  initialBio = '',
  initialStartupIdea = '',
  initialFundingStage = '',
  initialTimeCommitment = '',
  initialRiskAppetite = '',
}) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(metrics, insets), [metrics, insets.top, insets.bottom]);

  const [title, setTitle] = useState(initialTitle);
  const [primaryRole, setPrimaryRole] = useState(null);
  const [secondaryRole, setSecondaryRole] = useState(null);
  const [bio, setBio] = useState(initialBio);
  const [startupIdea, setStartupIdea] = useState(initialStartupIdea);
  const [fundingStage, setFundingStage] = useState(null);
  const [timeCommitment, setTimeCommitment] = useState(null);
  const [riskAppetite, setRiskAppetite] = useState(null);

  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isBioFocused, setIsBioFocused] = useState(false);
  const [isStartupIdeaFocused, setIsStartupIdeaFocused] = useState(false);
  const [openDropdown, setOpenDropdown] = useState('');
  const [optionsByField, setOptionsByField] = useState({
    primaryRole: [],
    secondaryRole: [],
    fundingStage: [],
    timeCommitment: [],
    riskAppetite: [],
  });
  const [loadingByField, setLoadingByField] = useState({
    primaryRole: true,
    secondaryRole: true,
    fundingStage: true,
    timeCommitment: true,
    riskAppetite: true,
  });
  const [errorByField, setErrorByField] = useState({
    primaryRole: '',
    secondaryRole: '',
    fundingStage: '',
    timeCommitment: '',
    riskAppetite: '',
  });

  const canContinue = Boolean(
    title.trim()
      && primaryRole !== null
      && bio.trim()
      && startupIdea.trim()
      && fundingStage !== null
      && timeCommitment !== null
      && riskAppetite !== null,
  );

  function getSelectedLabel(fieldKey, selectedValue) {
    if (selectedValue === null || selectedValue === undefined || selectedValue === '') {
      return '';
    }

    const option = optionsByField[fieldKey]?.find(
      (item) => String(item.value) === String(selectedValue),
    );
    return option?.label || '';
  }

  useEffect(() => {
    let isMounted = true;

    async function fetchFieldOptions(fieldKey) {
      const config = FIELD_CONFIG[fieldKey];
      if (!config) return;

      try {
        setLoadingByField((current) => ({ ...current, [fieldKey]: true }));
        setErrorByField((current) => ({ ...current, [fieldKey]: '' }));

        const response = await fetch(buildEndpoint(config.endpoint), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to load ${config.label.toLowerCase()}: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mapped = list
          .map((item) => toOptionModel(item, config.responseKey))
          .filter((item) => item.value !== null && Boolean(item.label));

        if (!isMounted) return;

        setOptionsByField((current) => ({ ...current, [fieldKey]: mapped }));

        const initialValue =
          fieldKey === 'primaryRole' ? initialPrimaryRole
            : fieldKey === 'secondaryRole' ? initialSecondaryRole
              : fieldKey === 'fundingStage' ? initialFundingStage
                : fieldKey === 'timeCommitment' ? initialTimeCommitment
                  : initialRiskAppetite;

        if (initialValue) {
          const matchedOption = mapped.find(
            (option) => String(option.value) === String(initialValue)
              || option.label === initialValue,
          );
          if (matchedOption) {
            if (fieldKey === 'primaryRole') setPrimaryRole(matchedOption.value);
            if (fieldKey === 'secondaryRole') setSecondaryRole(matchedOption.value);
            if (fieldKey === 'fundingStage') setFundingStage(matchedOption.value);
            if (fieldKey === 'timeCommitment') setTimeCommitment(matchedOption.value);
            if (fieldKey === 'riskAppetite') setRiskAppetite(matchedOption.value);
          }
        }
      } catch {
        if (!isMounted) return;
        setErrorByField((current) => ({
          ...current,
          [fieldKey]: `Could not load ${config.label.toLowerCase()}. Please try again.`,
        }));
      } finally {
        if (!isMounted) return;
        setLoadingByField((current) => ({ ...current, [fieldKey]: false }));
      }
    }

    Object.keys(FIELD_CONFIG).forEach((fieldKey) => {
      fetchFieldOptions(fieldKey);
    });

    return () => {
      isMounted = false;
    };
  }, [initialFundingStage, initialPrimaryRole, initialRiskAppetite, initialSecondaryRole, initialTimeCommitment]);

  function handlePrimaryRoleSelect(nextRole) {
    setPrimaryRole(nextRole.value);
    if (secondaryRole === nextRole.value) {
      setSecondaryRole(null);
    }
    setOpenDropdown('');
  }

  function handleSecondaryRoleSelect(nextRole) {
    setSecondaryRole(nextRole.value);
    setOpenDropdown('');
  }

  function handleFundingStageSelect(nextFundingStage) {
    setFundingStage(nextFundingStage.value);
    setOpenDropdown('');
  }

  function handleTimeCommitmentSelect(nextTimeCommitment) {
    setTimeCommitment(nextTimeCommitment.value);
    setOpenDropdown('');
  }

  function handleRiskAppetiteSelect(nextRiskAppetite) {
    setRiskAppetite(nextRiskAppetite.value);
    setOpenDropdown('');
  }

  const secondaryRoleOptions = optionsByField.secondaryRole.filter((option) => option.value !== primaryRole);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <Text style={styles.heading}>More About Yourself</Text>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={[styles.input, isTitleFocused && styles.inputFocused]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#a2a2a2"
            autoCapitalize="words"
            autoCorrect={false}
            onFocus={() => {
              setOpenDropdown('');
              setIsTitleFocused(true);
            }}
            onBlur={() => setIsTitleFocused(false)}
          />

          <ModalPickerField
            label="Primary Role"
            value={getSelectedLabel('primaryRole', primaryRole)}
            isOpen={openDropdown === 'primaryRole'}
            onToggle={() => setOpenDropdown((prev) => (prev === 'primaryRole' ? '' : 'primaryRole'))}
            onClear={() => setOpenDropdown('')}
            onSelect={handlePrimaryRoleSelect}
            styles={styles}
            loading={loadingByField.primaryRole}
            errorMessage={errorByField.primaryRole}
            options={optionsByField.primaryRole}
            modalTitle="Select Primary Role"
          />

          <ModalPickerField
            label="Secondary Role (Optional)"
            value={getSelectedLabel('secondaryRole', secondaryRole)}
            isOpen={openDropdown === 'secondaryRole'}
            onToggle={() => setOpenDropdown((prev) => (prev === 'secondaryRole' ? '' : 'secondaryRole'))}
            onClear={() => setOpenDropdown('')}
            onSelect={handleSecondaryRoleSelect}
            styles={styles}
            loading={loadingByField.secondaryRole}
            errorMessage={errorByField.secondaryRole}
            options={secondaryRoleOptions}
            modalTitle="Select Secondary Role"
          />

          <TextInput
            style={[
              styles.input,
              styles.bioInput,
              isBioFocused && styles.inputFocused,
            ]}
            value={bio}
            onChangeText={setBio}
            placeholder="Bio"
            placeholderTextColor="#a2a2a2"
            autoCapitalize="sentences"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
            maxLength={400}
            onFocus={() => {
              setOpenDropdown('');
              setIsBioFocused(true);
            }}
            onBlur={() => setIsBioFocused(false)}
          />

          <TextInput
            style={[
              styles.input,
              styles.longInput,
              isStartupIdeaFocused && styles.inputFocused,
            ]}
            value={startupIdea}
            onChangeText={setStartupIdea}
            placeholder="Startup Idea"
            placeholderTextColor="#a2a2a2"
            autoCapitalize="sentences"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
            onFocus={() => {
              setOpenDropdown('');
              setIsStartupIdeaFocused(true);
            }}
            onBlur={() => setIsStartupIdeaFocused(false)}
          />

          <ModalPickerField
            label="Funding Stage"
            value={getSelectedLabel('fundingStage', fundingStage)}
            isOpen={openDropdown === 'fundingStage'}
            onToggle={() => setOpenDropdown((prev) => (prev === 'fundingStage' ? '' : 'fundingStage'))}
            onClear={() => setOpenDropdown('')}
            onSelect={handleFundingStageSelect}
            styles={styles}
            loading={loadingByField.fundingStage}
            errorMessage={errorByField.fundingStage}
            options={optionsByField.fundingStage}
            modalTitle="Select Funding Stage"
          />

          <ModalPickerField
            label="Time Commitment"
            value={getSelectedLabel('timeCommitment', timeCommitment)}
            isOpen={openDropdown === 'timeCommitment'}
            onToggle={() => setOpenDropdown((prev) => (prev === 'timeCommitment' ? '' : 'timeCommitment'))}
            onClear={() => setOpenDropdown('')}
            onSelect={handleTimeCommitmentSelect}
            styles={styles}
            loading={loadingByField.timeCommitment}
            errorMessage={errorByField.timeCommitment}
            options={optionsByField.timeCommitment}
            modalTitle="Select Time Commitment"
          />

          <ModalPickerField
            label="Risk Appetite"
            value={getSelectedLabel('riskAppetite', riskAppetite)}
            isOpen={openDropdown === 'riskAppetite'}
            onToggle={() => setOpenDropdown((prev) => (prev === 'riskAppetite' ? '' : 'riskAppetite'))}
            onClear={() => setOpenDropdown('')}
            onSelect={handleRiskAppetiteSelect}
            styles={styles}
            loading={loadingByField.riskAppetite}
            errorMessage={errorByField.riskAppetite}
            options={optionsByField.riskAppetite}
            modalTitle="Select Risk Appetite"
          />
        </ScrollView>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => {
            onContinue?.({
              title: title.trim(),
              primaryRole,
              secondaryRole,
              bio: bio.trim(),
              startupIdea: startupIdea.trim(),
              fundingStage,
              timeCommitment,
              riskAppetite,
            });
          }}
        >
          <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }, insets = {}) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;
  const topInset = insets?.top || 0;
  const bottomInset = insets?.bottom || 0;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#f3f3f3',
    },
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: vw(80),
      height: vh(1.2),
      backgroundColor: '#26c6d0',
      zIndex: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(5),
      paddingTop: topInset + (isShortScreen ? vh(1.4) : vh(2)),
      paddingBottom: vh(3.2),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: isShortScreen ? vh(2.8) : vh(3.5),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      height: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      resizeMode: 'contain',
      tintColor: '#7d8498',
    },
    heading: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      marginBottom: vh(2.8),
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: vh(1.4),
    },
    fieldGroup: {
      marginBottom: vh(3.3),
    },
    input: {
      borderBottomWidth: 2,
      borderBottomColor: '#c8c8c8',
      color: '#242424',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 21, 29),
      fontWeight: '400',
      paddingHorizontal: vw(0.4),
      paddingVertical: vh(1.05),
      marginBottom: vh(3.3),
    },
    inputFocused: {
      borderBottomColor: '#31b8c1',
    },
    dropdownTrigger: {
      minHeight: moderateScale(44),
      borderBottomWidth: 2,
      borderBottomColor: '#c8c8c8',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: vw(0.4),
      paddingVertical: vh(0.9),
    },
    dropdownValueText: {
      color: '#242424',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 21, 29),
      fontWeight: '400',
    },
    placeholderText: {
      color: '#a2a2a2',
    },
    dropdownChevron: {
      color: '#9b9b9b',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 22 : 24, 18, 26),
      fontWeight: '600',
      marginRight: vw(1.5),
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.34)',
      justifyContent: 'center',
      paddingHorizontal: vw(6),
    },
    modalCard: {
      maxHeight: vh(62),
      borderRadius: moderateScale(22),
      backgroundColor: '#ffffff',
      paddingHorizontal: vw(5),
      paddingTop: vh(2.4),
      paddingBottom: vh(2),
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 24,
      elevation: 10,
    },
    modalTitle: {
      color: '#101010',
      fontSize: responsiveFont(20, 18, 24),
      lineHeight: responsiveFont(26, 22, 30),
      fontWeight: '700',
      marginBottom: vh(1.4),
    },
    modalStatus: {
      color: '#6b7280',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      marginBottom: vh(0.8),
    },
    modalError: {
      color: '#c44f4f',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      marginBottom: vh(0.8),
    },
    modalList: {
      maxHeight: vh(44),
    },
    modalItem: {
      paddingVertical: vh(1.2),
      borderBottomWidth: 1,
      borderBottomColor: '#ececec',
    },
    modalItemText: {
      color: '#1f1f1f',
      fontSize: responsiveFont(17, 15, 20),
      lineHeight: responsiveFont(22, 18, 25),
      fontWeight: '600',
    },
    modalItemDescription: {
      color: '#707070',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(19, 16, 22),
      marginTop: vh(0.35),
    },
    bioInput: {
      minHeight: moderateScale(isShortScreen ? 110 : 128),
      marginBottom: vh(1),
    },
    longInput: {
      minHeight: moderateScale(isShortScreen ? 86 : 96),
      marginTop: vh(0.4),
    },
    continueButton: {
      width: isNarrowScreen ? '84%' : '80%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginTop: vh(1.1),
      marginBottom: bottomInset + vh(0.6),
    },
    continueButtonDisabled: {
      backgroundColor: '#cdcdcf',
    },
    continueButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
      textAlign: 'center',
    },
    continueButtonTextDisabled: {
      color: '#707c96',
    },
  }));
}