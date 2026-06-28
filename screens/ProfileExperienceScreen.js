import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';
import { BASE_URL } from '../utils/Constants';

function buildEndpoint(path) {
  const normalizedBase = String(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL || '').replace(/\/$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function toEmploymentTypeModel(item) {
  const label = String(
    item?.employment_type_name || item?.employment_type || item?.name || item?.label || '',
  ).trim();
  const parsedId = Number(item?.id);
  return {
    value: Number.isFinite(parsedId) ? parsedId : null,
    label,
    description: String(item?.description || '').trim(),
  };
}

function toLocationTypeModel(item) {
  const label = String(
    item?.location_type_name || item?.location_type || item?.name || item?.label || '',
  ).trim();
  const parsedId = Number(item?.id);
  return {
    value: Number.isFinite(parsedId) ? parsedId : null,
    label,
    description: String(item?.description || '').trim(),
  };
}

function formatDateLabel(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatMonthInputValue(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseMonthInputValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return new Date(year, monthIndex, 1);
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

            {loading ? (
              <Text style={styles.modalStatus}>Loading options...</Text>
            ) : null}
            {!loading && errorMessage ? (
              <Text style={styles.modalError}>{errorMessage}</Text>
            ) : null}

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

export default function ProfileExperienceScreen({
  onBack,
  onContinue,
  initialEmploymentType = '',
  initialCompanyName = '',
  initialLocation = '',
  initialLocationType = '',
  initialStartDate = '',
  initialCurrentlyWorkHere = false,
  initialEndDate = '',
}) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(metrics, insets), [metrics, insets.top, insets.bottom]);

  const [employmentType, setEmploymentType] = useState(null);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [location, setLocation] = useState(initialLocation);
  const [locationType, setLocationType] = useState(null);
  const [startDate, setStartDate] = useState(
    initialStartDate ? new Date(initialStartDate) : null,
  );
  const [currentlyWorkHere, setCurrentlyWorkHere] = useState(initialCurrentlyWorkHere);
  const [endDate, setEndDate] = useState(
    initialEndDate ? new Date(initialEndDate) : null,
  );
  const [webStartDateInput, setWebStartDateInput] = useState(() =>
    formatMonthInputValue(initialStartDate ? new Date(initialStartDate) : null),
  );
  const [webEndDateInput, setWebEndDateInput] = useState(() =>
    formatMonthInputValue(initialEndDate ? new Date(initialEndDate) : null),
  );

  const [isCompanyNameFocused, setIsCompanyNameFocused] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [openDropdown, setOpenDropdown] = useState('');

  // Android date picker state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  // iOS modal date picker state
  const [iosStartPickerOpen, setIosStartPickerOpen] = useState(false);
  const [iosEndPickerOpen, setIosEndPickerOpen] = useState(false);
  const [iosTempDate, setIosTempDate] = useState(null);
  const [iosPickerTarget, setIosPickerTarget] = useState('');

  const [employmentTypeOptions, setEmploymentTypeOptions] = useState([]);
  const [loadingEmploymentTypes, setLoadingEmploymentTypes] = useState(true);
  const [employmentTypeError, setEmploymentTypeError] = useState('');
  const [locationTypeOptions, setLocationTypeOptions] = useState([]);
  const [loadingLocationTypes, setLoadingLocationTypes] = useState(true);
  const [locationTypeError, setLocationTypeError] = useState('');

  const canContinue = Boolean(
    employmentType !== null
      && companyName.trim()
      && location.trim()
      && locationType !== null
      && startDate !== null
      && (currentlyWorkHere || endDate !== null),
  );

  // ── Fetch employment types ─────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function fetchEmploymentTypes() {
      try {
        setLoadingEmploymentTypes(true);
        setEmploymentTypeError('');

        const response = await fetch(buildEndpoint('/employment-types'), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to load employment types: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mapped = list
          .map(toEmploymentTypeModel)
          .filter((item) => item.value !== null && Boolean(item.label));

        if (!isMounted) return;

        setEmploymentTypeOptions(mapped);

        if (initialEmploymentType) {
          const match = mapped.find(
            (o) =>
              String(o.value) === String(initialEmploymentType) ||
              o.label === initialEmploymentType,
          );
          if (match) setEmploymentType(match.value);
        }
      } catch {
        if (!isMounted) return;
        setEmploymentTypeError('Could not load employment types. Please try again.');
      } finally {
        if (!isMounted) return;
        setLoadingEmploymentTypes(false);
      }
    }

    fetchEmploymentTypes();
    return () => {
      isMounted = false;
    };
  }, [initialEmploymentType]);

  useEffect(() => {
    let isMounted = true;

    async function fetchLocationTypes() {
      try {
        setLoadingLocationTypes(true);
        setLocationTypeError('');

        const response = await fetch(buildEndpoint('/location-types'), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to load location types: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.location_types)
              ? payload.location_types
              : Array.isArray(payload?.locationTypes)
                ? payload.locationTypes
                : [];

        const mapped = list
          .map(toLocationTypeModel)
          .filter((item) => item.value !== null && Boolean(item.label));

        if (!isMounted) return;

        setLocationTypeOptions(mapped);

        if (initialLocationType) {
          const match = mapped.find(
            (o) =>
              String(o.value) === String(initialLocationType) ||
              o.label === initialLocationType,
          );
          if (match) setLocationType(match.value);
        }
      } catch {
        if (!isMounted) return;
        setLocationTypeError('Could not load location types. Please try again.');
      } finally {
        if (!isMounted) return;
        setLoadingLocationTypes(false);
      }
    }

    fetchLocationTypes();
    return () => {
      isMounted = false;
    };
  }, [initialLocationType]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getEmploymentTypeLabel() {
    if (employmentType === null) return '';
    return employmentTypeOptions.find((o) => o.value === employmentType)?.label ?? '';
  }

  function getLocationTypeLabel() {
    if (locationType === null) return '';
    return locationTypeOptions.find((o) => o.value === locationType)?.label ?? '';
  }

  // ── Date picker handlers ───────────────────────────────────────────────────
  function openStartDatePicker() {
    if (Platform.OS === 'web') return;
    setOpenDropdown('');
    if (Platform.OS === 'ios') {
      setIosTempDate(startDate ?? new Date());
      setIosPickerTarget('start');
      setIosStartPickerOpen(true);
    } else {
      setShowStartPicker(true);
    }
  }

  function openEndDatePicker() {
    if (currentlyWorkHere) return;
    if (Platform.OS === 'web') return;
    setOpenDropdown('');
    if (Platform.OS === 'ios') {
      setIosTempDate(endDate ?? new Date());
      setIosPickerTarget('end');
      setIosEndPickerOpen(true);
    } else {
      setShowEndPicker(true);
    }
  }

  function handleAndroidStartDateChange(_event, selectedDate) {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      if (endDate && selectedDate > endDate) {
        setEndDate(null);
      }
    }
  }

  function handleAndroidEndDateChange(_event, selectedDate) {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  }

  function handleIosConfirm() {
    if (iosPickerTarget === 'start') {
      setStartDate(iosTempDate);
      if (endDate && iosTempDate > endDate) setEndDate(null);
      setIosStartPickerOpen(false);
    } else {
      setEndDate(iosTempDate);
      setIosEndPickerOpen(false);
    }
  }

  function handleIosCancel() {
    setIosStartPickerOpen(false);
    setIosEndPickerOpen(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <Text style={styles.heading}>More about experience</Text>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Employment Type */}
          <ModalPickerField
            label="Employment Type"
            value={getEmploymentTypeLabel()}
            isOpen={openDropdown === 'employmentType'}
            onToggle={() =>
              setOpenDropdown((prev) => (prev === 'employmentType' ? '' : 'employmentType'))
            }
            onClear={() => setOpenDropdown('')}
            onSelect={(option) => {
              setEmploymentType(option.value);
              setOpenDropdown('');
            }}
            styles={styles}
            loading={loadingEmploymentTypes}
            errorMessage={employmentTypeError}
            options={employmentTypeOptions}
            modalTitle="Select Employment Type"
          />

          {/* Company Name */}
          <TextInput
            style={[styles.input, isCompanyNameFocused && styles.inputFocused]}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Company Name"
            placeholderTextColor="#a2a2a2"
            autoCapitalize="words"
            autoCorrect={false}
            onFocus={() => {
              setOpenDropdown('');
              setIsCompanyNameFocused(true);
            }}
            onBlur={() => setIsCompanyNameFocused(false)}
          />

          {/* Location */}
          <TextInput
            style={[styles.input, isLocationFocused && styles.inputFocused]}
            value={location}
            onChangeText={setLocation}
            placeholder="Location"
            placeholderTextColor="#a2a2a2"
            autoCapitalize="words"
            autoCorrect={false}
            onFocus={() => {
              setOpenDropdown('');
              setIsLocationFocused(true);
            }}
            onBlur={() => setIsLocationFocused(false)}
          />

          {/* Location Type */}
          <ModalPickerField
            label="Location Type"
            value={getLocationTypeLabel()}
            isOpen={openDropdown === 'locationType'}
            onToggle={() =>
              setOpenDropdown((prev) => (prev === 'locationType' ? '' : 'locationType'))
            }
            onClear={() => setOpenDropdown('')}
            onSelect={(option) => {
              setLocationType(option.value);
              setOpenDropdown('');
            }}
            styles={styles}
            loading={loadingLocationTypes}
            errorMessage={locationTypeError}
            options={locationTypeOptions}
            modalTitle="Select Location Type"
          />

          {/* Start Date */}
          {Platform.OS === 'web' ? (
            <View style={styles.dateWebFieldWrap}>
              <Text style={styles.dateWebLabel}>Start Date</Text>
              <TextInput
                style={[styles.input, styles.webDateInput]}
                value={webStartDateInput}
                placeholder="YYYY-MM"
                placeholderTextColor="#a2a2a2"
                onChangeText={(value) => {
                  setWebStartDateInput(value);
                  const parsed = parseMonthInputValue(value);
                  setStartDate(parsed);
                  if (parsed && endDate && parsed > endDate) {
                    setEndDate(null);
                    setWebEndDateInput('');
                  }
                }}
                autoCorrect={false}
                autoCapitalize="none"
                type="month"
              />
            </View>
          ) : (
            <Pressable style={styles.dateTrigger} onPress={openStartDatePicker}>
              <Text style={[styles.dateText, !startDate && styles.placeholderText]}>
                {startDate ? formatDateLabel(startDate) : 'Start Date'}
              </Text>
              <Text style={styles.calendarIcon}>{'\uD83D\uDCC5'}</Text>
            </Pressable>
          )}

          {/* Currently work here checkbox */}
          <Pressable
            style={styles.checkboxRow}
            onPress={() => {
              setCurrentlyWorkHere((prev) => !prev);
              if (!currentlyWorkHere) {
                setEndDate(null);
                setWebEndDateInput('');
              }
            }}
          >
            <View style={[styles.checkbox, currentlyWorkHere && styles.checkboxChecked]}>
              {currentlyWorkHere ? <View style={styles.checkboxInner} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>I currently work here</Text>
          </Pressable>

          {/* End Date */}
          {Platform.OS === 'web' ? (
            <View style={[styles.dateWebFieldWrap, currentlyWorkHere && styles.dateTriggerDisabled]}>
              <Text style={[styles.dateWebLabel, currentlyWorkHere && styles.dateTextDisabled]}>End Date</Text>
              <TextInput
                style={[styles.input, styles.webDateInput, currentlyWorkHere && styles.webDateInputDisabled]}
                value={webEndDateInput}
                placeholder="YYYY-MM"
                placeholderTextColor="#a2a2a2"
                onChangeText={(value) => {
                  setWebEndDateInput(value);
                  const parsed = parseMonthInputValue(value);
                  setEndDate(parsed);
                }}
                autoCorrect={false}
                autoCapitalize="none"
                type="month"
                editable={!currentlyWorkHere}
              />
            </View>
          ) : (
            <Pressable
              style={[styles.dateTrigger, currentlyWorkHere && styles.dateTriggerDisabled]}
              onPress={openEndDatePicker}
            >
              <Text
                style={[
                  styles.dateText,
                  (!endDate || currentlyWorkHere) && styles.placeholderText,
                  currentlyWorkHere && styles.dateTextDisabled,
                ]}
              >
                {endDate && !currentlyWorkHere ? formatDateLabel(endDate) : 'End Date'}
              </Text>
              <Text style={[styles.calendarIcon, currentlyWorkHere && styles.calendarIconDisabled]}>{'\uD83D\uDCC5'}</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Android native date pickers */}
        {showStartPicker ? (
          <DateTimePicker
            value={startDate ?? new Date()}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={handleAndroidStartDateChange}
          />
        ) : null}

        {showEndPicker ? (
          <DateTimePicker
            value={endDate ?? new Date()}
            mode="date"
            display="default"
            minimumDate={startDate ?? undefined}
            maximumDate={new Date()}
            onChange={handleAndroidEndDateChange}
          />
        ) : null}

        {/* iOS date picker modal — Start Date */}
        {Platform.OS === 'ios' ? (
          <Modal visible={iosStartPickerOpen} transparent animationType="fade">
            <Pressable style={styles.modalBackdrop} onPress={handleIosCancel}>
              <Pressable style={styles.iosDateModalCard} onPress={() => {}}>
                <Text style={styles.modalTitle}>Start Date</Text>
                <DateTimePicker
                  value={iosTempDate ?? new Date()}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_e, d) => { if (d) setIosTempDate(d); }}
                  style={styles.iosDatePicker}
                />
                <View style={styles.iosDateActions}>
                  <Pressable onPress={handleIosCancel} style={styles.iosDateCancelBtn}>
                    <Text style={styles.iosDateCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleIosConfirm} style={styles.iosDateConfirmBtn}>
                    <Text style={styles.iosDateConfirmText}>Confirm</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}

        {/* iOS date picker modal — End Date */}
        {Platform.OS === 'ios' ? (
          <Modal visible={iosEndPickerOpen} transparent animationType="fade">
            <Pressable style={styles.modalBackdrop} onPress={handleIosCancel}>
              <Pressable style={styles.iosDateModalCard} onPress={() => {}}>
                <Text style={styles.modalTitle}>End Date</Text>
                <DateTimePicker
                  value={iosTempDate ?? new Date()}
                  mode="date"
                  display="spinner"
                  minimumDate={startDate ?? undefined}
                  maximumDate={new Date()}
                  onChange={(_e, d) => { if (d) setIosTempDate(d); }}
                  style={styles.iosDatePicker}
                />
                <View style={styles.iosDateActions}>
                  <Pressable onPress={handleIosCancel} style={styles.iosDateCancelBtn}>
                    <Text style={styles.iosDateCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleIosConfirm} style={styles.iosDateConfirmBtn}>
                    <Text style={styles.iosDateConfirmText}>Confirm</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => {
            onContinue?.({
              employmentType,
              companyName: companyName.trim(),
              location: location.trim(),
              locationType,
              startDate: startDate?.toISOString() ?? '',
              currentlyWorkHere,
              endDate: currentlyWorkHere ? '' : (endDate?.toISOString() ?? ''),
            });
          }}
        >
          <Text
            style={[
              styles.continueButtonText,
              !canContinue && styles.continueButtonTextDisabled,
            ]}
          >
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
      paddingTop: topInset + (isShortScreen ? vh(1.8) : vh(2.4)),
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
    // Date picker row
    dateTrigger: {
      minHeight: moderateScale(44),
      borderBottomWidth: 2,
      borderBottomColor: '#c8c8c8',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: vw(0.4),
      paddingVertical: vh(0.9),
      marginBottom: vh(3.3),
    },
    dateTriggerDisabled: {
      opacity: 0.45,
    },
    dateWebFieldWrap: {
      marginBottom: vh(3.3),
    },
    dateWebLabel: {
      color: '#8a8a8a',
      fontSize: responsiveFont(isShortScreen ? 14 : 15, 12, 16),
      lineHeight: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      marginBottom: vh(0.6),
      fontWeight: '500',
    },
    webDateInput: {
      marginBottom: 0,
      paddingVertical: vh(0.9),
    },
    webDateInputDisabled: {
      color: '#a2a2a2',
    },
    dateText: {
      color: '#242424',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 21, 29),
      fontWeight: '400',
    },
    dateTextDisabled: {
      color: '#a2a2a2',
    },
    calendarIcon: {
      fontSize: moderateScale(22),
      color: '#31c6d5',
    },
    calendarIconDisabled: {
      color: '#c8c8c8',
    },
    // Checkbox
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: vh(3.3),
      paddingHorizontal: vw(0.4),
    },
    checkbox: {
      width: moderateScale(22),
      height: moderateScale(22),
      borderWidth: 2,
      borderColor: '#31c6d5',
      borderRadius: moderateScale(4),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: vw(3),
      backgroundColor: '#ffffff',
    },
    checkboxChecked: {
      backgroundColor: '#31c6d5',
    },
    checkboxInner: {
      width: moderateScale(10),
      height: moderateScale(10),
      backgroundColor: '#ffffff',
      borderRadius: moderateScale(2),
    },
    checkboxLabel: {
      color: '#242424',
      fontSize: responsiveFont(isShortScreen ? 16 : 18, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 22 : 24, 19, 26),
      fontWeight: '400',
    },
    // iOS modal date picker
    iosDateModalCard: {
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
    iosDatePicker: {
      width: '100%',
    },
    iosDateActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: vh(1.2),
      gap: vw(4),
    },
    iosDateCancelBtn: {
      paddingVertical: vh(0.8),
      paddingHorizontal: vw(3),
    },
    iosDateCancelText: {
      color: '#707070',
      fontSize: responsiveFont(16, 14, 18),
      fontWeight: '500',
    },
    iosDateConfirmBtn: {
      paddingVertical: vh(0.8),
      paddingHorizontal: vw(3),
    },
    iosDateConfirmText: {
      color: '#31c6d5',
      fontSize: responsiveFont(16, 14, 18),
      fontWeight: '700',
    },
    // Continue button
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
