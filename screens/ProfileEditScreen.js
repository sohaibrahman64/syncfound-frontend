import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useResponsiveMetrics } from "../utils/responsive";
import {
  getIndustries,
  getMyProfileIndustries as getUserProfileSelectedIndustries,
  getMyProfileLinkedinDetails,
  getUserSkills,
  getUserProfileSelectedSkills,
  getPrompts,
} from "../utils/backendAuth";
import { apiFetch } from "../utils/apiClient";
import { withPlatformFontStyles } from "../utils/typography";
import CityPickerScreen from "./CityPickerScreen";
import CompensationEditScreen from "./CompensationEditScreen";
import CompanySizeProfileEditScreen, {
  COMPANY_SIZE_FIELDS,
  normalizeCompanySizeSelections,
} from "./CompanySizeProfileEditScreen";
import { getCompanySizeSelectionLabel } from "./CompanySizeInterestLevelPicker";
import WorkAuthorizationEditScreen, {
  getWorkAuthorizationLabel,
} from "./WorkAuthorizationEditScreen";
import ProfileEditPictureScreen from "./ProfileEditPictureScreen";
import ProfilePhotoUploadScreen from "./ProfilePhotoUploadScreen";
import ProfilePreview from "../components/profile/ProfilePreview";

const PROMPT_SLOTS = ["prompt-1", "prompt-2", "prompt-3"];
const MAX_INDUSTRY_SELECTION = 5;
const MAX_SKILLS_SELECTION = 5;
const PRIOR_STARTUP_EXPERIENCE_OPTIONS = [
  "Sold a startup",
  "Founded/cofounded a company",
  "Worked in a startup",
  "No prior startup experience",
];

const BACKGROUND_ROWS = [
  { title: "Matching Goal*", value: "Have some ideas but open to exploring" },
  {
    title: "Commitment Level*",
    value: "Ready to go full-time with the right co-founder",
  },
  { title: "Number of Founders", value: "Not selected", muted: true },
  { title: "Skills & Expertise*", value: "", muted: true },
  { title: "Equity Split", value: "Not Selected", muted: true },
];

const TALENT_BACKGROUND_ROWS = [
  {
    title: "Job Search Profile*",
    value: "Actively job seeking. Full-time or part-time roles",
  },
  {
    title: "Bio & Experience*",
    value: "Full-Stack Engineer, 5 years exp",
  },
  {
    title: "Compensation*",
    value: "Interested in some equity. Ideally above(Min: USD 250,000)",
  },
  {
    title: "Company Size",
    value: "Open to size: Mid-size (51-200)",
  },
  {
    title: "Work Authorization*",
    value:
      "I am authorized to work in the US but will require sponsorship in the future",
  },
];

const JOB_SEARCH_STATUS_OPTIONS = [
  "Actively job seeking",
  "Passively job seeking",
  "Not currently open for hire",
];
const JOB_SEARCH_WORK_TYPES = ["Full Time", "Part Time", "Internship"];
const BIO_EXPERIENCE_PICKER_FIELDS = {
  fundingStage: {
    label: "Funding Stage",
    endpoint: "/funding-stages",
    responseKey: "funding_stage_name",
  },
  riskAppetite: {
    label: "Risk Appetite",
    endpoint: "/risk-appetites",
    responseKey: "risk_appetite_name",
  },
  employmentType: {
    label: "Employment Type",
    endpoint: "/employment-types",
    responseKey: "employment_type_name",
  },
  locationType: {
    label: "Location Type",
    endpoint: "/location-types",
    responseKey: "location_type_name",
  },
  primaryRole: {
    label: "Primary Role",
    endpoint: "/primary-roles",
    responseKey: "primary_role_name",
  },
  secondaryRole: {
    label: "Secondary Role (Optional)",
    endpoint: "/secondary-roles",
    responseKey: "secondary_role_name",
  },
};

function toBioExperienceOption(item, responseKey) {
  const label = String(
    item?.[responseKey] ||
      item?.employment_type_name ||
      item?.location_type_name ||
      item?.primary_role_name ||
      item?.secondary_role_name ||
      item?.funding_stage_name ||
      item?.risk_appetite_name ||
      item?.label ||
      item?.name ||
      "",
  ).trim();
  const parsedId = Number(item?.id);

  return {
    value: Number.isFinite(parsedId) ? parsedId : label,
    label,
    description: String(item?.description || "").trim(),
  };
}

function parseBioExperienceDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBioExperienceDate(value) {
  const date = parseBioExperienceDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getBioExperienceDateValue(value) {
  return parseBioExperienceDate(value) || new Date();
}

const ABOUT_ROWS = [
  { title: "Industries & Interests", value: "Not Selected", muted: true },
  { title: "Prior Startup Experience", value: "Not Selected", muted: true },
];

function DetailRow({ title, value, muted, styles, onPress }) {
  const Row = onPress ? Pressable : View;
  return (
    <Row
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? title.replace("*", "") : undefined}
      onPress={onPress}
      style={styles.detailRow}
    >
      <View style={styles.detailCopy}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text
          style={[styles.detailValue, muted && styles.mutedValue]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Row>
  );
}

function calculateProfileAge(dateOfBirth) {
  const date = new Date(`${String(dateOfBirth).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function normalizeProfileDateOfBirth(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.slice(0, 10);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function ProfileEditorHeader({ title, onBack, onDone, styles }) {
  return (
    <View style={styles.headlineEditorHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        onPress={onBack}
        style={styles.headerAction}
      >
        <Image
          source={require("../assets/back_arrow.png")}
          style={styles.headlineBackIcon}
          resizeMode="contain"
        />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onDone}
        style={styles.profileFieldDone}
      >
        <Text style={styles.saveText}>Done</Text>
      </Pressable>
    </View>
  );
}

function NameProfileEditScreen({
  initialFirstName,
  initialLastName,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);

  return (
    <View style={styles.screen}>
      <ProfileEditorHeader
        title="Name"
        onBack={() => onDone(firstName.trim(), lastName.trim())}
        onDone={() => onDone(firstName.trim(), lastName.trim())}
        styles={styles}
      />
      <View style={styles.profileFieldContent}>
        <TextInput
          accessibilityLabel="First Name"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First Name*"
          placeholderTextColor="#7d879e"
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="givenName"
          style={styles.profileUnderlineInput}
        />
        <TextInput
          accessibilityLabel="Last Name"
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last Name (optional)"
          placeholderTextColor="#7d879e"
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="familyName"
          style={[styles.profileUnderlineInput, styles.profileNameLastInput]}
        />
        <Text style={styles.profileFieldNote}>
          Last name is optional, and only shared with matches
        </Text>
      </View>
    </View>
  );
}

function AgeProfileEditScreen({ initialDateOfBirth, onDone, metrics }) {
  const styles = createStyles(metrics);
  const calendarInputRef = useRef(null);
  const [dateOfBirth, setDateOfBirth] = useState(() => {
    const normalized = normalizeProfileDateOfBirth(initialDateOfBirth);
    if (!normalized) return null;
    const date = new Date(`${normalized}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  });
  const [showPicker, setShowPicker] = useState(false);
  const storageDate = dateOfBirth
    ? `${dateOfBirth.getFullYear()}-${String(
        dateOfBirth.getMonth() + 1,
      ).padStart(2, "0")}-${String(dateOfBirth.getDate()).padStart(2, "0")}`
    : "";
  const dateLabel = dateOfBirth
    ? `${String(dateOfBirth.getDate()).padStart(2, "0")}/${String(
        dateOfBirth.getMonth() + 1,
      ).padStart(2, "0")}/${String(dateOfBirth.getFullYear()).slice(-2)}`
    : "";
  const age = dateOfBirth ? calculateProfileAge(storageDate) : null;

  function openCalendar() {
    if (Platform.OS === "web") {
      const input = calendarInputRef.current;
      if (typeof input?.showPicker === "function") {
        input.showPicker();
      } else {
        input?.focus?.();
        input?.click?.();
      }
      return;
    }
    setShowPicker(true);
  }

  return (
    <View style={styles.screen}>
      <ProfileEditorHeader
        title="Age"
        onBack={() => onDone(storageDate)}
        onDone={() => onDone(storageDate)}
        styles={styles}
      />
      <View style={styles.profileFieldContent}>
        {Platform.OS === "web" ? (
          <View style={styles.profileDateInput}>
            <input
              ref={calendarInputRef}
              aria-label="Date of Birth"
              type="date"
              value={storageDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => {
                const selectedDate = new Date(`${event.target.value}T12:00:00`);
                if (!Number.isNaN(selectedDate.getTime())) {
                  setDateOfBirth(selectedDate);
                }
              }}
              onClick={() => setShowPicker(false)}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#7d879e",
                fontFamily: "inherit",
                fontSize: `${metrics.moderateScale(18)}px`,
                padding: 0,
              }}
            />
          </View>
        ) : (
          <>
            <View style={styles.profileDateInput}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Date of Birth"
                onPress={openCalendar}
                style={styles.profileDateValueButton}
              >
                <Text
                  style={[
                    styles.profileDateText,
                    !dateOfBirth && styles.profileFieldPlaceholder,
                  ]}
                >
                  {dateLabel || "Date of Birth"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open calendar"
                onPress={openCalendar}
                style={styles.profileCalendarButton}
              >
                <View style={styles.profileCalendarIcon}>
                  <View style={styles.profileCalendarTop} />
                  <View style={styles.profileCalendarGrid}>
                    {[0, 1, 2, 3, 4, 5].map((dot) => (
                      <View key={dot} style={styles.profileCalendarDot} />
                    ))}
                  </View>
                </View>
              </Pressable>
            </View>
            {showPicker ? (
              <DateTimePicker
                testID="profile-dob-picker"
                value={dateOfBirth || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === "android") setShowPicker(false);
                  if (event?.type !== "dismissed" && selectedDate) {
                    setDateOfBirth(selectedDate);
                  }
                }}
              />
            ) : null}
          </>
        )}
        <Text accessibilityLabel="Current age" style={styles.profileAgeText}>
          Age: {age === null ? "Not selected" : age}
        </Text>
      </View>
    </View>
  );
}

function JobSearchProfileEditScreen({ initialValue, onBack, metrics }) {
  const styles = createStyles(metrics);
  const [status, setStatus] = useState(initialValue?.status || "");
  const [workTypes, setWorkTypes] = useState(initialValue?.workTypes || []);
  const [foundersOnly, setFoundersOnly] = useState(initialValue?.foundersOnly || false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const JOB_SEARCH_PROFILE_ENDPOINT = "/job_search_profile";

  useEffect(() => {
    let isMounted = true;

    const fetchJobSearchProfile = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await apiFetch(JOB_SEARCH_PROFILE_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load job search profile: ${response.status}`);
        }

        const payload = await response.json();

        // Extract job search profile
        const jobSearchProfiles = Array.isArray(payload.job_search_profiles)
          ? payload.job_search_profiles
          : [];

        const jobSearchProfile = jobSearchProfiles[0] || {};

        // Extract work types
        const jobSearchProfileWorkTypes = Array.isArray(payload.job_search_profile_work_types)
          ? payload.job_search_profile_work_types
          : [];

        const workTypeValues = jobSearchProfileWorkTypes.map(
          item => item.job_search_profile_work_type
        ).filter(Boolean);

        if (isMounted) {
          // Set status from job_search_profile field
          setStatus(jobSearchProfile.job_search_profile || "");

          // Set work types from job_search_profile_work_type fields
          setWorkTypes(workTypeValues);

          // For foundersOnly, we don't have this in the API response based on the example,
          // so we'll keep the initial value or default to false
          if (initialValue?.foundersOnly !== undefined) {
            setFoundersOnly(initialValue.foundersOnly);
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load job search profile. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchJobSearchProfile();

    return () => {
      isMounted = false;
    };
  }, [retryKey, initialValue]);

  function toggleWorkType(workType) {
    setWorkTypes((current) =>
      current.includes(workType)
        ? current.filter((selected) => selected !== workType)
        : [...current, workType],
    );
  }

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator
            accessibilityLabel="Loading job search profile"
            size="large"
            color="#2dbcc4"
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.profileFieldSubtitle}>Loading...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.screen}>
          <View style={{ padding: 20 }}>
            <Text style={styles.profileFieldSubtitle}>
              {errorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry"
              onPress={() => setRetryKey((current) => current + 1)}
              style={styles.profileFieldDone}
            >
              <Text style={styles.saveText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.jobSearchHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
              onPress={() => onBack({ status, workTypes, foundersOnly })}
              style={styles.jobSearchHeaderAction}
            >
              <Image
                source={require("../assets/back_arrow.png")}
                style={styles.headlineBackIcon}
                resizeMode="contain"
              />
            </Pressable>
            <Text style={styles.jobSearchHeaderTitle}>Job Search Profile</Text>
            <View style={styles.jobSearchHeaderAction} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.jobSearchContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.jobSearchQuestion}>
              Where are you in your job search?
            </Text>

            <View style={styles.jobSearchStatusOptions}>
              {JOB_SEARCH_STATUS_OPTIONS.map((option) => {
                const selected = status === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setStatus(option)}
                    style={styles.jobSearchStatusOption}
                  >
                    <View
                      style={[
                        styles.jobSearchRadio,
                        selected && styles.jobSearchRadioSelected,
                      ]}
                    >
                      {selected ? <View style={styles.jobSearchRadioDot} /> : null}
                    </View>
                    <Text style={styles.jobSearchOptionText}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.jobSearchWorkQuestion}>
              What type of work you are looking for?
            </Text>
            <View style={styles.jobSearchWorkTypes}>
              {JOB_SEARCH_WORK_TYPES.map((workType) => {
                const selected = workTypes.includes(workType);
                return (
                  <Pressable
                    key={workType}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleWorkType(workType)}
                    style={[
                      styles.jobSearchWorkType,
                      workType === "Internship" && styles.jobSearchInternship,
                      selected && styles.jobSearchWorkTypeSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.jobSearchWorkTypeText,
                        selected && styles.jobSearchWorkTypeTextSelected,
                      ]}
                    >
                      {workType}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: foundersOnly }}
              onPress={() => setFoundersOnly((current) => !current)}
              style={styles.jobSearchFounderOption}
            >
              <View
                style={[
                  styles.jobSearchCheckbox,
                  foundersOnly && styles.jobSearchCheckboxSelected,
                ]}
              >
                {foundersOnly ? (
                  <Text style={styles.jobSearchCheckboxCheck}>✓</Text>
                ) : null}
              </View>
              <Text style={styles.jobSearchFounderOptionText}>
                Allow only founders who are hiring to see where I am in my job
                search
              </Text>
            </Pressable>
          </ScrollView>
        </>
      )}
    </View>
  );
}

function BioExperiencePickerField({
  fieldKey,
  label,
  value,
  options,
  loading,
  errorMessage,
  isOpen,
  onToggle,
  onSelect,
  onClose,
  onRetry,
  fieldStyle,
  styles,
}) {
  const selectedOption = options.find(
    (option) =>
      String(option.value) === String(value) || option.label === String(value),
  );
  const displayedValue = selectedOption?.label || value;

  return (
    <View>
      <Text style={styles.bioExperienceInputLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={[styles.bioExperienceFieldRow, fieldStyle]}
      >
        <Text
          style={[
            styles.bioExperienceFieldText,
            !displayedValue && styles.bioExperiencePlaceholder,
          ]}
          numberOfLines={1}
        >
          {displayedValue || label}
        </Text>
        <Text style={styles.bioExperienceChevron}>▼</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.bioExperienceModalBackdrop} onPress={onClose}>
          <Pressable
            style={styles.bioExperienceModalCard}
            onPress={() => {}}
          >
            <Text style={styles.bioExperienceModalTitle}>Select {label}</Text>
            {loading ? (
              <ActivityIndicator color="#2dbcc4" />
            ) : errorMessage ? (
              <View>
                <Text style={styles.bioExperienceModalError}>
                  {errorMessage}
                </Text>
                <Pressable onPress={onRetry}>
                  <Text style={styles.bioExperienceRetry}>Retry</Text>
                </Pressable>
              </View>
            ) : options.length ? (
              <ScrollView
                style={styles.bioExperienceModalList}
                showsVerticalScrollIndicator={false}
              >
                {options.map((option) => (
                  <Pressable
                    key={`${fieldKey}-${option.value}`}
                    onPress={() => onSelect(option)}
                    style={styles.bioExperienceModalOption}
                  >
                    <Text style={styles.bioExperienceModalOptionText}>
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text style={styles.bioExperienceModalDescription}>
                        {option.description}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.bioExperienceModalError}>
                No options are available.
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function BioExperienceTextField({
  label,
  styles,
  fieldStyle,
  ...inputProps
}) {
  return (
    <View style={[styles.bioExperienceTextField, fieldStyle]}>
      <Text style={styles.bioExperienceInputLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        style={styles.bioExperienceTextInput}
      />
    </View>
  );
}

function BioExperienceProfileEditScreen({
  initialValue,
  onBack,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [form, setForm] = useState(initialValue);
  const [optionsByField, setOptionsByField] = useState({});
  const [loadingByField, setLoadingByField] = useState(() =>
    Object.fromEntries(
      Object.keys(BIO_EXPERIENCE_PICKER_FIELDS).map((fieldKey) => [
        fieldKey,
        true,
      ]),
    ),
  );
  const [errorByField, setErrorByField] = useState({});
  const [openDropdown, setOpenDropdown] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [iosDatePickerTarget, setIosDatePickerTarget] = useState("");
  const [iosTempDate, setIosTempDate] = useState(new Date());

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      setLoadingByField(
        Object.fromEntries(
          Object.keys(BIO_EXPERIENCE_PICKER_FIELDS).map((fieldKey) => [
            fieldKey,
            true,
          ]),
        ),
      );
      setErrorByField({});

      await Promise.all(
        Object.entries(BIO_EXPERIENCE_PICKER_FIELDS).map(
          async ([fieldKey, config]) => {
            try {
              const response = await apiFetch(config.endpoint, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
              });
              if (!response.ok) {
                throw new Error(`${response.status}`);
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
              const options = list
                .map((item) =>
                  toBioExperienceOption(item, config.responseKey),
                )
                .filter((option) => Boolean(option.label));

              if (isMounted) {
                setOptionsByField((current) => ({
                  ...current,
                  [fieldKey]: options,
                }));
              }
            } catch {
              if (isMounted) {
                setErrorByField((current) => ({
                  ...current,
                  [fieldKey]: `Could not load ${config.label.toLowerCase()}.`,
                }));
                setOptionsByField((current) => ({
                  ...current,
                  [fieldKey]: [],
                }));
              }
            } finally {
              if (isMounted) {
                setLoadingByField((current) => ({
                  ...current,
                  [fieldKey]: false,
                }));
              }
            }
          },
        ),
      );
    }

    void loadOptions();
    return () => {
      isMounted = false;
    };
  }, [retryKey]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function getFieldLabel(fieldKey) {
    const value = form[fieldKey];
    return (
      optionsByField[fieldKey]?.find(
        (option) =>
          String(option.value) === String(value) ||
          option.label === String(value),
      )?.label || value || ""
    );
  }

  function setDateField(target, date) {
    if (!date) return;
    updateField(target, date.toISOString());
    if (target === "startDate" && form.endDate) {
      const currentEndDate = parseBioExperienceDate(form.endDate);
      if (currentEndDate && date > currentEndDate) {
        updateField("endDate", "");
      }
    }
  }

  function openDatePicker(target) {
    if (target === "endDate" && form.currentlyWorkHere) return;
    setOpenDropdown("");
    if (Platform.OS === "web") return;
    if (Platform.OS === "ios") {
      const currentDate = form[target] ? new Date(form[target]) : new Date();
      setIosTempDate(
        Number.isNaN(currentDate.getTime()) ? new Date() : currentDate,
      );
      setIosDatePickerTarget(target);
      return;
    }
    DateTimePickerAndroid.open({
      value: getBioExperienceDateValue(form[target]),
      mode: "date",
      display: "default",
      maximumDate: new Date(),
      minimumDate: target === "endDate" ? parsedStartDate : undefined,
      onChange: (event, date) => handleNativeDateChange(event, date, target),
    });
  }

  function handleNativeDateChange(event, date, target) {
    if (event?.type !== "dismissed" && date) setDateField(target, date);
  }

  function renderDateField(target, label) {
    const value = form[target];
    const dateText = formatBioExperienceDate(value);

    if (Platform.OS === "web") {
      const dateValue = value ? String(value).slice(0, 10) : "";
      return (
        <View>
          <Text style={styles.bioExperienceInputLabel}>{label}</Text>
          <View
            style={[
              styles.bioExperienceWebDateField,
              target === "endDate" &&
                form.currentlyWorkHere &&
                styles.bioExperienceDisabledDateField,
            ]}
          >
            <Text
              pointerEvents="none"
              style={[
                styles.bioExperienceWebDateLabel,
                !dateText && styles.bioExperiencePlaceholder,
              ]}
            >
              {dateText || label}
            </Text>
            <input
              aria-label={label}
              type="date"
              value={dateValue}
              max={new Date().toISOString().slice(0, 10)}
              min={target === "endDate" && parsedStartDate
                ? parsedStartDate.toISOString().slice(0, 10)
                : undefined}
              disabled={target === "endDate" && form.currentlyWorkHere}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (!nextValue) {
                  updateField(target, "");
                  return;
                }
                const nextDate = new Date(`${nextValue}T12:00:00`);
                if (!Number.isNaN(nextDate.getTime())) {
                  setDateField(target, nextDate);
                }
              }}
              style={styles.bioExperienceWebDateInput}
            />
          </View>
        </View>
      );
    }

    return (
      <View>
        <Text style={styles.bioExperienceInputLabel}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => openDatePicker(target)}
          disabled={target === "endDate" && form.currentlyWorkHere}
          style={[
            styles.bioExperienceDateField,
            target === "endDate" &&
              form.currentlyWorkHere &&
              styles.bioExperienceDisabledDateField,
          ]}
        >
          <Text
            style={[
              styles.bioExperienceFieldText,
              !dateText && styles.bioExperiencePlaceholder,
            ]}
          >
            {dateText || label}
          </Text>
          <BioExperienceCalendarIcon styles={styles} />
        </Pressable>
      </View>
    );
  }

  const primaryRoleValue = form.primaryRole;
  const parsedStartDate = parseBioExperienceDate(form.startDate);
  const secondaryRoleOptions = (optionsByField.secondaryRole || []).filter(
    (option) => String(option.value) !== String(primaryRoleValue),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.bioExperienceHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={onBack}
          style={styles.bioExperienceHeaderAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.bioExperienceHeaderTitle}>Bio &amp; Experience</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={() =>
            onDone({
              ...form,
              fundingStageLabel: getFieldLabel("fundingStage"),
              riskAppetiteLabel: getFieldLabel("riskAppetite"),
              employmentTypeLabel: getFieldLabel("employmentType"),
              locationTypeLabel: getFieldLabel("locationType"),
              primaryRoleLabel: getFieldLabel("primaryRole"),
              secondaryRoleLabel: getFieldLabel("secondaryRole"),
            })
          }
          style={styles.bioExperienceDoneButton}
        >
          <Text style={styles.bioExperienceDoneText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.bioExperienceContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BioExperiencePickerField
          fieldKey="fundingStage"
          label="Funding Stage"
          value={form.fundingStage}
          options={optionsByField.fundingStage || []}
          loading={Boolean(loadingByField.fundingStage)}
          errorMessage={errorByField.fundingStage}
          isOpen={openDropdown === "fundingStage"}
          onToggle={() =>
            setOpenDropdown((current) =>
              current === "fundingStage" ? "" : "fundingStage",
            )
          }
          onSelect={(option) => {
            updateField("fundingStage", option.value);
            setOpenDropdown("");
          }}
          onClose={() => setOpenDropdown("")}
          onRetry={() => setRetryKey((current) => current + 1)}
          styles={styles}
        />
        <BioExperiencePickerField
          fieldKey="riskAppetite"
          label="Risk Appetite"
          value={form.riskAppetite}
          options={optionsByField.riskAppetite || []}
          loading={Boolean(loadingByField.riskAppetite)}
          errorMessage={errorByField.riskAppetite}
          isOpen={openDropdown === "riskAppetite"}
          onToggle={() =>
            setOpenDropdown((current) =>
              current === "riskAppetite" ? "" : "riskAppetite",
            )
          }
          onSelect={(option) => {
            updateField("riskAppetite", option.value);
            setOpenDropdown("");
          }}
          onClose={() => setOpenDropdown("")}
          onRetry={() => setRetryKey((current) => current + 1)}
          styles={styles}
        />
        <BioExperiencePickerField
          fieldKey="employmentType"
          label="Employment Type"
          value={form.employmentType}
          options={optionsByField.employmentType || []}
          loading={Boolean(loadingByField.employmentType)}
          errorMessage={errorByField.employmentType}
          isOpen={openDropdown === "employmentType"}
          onToggle={() =>
            setOpenDropdown((current) =>
              current === "employmentType" ? "" : "employmentType",
            )
          }
          onSelect={(option) => {
            updateField("employmentType", option.value);
            setOpenDropdown("");
          }}
          onClose={() => setOpenDropdown("")}
          onRetry={() => setRetryKey((current) => current + 1)}
          styles={styles}
        />

        <BioExperienceTextField
          label="Company Name"
          styles={styles}
          accessibilityLabel="Company Name"
          value={form.companyName}
          onChangeText={(value) => updateField("companyName", value)}
          placeholder="Company Name"
          placeholderTextColor="#a2a2a2"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <BioExperienceTextField
          label="Location"
          styles={styles}
          accessibilityLabel="Location"
          value={form.location}
          onChangeText={(value) => updateField("location", value)}
          placeholder="Location"
          placeholderTextColor="#a2a2a2"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <BioExperiencePickerField
          fieldKey="locationType"
          label="Location Type"
          value={form.locationType}
          options={optionsByField.locationType || []}
          loading={Boolean(loadingByField.locationType)}
          errorMessage={errorByField.locationType}
          isOpen={openDropdown === "locationType"}
          onToggle={() =>
            setOpenDropdown((current) =>
              current === "locationType" ? "" : "locationType",
            )
          }
          onSelect={(option) => {
            updateField("locationType", option.value);
            setOpenDropdown("");
          }}
          onClose={() => setOpenDropdown("")}
          onRetry={() => setRetryKey((current) => current + 1)}
          styles={styles}
        />

        {renderDateField("startDate", "Start Date")}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.currentlyWorkHere }}
          onPress={() => {
            const nextValue = !form.currentlyWorkHere;
            updateField("currentlyWorkHere", nextValue);
            if (nextValue) updateField("endDate", "");
          }}
          style={styles.bioExperienceCurrentRow}
        >
          <View
            style={[
              styles.bioExperienceCheckbox,
              form.currentlyWorkHere && styles.bioExperienceCheckboxSelected,
            ]}
          >
            {form.currentlyWorkHere ? (
              <Text style={styles.bioExperienceCheckboxCheck}>✓</Text>
            ) : null}
          </View>
          <Text style={styles.bioExperienceCurrentText}>
            I currently work here
          </Text>
        </Pressable>
        {renderDateField("endDate", "End Date")}

        <BioExperienceTextField
          label="Title"
          styles={styles}
          accessibilityLabel="Title"
          value={form.title}
          onChangeText={(value) => updateField("title", value)}
          placeholder="Title"
          placeholderTextColor="#a2a2a2"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <BioExperiencePickerField
          fieldKey="primaryRole"
          label="Primary Role"
          value={form.primaryRole}
          options={optionsByField.primaryRole || []}
          loading={Boolean(loadingByField.primaryRole)}
          errorMessage={errorByField.primaryRole}
          isOpen={openDropdown === "primaryRole"}
          onToggle={() =>
            setOpenDropdown((current) =>
              current === "primaryRole" ? "" : "primaryRole",
            )
          }
          onSelect={(option) => {
            updateField("primaryRole", option.value);
            if (String(form.secondaryRole) === String(option.value)) {
              updateField("secondaryRole", "");
            }
            setOpenDropdown("");
          }}
          onClose={() => setOpenDropdown("")}
          onRetry={() => setRetryKey((current) => current + 1)}
          fieldStyle={styles.bioExperiencePrimaryRoleRow}
          styles={styles}
        />
        <BioExperienceTextField
          label="Years Of Experience"
          styles={styles}
          accessibilityLabel="Years Of Experience"
          value={form.yearsOfExperience}
          onChangeText={(value) => updateField("yearsOfExperience", value)}
          placeholder="Years Of Experience"
          placeholderTextColor="#a2a2a2"
          keyboardType="number-pad"
        />
        <BioExperiencePickerField
          fieldKey="secondaryRole"
          label="Secondary Role (Optional)"
          value={form.secondaryRole}
          options={secondaryRoleOptions}
          loading={Boolean(loadingByField.secondaryRole)}
          errorMessage={errorByField.secondaryRole}
          isOpen={openDropdown === "secondaryRole"}
          onToggle={() =>
            setOpenDropdown((current) =>
              current === "secondaryRole" ? "" : "secondaryRole",
            )
          }
          onSelect={(option) => {
            updateField("secondaryRole", option.value);
            setOpenDropdown("");
          }}
          onClose={() => setOpenDropdown("")}
          onRetry={() => setRetryKey((current) => current + 1)}
          fieldStyle={styles.bioExperienceSecondaryRoleRow}
          styles={styles}
        />
        <BioExperienceTextField
          label="Bio"
          styles={styles}
          accessibilityLabel="Bio"
          fieldStyle={styles.bioExperienceLongInput}
          value={form.bio}
          onChangeText={(value) => updateField("bio", value)}
          placeholder="Bio"
          placeholderTextColor="#a2a2a2"
          autoCapitalize="sentences"
          autoCorrect={false}
          multiline
          textAlignVertical="top"
        />
        <BioExperienceTextField
          label="Startup Idea"
          styles={styles}
          accessibilityLabel="Startup Idea"
          fieldStyle={styles.bioExperienceLongInput}
          value={form.startupIdea}
          onChangeText={(value) => updateField("startupIdea", value)}
          placeholder="Startup Idea"
          placeholderTextColor="#a2a2a2"
          autoCapitalize="sentences"
          autoCorrect={false}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>

      {Platform.OS === "ios" ? (
        <Modal
          visible={Boolean(iosDatePickerTarget)}
          transparent
          animationType="fade"
          onRequestClose={() => setIosDatePickerTarget("")}
        >
          <Pressable
            style={styles.bioExperienceModalBackdrop}
            onPress={() => setIosDatePickerTarget("")}
          >
            <Pressable
              style={styles.bioExperienceDateModalCard}
              onPress={() => {}}
            >
              <Text style={styles.bioExperienceModalTitle}>
                {iosDatePickerTarget === "startDate" ? "Start Date" : "End Date"}
              </Text>
              <DateTimePicker
                value={iosTempDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                minimumDate={
                  iosDatePickerTarget === "endDate" && parsedStartDate
                    ? parsedStartDate
                    : undefined
                }
                onChange={(_event, date) => {
                  if (date) setIosTempDate(date);
                }}
                style={styles.bioExperienceIosDatePicker}
              />
              <View style={styles.bioExperienceDateActions}>
                <Pressable
                  onPress={() => setIosDatePickerTarget("")}
                  style={styles.bioExperienceDateAction}
                >
                  <Text style={styles.bioExperienceDateActionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDateField(iosDatePickerTarget, iosTempDate);
                    setIosDatePickerTarget("");
                  }}
                  style={styles.bioExperienceDateAction}
                >
                  <Text style={styles.bioExperienceDateActionText}>Confirm</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function BioExperienceCalendarIcon({ styles }) {
  return (
    <View style={styles.bioExperienceCalendarIcon}>
      <View style={styles.bioExperienceCalendarTop} />
      <View style={styles.bioExperienceCalendarGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={styles.bioExperienceCalendarDot} />
        ))}
      </View>
    </View>
  );
}

function ProfileRadioOption({ label, selected, onPress, styles }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.profileRadioRow}
    >
      <View
        style={[
          styles.profileRadioOuter,
          selected && styles.profileRadioOuterSelected,
        ]}
      >
        {selected ? <View style={styles.profileRadioInner} /> : null}
      </View>
      <Text style={styles.profileRadioLabel}>{label}</Text>
    </Pressable>
  );
}

function LocationProfileEditScreen({
  initialLocation,
  locationPreferenceQuestions = [],
  initialCities = [],
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [city, setCity] = useState(initialLocation?.city || "");
  const [isPickingCity, setIsPickingCity] = useState(false);
  const [openToRemote, setOpenToRemote] = useState(
    initialLocation.openToRemote,
  );
  const [workPreference, setWorkPreference] = useState(
    initialLocation.workPreference,
  );
  const [willingToRelocate, setWillingToRelocate] = useState(
    initialLocation.willingToRelocate,
  );

  const [selectedAnswers, setSelectedAnswers] = useState(() => {
    const savedAnswers = Array.isArray(initialLocation?.selectedAnswers)
      ? initialLocation.selectedAnswers
      : [];

    const answersFromList = savedAnswers.reduce((accumulator, item) => {
      const questionId = item?.question_id ?? item?.id;
      const answerId = item?.selected_answer_id ?? item?.answer_id;

      if (questionId != null && answerId != null) {
        accumulator[String(questionId)] = String(answerId);
      }
      return accumulator;
    }, {});

    if (Array.isArray(initialLocation?.selectedAnswers)) {
      return answersFromList;
    }

    const savedAnswerMap = initialLocation?.selectedAnswers;
    if (!savedAnswerMap || typeof savedAnswerMap !== "object") {
      return {};
    }

    return Object.entries(savedAnswerMap).reduce(
      (accumulator, [questionId, answer]) => {
        const answerId =
          answer && typeof answer === "object"
            ? (answer.selected_answer_id ?? answer.answer_id)
            : answer;

        if (answerId != null) {
          accumulator[String(questionId)] = String(answerId);
        }
        return accumulator;
      },
      {},
    );
  });

  // console.log(
  //   "Location preference questions:",
  //   JSON.stringify(locationPreferenceQuestions, null, 2),
  // );

  // console.log("Selected answers:", JSON.stringify(selectedAnswers, null, 2));

  const getSelectedAnswer = (searchText) => {
    const question = locationPreferenceQuestions.find((item) =>
      (item.question ?? item.question_text ?? "")
        .toLowerCase()
        .includes(searchText.toLowerCase()),
    );

    if (!question) return "";

    const questionId = question.question_id ?? question.id;
    const selectedAnswerId = selectedAnswers[String(questionId)];

    const answers =
      question.answers ?? question.options ?? question.answer_options ?? [];

    const selectedOption = answers.find(
      (answer) =>
        String(answer.answer_id ?? answer.id) === String(selectedAnswerId),
    );

    return (
      selectedOption?.answer ??
      selectedOption?.answer_text ??
      selectedOption?.label ??
      selectedOption?.name ??
      ""
    );
  };

  // const handleDone = () => {
  //   onDone({
  //     city: (city || "").trim(),
  //     openToRemote,
  //     workPreference,
  //     willingToRelocate,
  //     selectedAnswers,
  //   });
  // };

  const handleDone = () => {
    const remoteAnswer = getSelectedAnswer("Are you open to work remotely");

    const workPreference = getSelectedAnswer(
      "What is your preference in working remotely",
    );

    const relocationAnswer = getSelectedAnswer("Are you willing to relocate");

    const openToRemote =
      remoteAnswer.toLowerCase() === "yes"
        ? "Remote"
        : remoteAnswer.toLowerCase() === "no"
          ? "Onsite"
          : "";

    const willingToRelocate =
      relocationAnswer.toLowerCase() === "yes"
        ? true
        : relocationAnswer.toLowerCase() === "no"
          ? false
          : undefined;

    onDone({
      city: city.trim(),
      openToRemote,
      workPreference,
      willingToRelocate,
      selectedAnswers,
    });
  };

  const handleAnswerSelect = (questionId, answerId) => {
    setSelectedAnswers((previousAnswers) => ({
      ...previousAnswers,
      [questionId]: answerId,
    }));
  };

  const workOptions = [
    "Hybrid (Onsite or remote)",
    "Onsite preferred",
    "Remote preferred",
    "Remote only",
  ];

  if (isPickingCity) {
    return (
      <CityPickerScreen
        initialCities={initialCities}
        onBack={() => setIsPickingCity(false)}
        onSelectCity={(selectedCity) => {
          setCity(selectedCity.label);
          setIsPickingCity(false);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ProfileEditorHeader
        title="Location"
        onBack={handleDone}
        onDone={handleDone}
        styles={styles}
      />

      <ScrollView
        contentContainerStyle={styles.profileLocationContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.profileFieldSubtitle}>Where are you based?</Text>
        <View style={styles.profileFieldRow}>
          {/* <Text style={styles.profileFieldLabel}>City</Text> */}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select City"
            onPress={() => setIsPickingCity(true)}
            style={styles.profileDateInput}
          >
            <Text
              style={[
                styles.profileDateText,
                !city && styles.profileFieldPlaceholder,
              ]}
            >
              {city || "Select City"}
            </Text>
          </Pressable>
        </View>
        {locationPreferenceQuestions.map((question) => {
          const questionId = question.question_id ?? question.id;

          const answers =
            question.answers ??
            question.options ??
            question.answer_options ??
            [];

          return (
            <View key={questionId}>
              <Text style={styles.profileLocationQuestion}>
                {question.question}
              </Text>
              {answers.map((answer) => {
                const questionId = question.question_id ?? question.id;
                const answerId = answer.answer_id ?? answer.id;

                const isSelected =
                  String(selectedAnswers[questionId] ?? "") ===
                  String(answerId ?? "");

                return (
                  <ProfileRadioOption
                    styles={styles}
                    key={answerId}
                    label={
                      answer.answer ??
                      answer.answer_text ??
                      answer.label ??
                      answer.name
                    }
                    selected={isSelected}
                    onPress={() => handleAnswerSelect(questionId, answerId)}
                  />
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function LinkedinProfileEditScreen({ initialUrl, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [linkedinUrl, setLinkedinUrl] = useState(initialUrl || "");
  const [linkedinPreview, setLinkedinPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const loadLinkedinPreview = useCallback(async (url) => {
    const normalizedUrl = url
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "");
    const profilePath = "linkedin.com/in/";
    const profilePathIndex = normalizedUrl
      .toLowerCase()
      .indexOf(profilePath);
    const username = (
      profilePathIndex >= 0
        ? normalizedUrl.slice(profilePathIndex + profilePath.length)
        : normalizedUrl.replace(/^\/+/, "")
    )
      .split(/[/?#]/)[0]
      .trim();

    if (!username) {
      setLinkedinPreview(null);
      setPreviewError("Enter a LinkedIn profile URL to preview.");
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await apiFetch(
        `/linkedin-profile?username=${encodeURIComponent(username)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.detail ||
            payload?.message ||
            "Failed to fetch LinkedIn profile.",
        );
      }

      const basicInfo = payload?.basic_info ?? {};
      const firstExperience = payload?.experience?.[0] ?? {};
      const firstEducation = payload?.education?.[0] ?? {};
      const connectionCount = Number(basicInfo.connection_count);
      const preview = {
        headline: String(basicInfo.headline ?? "").trim(),
        firstOrganization: String(firstExperience.company ?? "").trim(),
        firstEducationInstitution: String(firstEducation.school ?? "").trim(),
        firstLocation: String(
          basicInfo.location?.full || basicInfo.location?.city || "",
        ).trim(),
        connections:
          Number.isFinite(connectionCount) && connectionCount >= 0
            ? `${connectionCount} connections on LinkedIn`
            : "",
      };

      if (
        !preview.headline ||
        !preview.firstOrganization ||
        !preview.firstEducationInstitution ||
        !preview.firstLocation ||
        !preview.connections
      ) {
        setLinkedinPreview(null);
        setPreviewError(
          "Could not build profile preview. Please check the URL and try again.",
        );
        return;
      }

      setLinkedinPreview(preview);
    } catch (error) {
      setLinkedinPreview(null);
      setPreviewError(
        error?.message || "Failed to fetch LinkedIn profile preview.",
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUrl?.trim()) {
      void loadLinkedinPreview(initialUrl);
    }
  }, [initialUrl, loadLinkedinPreview]);

  return (
    <View style={styles.screen}>
      <ProfileEditorHeader
        title="LinkedIn"
        onBack={() => onDone(linkedinUrl.trim())}
        onDone={() => onDone(linkedinUrl.trim())}
        styles={styles}
      />
      <View style={styles.profileFieldContent}>
        <View style={styles.profileLinkedinInputRow}>
          <TextInput
            accessibilityLabel="LinkedIn profile URL"
            value={linkedinUrl}
            onChangeText={(value) => {
              setLinkedinUrl(value);
              setLinkedinPreview(null);
              setPreviewError("");
            }}
            placeholder="linkedin.com/in/your-profile"
            placeholderTextColor="#a2a2a2"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.profileUnderlineInput, styles.profileLinkedinUrlInput]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load LinkedIn profile preview"
            accessibilityState={{ disabled: isPreviewLoading }}
            disabled={isPreviewLoading}
            onPress={() => void loadLinkedinPreview(linkedinUrl)}
            style={styles.profileLinkedinPreviewButton}
          >
            {isPreviewLoading ? (
              <ActivityIndicator color="#20b8c2" />
            ) : (
              <Image
                source={require("../assets/right-arrow.png")}
                style={styles.profileLinkedinPreviewArrow}
                resizeMode="contain"
              />
            )}
          </Pressable>
        </View>
        <View
          accessibilityLabel="LinkedIn Profile Preview"
          style={[
            styles.profileLinkedinPreview,
            linkedinPreview && styles.profileLinkedinPreviewFilled,
          ]}
        >
          {isPreviewLoading ? (
            <Text style={styles.profileLinkedinPreviewText}>
              Loading LinkedIn Profile...
            </Text>
          ) : linkedinPreview ? (
            <View style={styles.profileLinkedinPreviewDetails}>
              <Text style={styles.profileLinkedinPreviewHeadline}>
                {linkedinPreview.headline}
              </Text>
              <Text style={styles.profileLinkedinPreviewMeta}>
                {`${linkedinPreview.firstOrganization} • ${linkedinPreview.firstEducationInstitution} • ${linkedinPreview.firstLocation} • ${linkedinPreview.connections}`}
              </Text>
            </View>
          ) : (
            <Text style={styles.profileLinkedinPreviewText}>
              LinkedIn Profile Preview
            </Text>
          )}
        </View>
        {previewError ? (
          <Text accessibilityRole="alert" style={styles.profileLinkedinPreviewError}>
            {previewError}
          </Text>
        ) : null}
        <Text style={styles.profileFieldNote}>
          Your LinkedIn profile must be public for preview to appear.
        </Text>
      </View>
    </View>
  );
}

function SchedulingLinkEditScreen({ initialUrl, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [schedulingLink, setSchedulingLink] = useState(initialUrl);

  return (
    <View style={styles.screen}>
      <ProfileEditorHeader
        title="Scheduling Link"
        onBack={() => onDone(schedulingLink.trim())}
        onDone={() => onDone(schedulingLink.trim())}
        styles={styles}
      />
      <View style={styles.profileFieldContent}>
        <TextInput
          accessibilityLabel="Scheduling Link"
          value={schedulingLink}
          onChangeText={setSchedulingLink}
          placeholder="https://calendly.com/example"
          placeholderTextColor="#a2a2a2"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.profileUnderlineInput}
        />
      </View>
    </View>
  );
}

function ProfileHistorySection({
  title,
  headerIcon,
  itemIcon,
  items,
  onAdd,
  onItemPress,
  styles,
}) {
  return (
    <View style={styles.historySection}>
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.historyHeaderActions}>
          <Image
            source={headerIcon}
            style={styles.historyHeaderIcon}
            resizeMode="contain"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${title === "My Experiences" ? "experience" : "education"}`}
            disabled={!onAdd}
            onPress={onAdd}
            style={styles.historyAddButton}
          >
            <Text style={styles.addIcon}>+</Text>
          </Pressable>
        </View>
      </View>
      {items.map((item, index) => (
        <Pressable
          accessibilityRole={onItemPress ? "button" : undefined}
          accessibilityLabel={onItemPress ? `Edit ${item.title}` : undefined}
          disabled={!onItemPress}
          onPress={() => onItemPress?.(item, index)}
          key={`${item.title}-${item.organization}-${index}`}
          style={styles.historyRow}
        >
          <View style={styles.historyIconWrap}>
            <Image
              source={itemIcon}
              style={styles.historyIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.historyCopy}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.historyOrganization} numberOfLines={1}>
              {item.organization}
            </Text>
            <Text style={styles.historyDates} numberOfLines={1}>
              {item.dates}
            </Text>
            <Text
              style={[
                styles.historyDescription,
                item.muted && styles.mutedValue,
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatProfileExperienceDate(value) {
  const date = parseBioExperienceDate(value);
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}/${date.getFullYear()}`;
}

function normalizeProfileHistoryDate(value) {
  if (!value) return "";
  if (typeof value === "object" && !(value instanceof Date)) {
    const year = Number(value.year);
    const month = Number(value.month || 1);
    const day = Number(value.day || 1);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(year, month - 1, day, 12).toISOString();
    }
  }
  const date = parseBioExperienceDate(value);
  return date ? date.toISOString() : "";
}

function ProfileHistoryItemEditScreen({
  type = "experience",
  initialData,
  onBack,
  onDone,
  onRemove,
  metrics,
}) {
  const styles = createStyles(metrics);
  const isEducation = type === "education";
  const textFields = isEducation
    ? [
        {
          key: "school",
          label: "School*",
          placeholder: "Enter your school name",
        },
        {
          key: "degree",
          label: "Degree*",
          placeholder: "Enter your degree",
        },
        {
          key: "fieldOfStudy",
          label: "Field Of Study*",
          placeholder: "Field Of Study",
        },
      ]
    : [
        {
          key: "title",
          label: "Title*",
          placeholder: "Enter your job title",
        },
        {
          key: "company",
          label: "Company*",
          placeholder: "Enter your company name",
        },
      ];
  const [form, setForm] = useState({
    title: initialData?.title || "",
    company: initialData?.company ?? initialData?.organization ?? "",
    school: initialData?.school ?? initialData?.title ?? "",
    degree: initialData?.degree ?? initialData?.organization ?? "",
    fieldOfStudy:
      initialData?.fieldOfStudy ?? initialData?.description ?? "",
    currentlyWorkInRole:
      initialData?.currentlyWorkInRole ?? initialData?.isCurrent ?? false,
    startDate: normalizeProfileHistoryDate(
      initialData?.startDate ?? initialData?.start_date,
    ),
    endDate: normalizeProfileHistoryDate(
      initialData?.endDate ?? initialData?.end_date,
    ),
    description: initialData?.description || "",
  });
  const [iosDatePickerTarget, setIosDatePickerTarget] = useState("");
  const [iosTempDate, setIosTempDate] = useState(new Date());
  const parsedStartDate = parseBioExperienceDate(form.startDate);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setDateField(target, date) {
    if (!date) return;
    setForm((current) => {
      const next = { ...current, [target]: date.toISOString() };
      if (target === "startDate" && current.endDate) {
        const currentEndDate = parseBioExperienceDate(current.endDate);
        if (currentEndDate && date > currentEndDate) next.endDate = "";
      }
      return next;
    });
  }

  function openDatePicker(target) {
    if (target === "endDate" && form.currentlyWorkInRole) return;
    if (Platform.OS === "web") return;
    if (Platform.OS === "ios") {
      setIosTempDate(getBioExperienceDateValue(form[target]));
      setIosDatePickerTarget(target);
      return;
    }

    DateTimePickerAndroid.open({
      value: getBioExperienceDateValue(form[target]),
      mode: "date",
      display: "default",
      maximumDate: new Date(),
      minimumDate: target === "endDate" ? parsedStartDate : undefined,
      onChange: (event, date) => {
        if (event?.type !== "dismissed" && date) setDateField(target, date);
      },
    });
  }

  function renderDateField(target, label) {
    const disabled = target === "endDate" && form.currentlyWorkInRole;
    const dateText = formatProfileExperienceDate(form[target]);
    const fieldStyle = [
      styles.profileExperienceDateField,
      disabled && styles.profileExperienceDisabledDateField,
    ];
    const dateValue = form[target] ? String(form[target]).slice(0, 10) : "";

    return (
      <View style={styles.profileExperienceDateGroup}>
        <Text style={styles.profileExperienceFieldLabel}>{label}*</Text>
        {Platform.OS === "web" ? (
          <View style={fieldStyle}>
            <Text
              pointerEvents="none"
              style={[
                styles.profileExperienceDateText,
                !dateText && styles.profileExperiencePlaceholder,
              ]}
            >
              {dateText || "dd/mm/yyyy"}
            </Text>
            {/* <BioExperienceCalendarIcon styles={styles} /> */}
            <input
              aria-label={label}
              type="date"
              value={dateValue}
              max={new Date().toISOString().slice(0, 10)}
              min={target === "endDate" && parsedStartDate
                ? parsedStartDate.toISOString().slice(0, 10)
                : undefined}
              disabled={disabled}
              onChange={(event) => {
                if (!event.target.value) {
                  updateField(target, "");
                  return;
                }
                const date = new Date(`${event.target.value}T12:00:00`);
                if (!Number.isNaN(date.getTime())) setDateField(target, date);
              }}
              style={styles.profileExperienceWebDateInput}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            disabled={disabled}
            onPress={() => openDatePicker(target)}
            style={fieldStyle}
          >
            <Text
              style={[
                styles.profileExperienceDateText,
                !dateText && styles.profileExperiencePlaceholder,
              ]}
            >
              {dateText || "dd/mm/yyyy"}
            </Text>
            <BioExperienceCalendarIcon styles={styles} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.profileExperienceHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={onBack}
          style={styles.profileExperienceHeaderAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.profileExperienceHeaderTitle}>
          {isEducation ? "Education" : "Experience"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={() => onDone(form)}
          style={styles.profileExperienceDoneButton}
        >
          <Text style={styles.profileExperienceDoneText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.profileExperienceContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {textFields.map((field) => (
          <View
            key={field.key}
            style={styles.profileExperienceTextFieldGroup}
          >
            <Text style={styles.profileExperienceFieldLabel}>
              {field.label}
            </Text>
            <TextInput
              accessibilityLabel={field.label.replace("*", "")}
              value={form[field.key]}
              onChangeText={(value) => updateField(field.key, value)}
              placeholder={field.placeholder}
              placeholderTextColor="#7d879e"
              maxLength={100}
              style={styles.profileExperienceTextInput}
              autoCapitalize="words"
            />
            <Text style={styles.profileExperienceCharacterCount}>
              {form[field.key].length}/100
            </Text>
          </View>
        ))}

        {!isEducation ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.currentlyWorkInRole }}
            onPress={() => {
              const nextValue = !form.currentlyWorkInRole;
              updateField("currentlyWorkInRole", nextValue);
              if (nextValue) updateField("endDate", "");
            }}
            style={styles.profileExperienceCurrentRow}
          >
            <View
              style={[
                styles.bioExperienceCheckbox,
                form.currentlyWorkInRole &&
                  styles.bioExperienceCheckboxSelected,
              ]}
            >
              {form.currentlyWorkInRole ? (
                <Text style={styles.bioExperienceCheckboxCheck}>✓</Text>
              ) : null}
            </View>
            <Text style={styles.profileExperienceCurrentText}>
              I currently work in this role
            </Text>
          </Pressable>
        ) : null}

        {renderDateField("startDate", "Start Date")}
        {renderDateField("endDate", "End Date")}

        <View style={styles.profileExperienceDescriptionGroup}>
          <Text style={styles.profileExperienceFieldLabel}>Description</Text>
          <TextInput
            accessibilityLabel="Description"
            value={form.description}
            onChangeText={(value) => updateField("description", value)}
            placeholder="Enter Your Job Description"
            placeholderTextColor="#7d879e"
            multiline
            textAlignVertical="top"
            style={styles.profileExperienceDescriptionInput}
          />
        </View>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${isEducation ? "Education" : "Experience"}`}
            onPress={onRemove}
            style={styles.profileHistoryRemoveButton}
          >
            <Text style={styles.profileHistoryRemoveButtonText}>
              Remove {isEducation ? "Education" : "Experience"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {Platform.OS === "ios" && iosDatePickerTarget ? (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setIosDatePickerTarget("")}
        >
          <View style={styles.bioExperienceModalBackdrop}>
            <View style={styles.bioExperienceDateModalCard}>
              <Text style={styles.bioExperienceModalTitle}>
                Select {iosDatePickerTarget === "startDate" ? "Start" : "End"} Date
              </Text>
              <DateTimePicker
                value={iosTempDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                minimumDate={
                  iosDatePickerTarget === "endDate" ? parsedStartDate : undefined
                }
                onChange={(_event, date) => {
                  if (date) setIosTempDate(date);
                }}
                style={styles.bioExperienceIosDatePicker}
              />
              <View style={styles.bioExperienceDateActions}>
                <Pressable
                  onPress={() => setIosDatePickerTarget("")}
                  style={styles.bioExperienceDateAction}
                >
                  <Text style={styles.bioExperienceDateActionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDateField(iosDatePickerTarget, iosTempDate);
                    setIosDatePickerTarget("");
                  }}
                  style={styles.bioExperienceDateAction}
                >
                  <Text style={styles.bioExperienceDateActionText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function HeadlineEditScreen({ initialValue, onBack, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [headline, setHeadline] = useState(initialValue);

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={onBack}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Headline</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onDone(headline)}
          style={styles.headlineDoneAction}
        >
          <Text style={styles.saveText}>Done</Text>
        </Pressable>
      </View>
      <TextInput
        accessibilityLabel="Headline"
        multiline
        placeholder="Write your headline here"
        placeholderTextColor="#7d879e"
        textAlignVertical="top"
        value={headline}
        onChangeText={setHeadline}
        style={styles.headlineEditorInput}
      />
    </View>
  );
}

function IdeaEditScreen({ initialValue, onBack, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [idea, setIdea] = useState(initialValue);

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={onBack}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Idea</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onDone(idea)}
          style={styles.headlineDoneAction}
        >
          <Text style={styles.saveText}>Done</Text>
        </Pressable>
      </View>
      <View style={styles.ideaEditorContent}>
        <Text style={styles.ideaEditorTitle}>I’m exploring</Text>
        <TextInput
          accessibilityLabel="Idea"
          multiline
          placeholder="Write your idea here"
          placeholderTextColor="#7d879e"
          textAlignVertical="top"
          value={idea}
          onChangeText={setIdea}
          style={styles.ideaEditorInput}
        />
      </View>
    </View>
  );
}

function toPromptOption(item) {
  const text = String(
    typeof item === "string"
      ? item
      : item?.prompt_name ||
          item?.prompt_text ||
          item?.prompt ||
          item?.title ||
          item?.question ||
          item?.name ||
          "",
  ).trim();
  return text ? { id: item?.id ?? text, text } : null;
}

function WrittenPromptEditScreen({
  firebaseToken,
  initialPrompt,
  initialAnswer,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [answer, setAnswer] = useState(initialAnswer);
  const [selectedPrompt, setSelectedPrompt] = useState(initialPrompt);
  const [isPromptListOpen, setIsPromptListOpen] = useState(false);
  const [prompts, setPrompts] = useState([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [promptError, setPromptError] = useState("");

  async function loadPrompts() {
    setIsLoadingPrompts(true);
    setPromptError("");
    try {
      const payload = await getPrompts(firebaseToken);
      setPrompts(payload.map(toPromptOption).filter(Boolean));
    } catch (error) {
      setPromptError(
        error?.message || "Could not load prompts. Please try again.",
      );
    } finally {
      setIsLoadingPrompts(false);
    }
  }

  function openPromptList() {
    setIsPromptListOpen(true);
    if (!prompts.length) {
      void loadPrompts();
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(selectedPrompt, answer)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Written Prompt</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onDone(selectedPrompt, answer)}
          style={styles.headlineDoneAction}
        >
          <Text style={styles.saveText}>Done</Text>
        </Pressable>
      </View>
      <View style={styles.writtenPromptContent}>
        {isPromptListOpen ? (
          <ScrollView
            style={styles.promptList}
            contentContainerStyle={styles.promptListContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoadingPrompts ? (
              <ActivityIndicator
                accessibilityLabel="Loading prompts"
                size="large"
                color="#2dbcc4"
                style={styles.promptListLoading}
              />
            ) : promptError ? (
              <View style={styles.promptListError}>
                <Text style={styles.promptListErrorText}>{promptError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadPrompts()}
                >
                  <Text style={styles.industryRetryText}>Retry</Text>
                </Pressable>
              </View>
            ) : prompts.length ? (
              prompts.map((prompt, index) => (
                <Pressable
                  key={`${String(prompt.id)}-${index}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: selectedPrompt === prompt.text,
                  }}
                  onPress={() => {
                    setSelectedPrompt(prompt.text);
                    setIsPromptListOpen(false);
                  }}
                  style={styles.promptListItem}
                >
                  <Text style={styles.promptListItemText}>{prompt.text}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.promptListEmpty}>No prompts available.</Text>
            )}
          </ScrollView>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select a prompt"
              accessibilityState={{ expanded: false }}
              onPress={openPromptList}
              style={styles.promptSelector}
            >
              <Text style={styles.promptSelectorText}>
                {selectedPrompt || "Select A Prompt"}
              </Text>
              <Image
                source={require("../assets/edit.png")}
                style={styles.promptEditIcon}
                resizeMode="contain"
              />
            </Pressable>
            <TextInput
              accessibilityLabel="Prompt answer"
              multiline
              placeholder="Write your answer here"
              placeholderTextColor="#7d879e"
              textAlignVertical="top"
              value={answer}
              onChangeText={setAnswer}
              style={styles.promptAnswerInput}
            />
          </>
        )}
      </View>
    </View>
  );
}

const MATCHING_GOALS = [
  "Looking for a cofounder to join an existing idea",
  "Have some ideas but open to exploring",
  "Exploring new ideas",
  "Open to chatting",
];

const COMMITMENT_LEVELS = [
  "Already full-time on a startup",
  "Ready to go full-time with the right cofounder",
  "Ready to go full-time in the next year",
  "No specific startup plans yet",
];

const MIN_FOUNDERS = 0;
const MAX_FOUNDERS = 10;
const SKILL_OPTIONS = [
  "AI/ML",
  "Design",
  "Engineering",
  "Operations",
  "Sales/Marketing",
];
const EQUITY_SPLIT_OPTIONS = [
  "Fully Negotiable",
  "Equal split",
  "Willing to accept a specific equity range",
  "Willing to offer specific equity range",
];

function MatchingGoalEditScreen({
  initialGoal,
  initialHiring,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [selectedGoal, setSelectedGoal] = useState(initialGoal);
  const [isHiring, setIsHiring] = useState(initialHiring);
  const [matchingGoals, setMatchingGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const MATCHING_GOALS_ENDPOINT = "/matching-goals";

  useEffect(() => {
    let isMounted = true;

    const fetchMatchingGoals = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await apiFetch(MATCHING_GOALS_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load matching goals: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        // Extract matching_goal field from each dictionary
        const goals = list
          .map((item) => String(item?.matching_goal || "").trim())
          .filter(Boolean);

        if (isMounted) {
          setMatchingGoals(goals);
          // Preserve initial selection if it's still valid in the new list
          if (initialGoal && !goals.includes(initialGoal)) {
            // If initial goal is not in the new list, keep it anyway (fallback)
            setSelectedGoal(initialGoal);
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load matching goals. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMatchingGoals();

    return () => {
      isMounted = false;
    };
  }, [retryKey]);

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(selectedGoal, isHiring)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Matching Goal</Text>
        <View style={styles.headlineDoneAction} />
      </View>
      <View style={styles.matchingGoalContent}>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading matching goals"
            size="large"
            color="#2dbcc4"
            style={styles.matchingGoalLoading}
          />
        ) : errorMessage ? (
          <View style={styles.matchingGoalError}>
            <Text style={styles.matchingGoalErrorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
            >
              <Text style={styles.industryRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.matchingGoalSubtitle}>
              Select Your matching goal
            </Text>
            {matchingGoals.map((goal) => {
              const selected = selectedGoal === goal;
              return (
                <Pressable
                  key={goal}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedGoal(goal)}
                  style={[
                    styles.matchingGoalOption,
                    selected && styles.matchingGoalOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.matchingGoalOptionText,
                      selected && styles.matchingGoalOptionTextSelected,
                    ]}
                  >
                    {goal}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={styles.hiringQuestion}>Are you hiring?</Text>
            {[true, false].map((hiring) => (
              <Pressable
                key={String(hiring)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isHiring === hiring }}
                onPress={() => setIsHiring(hiring)}
                style={styles.hiringOption}
              >
                <View
                  style={[
                    styles.hiringRadio,
                    isHiring === hiring && styles.hiringRadioSelected,
                  ]}
                >
                  {isHiring === hiring ? (
                    <View style={styles.hiringRadioDot} />
                  ) : null}
                </View>
                <Text style={styles.hiringOptionText}>
                  {hiring ? "Yes" : "No"}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

function CommitmentLevelEditScreen({ initialLevel, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [selectedLevel, setSelectedLevel] = useState(initialLevel);
  const [commitmentLevels, setCommitmentLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const COMMITMENT_LEVELS_ENDPOINT = "/commitment-levels";

  useEffect(() => {
    let isMounted = true;

    const fetchCommitmentLevels = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await apiFetch(COMMITMENT_LEVELS_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load commitment levels: ${response.status}`,
          );
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        // Extract commitment_level field from each dictionary
        const levels = list
          .map((item) => String(item?.commitment_level || "").trim())
          .filter(Boolean);

        if (isMounted) {
          setCommitmentLevels(levels);
          // Preserve initial selection if it's still valid in the new list
          if (initialLevel && !levels.includes(initialLevel)) {
            // If initial level is not in the new list, keep it anyway (fallback)
            setSelectedLevel(initialLevel);
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage(
            "Could not load commitment levels. Please try again.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCommitmentLevels();

    return () => {
      isMounted = false;
    };
  }, [retryKey, initialLevel]);

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(selectedLevel)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Commitment Level</Text>
        <View style={styles.headlineDoneAction} />
      </View>
      <View style={styles.matchingGoalContent}>
        <Text style={styles.matchingGoalSubtitle}>
          Select Your Commitment Level
        </Text>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading commitment levels"
            size="large"
            color="#2dbcc4"
            style={styles.matchingGoalLoading}
          />
        ) : errorMessage ? (
          <View style={styles.matchingGoalError}>
            <Text style={styles.matchingGoalErrorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
            >
              <Text style={styles.industryRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {commitmentLevels.map((level) => {
              const selected = selectedLevel === level;
              return (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedLevel(level)}
                  style={[
                    styles.matchingGoalOption,
                    selected && styles.matchingGoalOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.matchingGoalOptionText,
                      selected && styles.matchingGoalOptionTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </View>
    </View>
  );
}

function PriorStartupExperienceEditScreen({
  initialExperience,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [selectedExperience, setSelectedExperience] = useState(initialExperience);
  const [priorStartupOptions, setPriorStartupOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const PRIOR_STARTUP_EXPERIENCES_ENDPOINT = "/prior-startup-experiences";

  useEffect(() => {
    let isMounted = true;

    const fetchPriorStartupExperiences = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await apiFetch(PRIOR_STARTUP_EXPERIENCES_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load prior startup experiences: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        // Extract experience field from each dictionary or use string if it's an array of strings
        const options = list.map((item) =>
          typeof item === "string" ? item : String(item?.label || item?.name || item?.prior_startup_experience || "").trim()
        ).filter(Boolean);

        if (isMounted) {
          setPriorStartupOptions(options);
          // Preserve initial selection if it's still valid in the new list
          if (initialExperience && !options.includes(initialExperience)) {
            // If initial experience is not in the new list, keep it anyway (fallback)
            setSelectedExperience(initialExperience);
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load prior startup experiences. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPriorStartupExperiences();

    return () => {
      isMounted = false;
    };
  }, [retryKey, initialExperience]);

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(selectedExperience)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Prior Startup Experience</Text>
        <View style={styles.headlineDoneAction} />
      </View>
      <View style={styles.priorExperienceContent}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator
              accessibilityLabel="Loading prior startup experiences"
              size="large"
              color="#2dbcc4"
              style={{ marginBottom: 20 }}
            />
            <Text style={styles.profileFieldSubtitle}>Loading...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.screen}>
            <View style={{ padding: 20 }}>
              <Text style={styles.profileFieldSubtitle}>
                {errorMessage}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry"
                onPress={() => setRetryKey((current) => current + 1)}
                style={styles.profileFieldDone}
              >
                <Text style={styles.saveText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.priorExperienceQuestion}>
              Do you have any startup experience?
            </Text>
            {priorStartupOptions.map((option) => {
              const selected = selectedExperience === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedExperience(option)}
                  style={[
                    styles.priorExperienceOption,
                    selected && styles.matchingGoalOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.matchingGoalOptionText,
                      styles.priorExperienceOptionText,
                      selected && styles.matchingGoalOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </View>
    </View>
  );
}

function NumberOfFoundersEditScreen({ initialCount, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [founderCount, setFounderCount] = useState(initialCount);

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(founderCount)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Number of Founders</Text>
        <View style={styles.headlineDoneAction} />
      </View>
      <View style={styles.founderCountContent}>
        <Text style={styles.founderCountStatus}>Not Selected</Text>
        <Text style={styles.founderCountQuestion}>
          How many founders in your team now?
        </Text>
        <View style={styles.founderCounter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease founder count"
            accessibilityState={{ disabled: founderCount <= MIN_FOUNDERS }}
            disabled={founderCount <= MIN_FOUNDERS}
            onPress={() =>
              setFounderCount((count) => Math.max(MIN_FOUNDERS, count - 1))
            }
            style={styles.founderCounterButton}
          >
            <Text style={styles.founderCounterMinus}>-</Text>
          </Pressable>
          <Text
            accessibilityLabel="Founder count"
            style={styles.founderCounterValue}
          >
            {founderCount}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase founder count"
            accessibilityState={{ disabled: founderCount >= MAX_FOUNDERS }}
            disabled={founderCount >= MAX_FOUNDERS}
            onPress={() =>
              setFounderCount((count) => Math.min(MAX_FOUNDERS, count + 1))
            }
            style={styles.founderCounterButton}
          >
            <Text style={styles.founderCounterPlus}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function toSkillModel(item) {
  const label = String(
    item?.skill_name || item?.skillName || item?.skillName || item?.name || "",
  ).trim();
  if (!label) {
    return null;
  }
  return { value: item?.id ?? label, label };
}

function SkillsExpertiseEditScreen({
  firebaseToken,
  initialSkills,
  initialOptions,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [skillOptions, setSkillOptions] = useState(initialOptions);
  const [selectedSkills, setSelectedSkills] = useState(initialSkills);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const USER_SKILLS_ENDPOINT = "/users/me/profile/skills";
  const MAX_SKILLS_SELECTION = 5;

  useEffect(() => {
    let isMounted = true;

    async function loadUserSkills() {
      setLoading(true);
      setErrorMessage("");

      try {
        const [skillsPayload, selectedPayload] = await Promise.all([
          getUserSkills(firebaseToken),
          getUserProfileSelectedSkills(firebaseToken),
        ]);
        const mapped = skillsPayload.map(toSkillModel).filter(Boolean);
        const selected = selectedPayload
          .map(toSkillModel)
          .filter(Boolean)
          .map(
            (skill) =>
              mapped.find(
                (option) =>
                  option.value === skill.value || option.label === skill.label,
              )?.value,
          )
          .filter((value) => value !== undefined)
          .slice(0, MAX_SKILLS_SELECTION);

        if (isMounted) {
          setSkillOptions(mapped);
          setSelectedSkills(selected);
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load user skills. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadUserSkills();
    return () => {
      isMounted = false;
    };
  }, [firebaseToken, retryKey]);

  function toggleSkill(value) {
    setSelectedSkills((prev) => {
      if (prev.includes(value)) {
        setSelectionMessage("");
        return prev.filter((skill) => skill !== value);
      }

      if (prev.length >= 5) {
        setSelectionMessage("Sorry. You can select upto 5 skills");
        return prev;
      }

      setSelectionMessage("");
      return [...prev, value];
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(selectedSkills, skillOptions)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Skills &amp; Expertise</Text>
        <View style={styles.headlineDoneAction} />
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.skillsExpertiseContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading skills"
            size="large"
            color="#2dbcc4"
            style={styles.skillsLoading}
          />
        ) : errorMessage ? (
          <View style={styles.skillsError}>
            <Text style={styles.skillsErrorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
            >
              <Text style={styles.industryRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {selectionMessage ? (
              <Text style={styles.skillsSelectionMessage}>
                {selectionMessage}
              </Text>
            ) : null}
            <View style={styles.skillsOptions}>
              {skillOptions.map((skill) => {
                const selected = selectedSkills.includes(skill.value);
                return (
                  <Pressable
                    key={String(skill.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggleSkill(skill.value)}
                    style={[
                      styles.skillsOption,
                      selected && styles.skillsOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.skillsOptionText,
                        selected && styles.skillsOptionTextSelected,
                      ]}
                    >
                      {skill.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.skillsHelper}>
              Include skills and expertise that your cofounders own, if
              applicable
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function toIndustryModel(item) {
  const label = String(
    item?.industry_name || item?.industryName || item?.name || "",
  ).trim();
  if (!label) {
    return null;
  }
  return { value: item?.id ?? label, label };
}

function IndustriesInterestsEditScreen({
  firebaseToken,
  initialIndustries,
  initialOptions,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [industryOptions, setIndustryOptions] = useState(initialOptions);
  const [selectedIndustries, setSelectedIndustries] =
    useState(initialIndustries);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadIndustries() {
      setLoading(true);
      setErrorMessage("");
      try {
        const [industriesPayload, selectedPayload] = await Promise.all([
          getIndustries(firebaseToken),
          getUserProfileSelectedIndustries(firebaseToken),
        ]);
        const mapped = industriesPayload.map(toIndustryModel).filter(Boolean);
        const selected = selectedPayload
          .map(toIndustryModel)
          .filter(Boolean)
          .map(
            (industry) =>
              mapped.find(
                (option) =>
                  option.value === industry.value ||
                  option.label === industry.label,
              )?.value,
          )
          .filter((value) => value !== undefined)
          .slice(0, MAX_INDUSTRY_SELECTION);

        if (isMounted) {
          setIndustryOptions(mapped);
          setSelectedIndustries(selected);
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load industries. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadIndustries();
    return () => {
      isMounted = false;
    };
  }, [firebaseToken, retryKey]);

  function toggleIndustry(value) {
    setSelectedIndustries((current) => {
      if (current.includes(value)) {
        setSelectionMessage("");
        return current.filter((industry) => industry !== value);
      }

      if (current.length >= MAX_INDUSTRY_SELECTION) {
        setSelectionMessage(
          `Sorry. You can select upto ${MAX_INDUSTRY_SELECTION} industries`,
        );
        return current;
      }

      setSelectionMessage("");
      return [...current, value];
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(selectedIndustries, industryOptions)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Industries &amp; Interests</Text>
        <View style={styles.headlineDoneAction} />
      </View>
      <ScrollView
        contentContainerStyle={styles.industryInterestContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading industries"
            size="large"
            color="#2dbcc4"
            style={styles.industryLoading}
          />
        ) : errorMessage ? (
          <View style={styles.industryError}>
            <Text style={styles.industryErrorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
            >
              <Text style={styles.industryRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {selectionMessage ? (
              <Text style={styles.industrySelectionMessage}>
                {selectionMessage}
              </Text>
            ) : null}
            <View style={styles.industryPills}>
              {industryOptions.map((industry) => {
                const selected = selectedIndustries.includes(industry.value);
                return (
                  <Pressable
                    key={String(industry.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggleIndustry(industry.value)}
                    style={[
                      styles.industryPill,
                      selected && styles.industryPillSelected,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.industryPillText,
                        selected && styles.industryPillTextSelected,
                      ]}
                    >
                      {industry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function EquityRangeSlider({ range, onRangeChange, styles }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(trackWidth);
  trackWidthRef.current = trackWidth;
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const initialRangeRef = useRef(range);
  const rangeSpan = 80;

  function createHandleResponder(handle) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialRangeRef.current = rangeRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!trackWidthRef.current) {
          return;
        }
        const delta =
          Math.round(
            ((gestureState.dx / trackWidthRef.current) * rangeSpan) / 5,
          ) * 5;
        const startRange = initialRangeRef.current;
        const nextValue = Math.max(
          10,
          Math.min(90, startRange[handle] + delta),
        );
        onRangeChange((currentRange) => {
          const nextRange = [...currentRange];
          nextRange[handle] =
            handle === 0
              ? Math.min(nextValue, currentRange[1] - 5)
              : Math.max(nextValue, currentRange[0] + 5);
          return nextRange;
        });
      },
    });
  }

  const lowerHandleResponder = useMemo(
    () => createHandleResponder(0),
    [onRangeChange],
  );
  const upperHandleResponder = useMemo(
    () => createHandleResponder(1),
    [onRangeChange],
  );

  return (
    <View style={styles.equityRangeContainer}>
      <View style={styles.equityRangeLabels}>
        <Text style={styles.equityRangeTitle}>Equity Range</Text>
        <Text style={styles.equityRangeValue}>
          {range[0]}% to {range[1]}%
        </Text>
      </View>
      <View
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={styles.equitySliderTrack}
      >
        <View style={styles.equitySliderLine} />
        <View
          {...lowerHandleResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Minimum equity"
          accessibilityValue={{ min: 10, max: range[1] - 5, now: range[0] }}
          style={[
            styles.equitySliderHandle,
            { left: `${((range[0] - 10) / rangeSpan) * 100}%` },
          ]}
        />
        <View
          {...upperHandleResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Maximum equity"
          accessibilityValue={{ min: range[0] + 5, max: 90, now: range[1] }}
          style={[
            styles.equitySliderHandle,
            { left: `${((range[1] - 10) / rangeSpan) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

function EquitySplitEditScreen({
  initialOption,
  initialRange,
  onDone,
  metrics,
}) {
  const styles = createStyles(metrics);
  const [selectedOption, setSelectedOption] = useState(initialOption);
  const [equityRange, setEquityRange] = useState(initialRange);
  const [equitySplitOptions, setEquitySplitOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const EQUITY_SPLIT_ENDPOINT = "/equity-split";

  useEffect(() => {
    let isMounted = true;

    const fetchEquitySplitOptions = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await apiFetch(EQUITY_SPLIT_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load equity split options: ${response.status}`,
          );
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        // Handle both string arrays and object arrays
        let options = [];
        if (list.length > 0) {
          if (typeof list[0] === "string") {
            // Array of strings
            options = list.map((item) => String(item).trim()).filter(Boolean);
          } else if (typeof list[0] === "object" && list[0] !== null) {
            // Array of objects - try common field names
            options = list
              .map((item) =>
                String(
                  item?.equity_split_option ||
                    item?.option ||
                    item?.label ||
                    item?.name ||
                    item?.value ||
                    "",
                ).trim(),
              )
              .filter(Boolean);
          }
        }

        // Fallback to default options if API returns empty array
        if (options.length === 0) {
          options = [
            "Fully Negotiable",
            "Equal split",
            "Willing to accept a specific equity range",
            "Willing to offer specific equity range",
          ];
        }

        if (isMounted) {
          setEquitySplitOptions(options);
          // Preserve initial selection if it's still valid in the new list
          if (initialOption && !options.includes(initialOption)) {
            // If initial option is not in the new list, keep it anyway (fallback)
            setSelectedOption(initialOption);
          }
        }
      } catch {
        if (isMounted) {
          // Fallback to default options on error
          setEquitySplitOptions([
            "Fully Negotiable",
            "Equal split",
            "Willing to accept a specific equity range",
            "Willing to offer specific equity range",
          ]);
          // Preserve initial selection if it's still valid in the fallback list
          if (
            initialOption &&
            ![
              "Fully Negotiable",
              "Equal split",
              "Willing to accept a specific equity range",
              "Willing to offer specific equity range",
            ].includes(initialOption)
          ) {
            setSelectedOption(initialOption);
          }
          setErrorMessage(
            "Could not load equity split options. Please try again.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEquitySplitOptions();

    return () => {
      isMounted = false;
    };
  }, [retryKey, initialOption]);

  const rangeQuestion =
    selectedOption === equitySplitOptions[2]
      ? "What is your equity expectation range?"
      : selectedOption === equitySplitOptions[3]
        ? "What's your equity offer range?"
        : "";

  return (
    <View style={styles.screen}>
      <View style={styles.headlineEditorHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => onDone(selectedOption, equityRange)}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.headlineBackIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Equity Split</Text>
        <View style={styles.headlineDoneAction} />
      </View>
      <View style={styles.equitySplitContent}>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading equity split options"
            size="large"
            color="#2dbcc4"
            style={styles.matchingGoalLoading}
          />
        ) : errorMessage ? (
          <View style={styles.matchingGoalError}>
            <Text style={styles.matchingGoalErrorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
            >
              <Text style={styles.industryRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.equityQuestion}>
              What’s your equity split expectation?
            </Text>
            <View style={styles.equityOptions}>
              {equitySplitOptions.map((option) => {
                const selected = selectedOption === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setSelectedOption(option)}
                    style={styles.equityOption}
                  >
                    <View
                      style={[
                        styles.equityRadio,
                        selected && styles.equityRadioSelected,
                      ]}
                    >
                      {selected ? <View style={styles.equityRadioDot} /> : null}
                    </View>
                    <Text style={styles.equityOptionText}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            {rangeQuestion ? (
              <>
                <Text style={styles.equityRangeQuestion}>{rangeQuestion}</Text>
                <EquityRangeSlider
                  range={equityRange}
                  onRangeChange={setEquityRange}
                  styles={styles}
                />
              </>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

export default function ProfileEditScreen({
  profile = {},
  profileImageUrl = "",
  firebaseToken = "",
  initialDateOfBirth = "",
  onClose,
  onSave,
}) {
  const metrics = useResponsiveMetrics();
  const styles = createStyles(metrics);
  const initialStartupExperience = getProfileTextList(
    profile?.startupExperiences || profile?.startup_experiences || profile?.startup_experience,
  ).join(", ");
  const initialRole = profile?.userRole || profile?.user_role || profile?.role;
  const [activeTab, setActiveTab] = useState("Edit");
  const [selectedRole, setSelectedRole] = useState(() => {
    if (typeof initialRole === "string" && initialRole.trim()) {
      return initialRole.trim();
    }
    if (initialRole && typeof initialRole === "object") {
      const roleLabel =
        initialRole.described_as || initialRole.label || initialRole.name;
      if (typeof roleLabel === "string" && roleLabel.trim()) {
        return roleLabel.trim();
      }
    }
    return "Founder";
  });
  const selectedRoleLabel =
    typeof selectedRole === "string" && selectedRole.trim()
      ? selectedRole.trim()
      : "Founder";
  const [headline, setHeadline] = useState(profile?.headline || profile?.title || "");
  const [idea, setIdea] = useState(profile?.startupIdea || profile?.startup_idea || "");
  const [isEditingHeadline, setIsEditingHeadline] = useState(false);
  const [isEditingIdea, setIsEditingIdea] = useState(false);
  const [editingPromptIndex, setEditingPromptIndex] = useState(null);
  const [isEditingMatchingGoal, setIsEditingMatchingGoal] = useState(false);
  const [isEditingCommitmentLevel, setIsEditingCommitmentLevel] =
    useState(false);
  const [isEditingPriorStartupExperience, setIsEditingPriorStartupExperience] =
    useState(false);
  const [isEditingFounderCount, setIsEditingFounderCount] = useState(false);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [isEditingIndustries, setIsEditingIndustries] = useState(false);
  const [isEditingEquitySplit, setIsEditingEquitySplit] = useState(false);
  const [isEditingJobSearchProfile, setIsEditingJobSearchProfile] =
    useState(false);
  const [isEditingBioExperience, setIsEditingBioExperience] = useState(false);
  const [isEditingProfileExperience, setIsEditingProfileExperience] =
    useState(false);
  const [isEditingProfileEducation, setIsEditingProfileEducation] =
    useState(false);
  const [editingExperienceIndex, setEditingExperienceIndex] = useState(undefined);
  const [editingEducationIndex, setEditingEducationIndex] = useState(undefined);
  const [isEditingCompensation, setIsEditingCompensation] = useState(false);
  const [isEditingCompanySize, setIsEditingCompanySize] = useState(false);
  const [isEditingWorkAuthorization, setIsEditingWorkAuthorization] =
    useState(false);
  const [workAuthorization, setWorkAuthorization] = useState(() =>
    profile?.workAuthorization ??
    profile?.work_authorization ??
    profile?.work_authorization_name ??
    profile?.work_authorization_id ??
    TALENT_BACKGROUND_ROWS.find((row) =>
      row.title.startsWith("Work Authorization"),
    )?.value ??
    "",
  );
  const [editingProfileField, setEditingProfileField] = useState("");
  const [matchingGoal, setMatchingGoal] = useState(
    profile?.matchingGoal || profile?.matching_goal || "Have some ideas but open to exploring",
  );
  const [commitmentLevel, setCommitmentLevel] = useState(
    profile?.timeCommitment || profile?.time_commitment || "Ready to go full-time with the right cofounder",
  );
  const [priorStartupExperience, setPriorStartupExperience] = useState(
    initialStartupExperience || "No prior startup experience",
  );
  const [founderCount, setFounderCount] = useState(0);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [initialSkills, setInitialSkills] = useState([]);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [skillOptions, setSkillOptions] = useState([]);
  const [equitySplitOption, setEquitySplitOption] = useState("");
  const [equityRange, setEquityRange] = useState([10, 90]);
  const [jobSearchProfile, setJobSearchProfile] = useState({
    status: JOB_SEARCH_STATUS_OPTIONS[0],
    workTypes: ["Full Time", "Part Time"],
    foundersOnly: true,
  });
  const [bioExperience, setBioExperience] = useState(() => ({
    fundingStage:
      profile?.fundingStage ??
      profile?.funding_stage_name ??
      profile?.funding_stage_id ??
      "",
    riskAppetite:
      profile?.riskAppetite ??
      profile?.risk_appetite_name ??
      profile?.risk_appetite_id ??
      "",
    employmentType:
      profile?.employmentType ??
      profile?.employment_type_name ??
      profile?.employment_type_id ??
      "",
    companyName: String(
      profile?.companyName ?? profile?.company_name ?? "",
    ),
    location: String(
      profile?.experienceLocation ??
        profile?.experience_location ??
        profile?.linkedinProfilePreview?.firstLocation ??
        "",
    ),
    locationType:
      profile?.locationType ??
      profile?.location_type_name ??
      profile?.location_type_id ??
      "",
    startDate: profile?.startDate ?? profile?.start_date ?? "",
    currentlyWorkHere: [true, 1, "true"].includes(
      profile?.currentlyWorkHere ?? profile?.currently_work_here ?? false,
    ),
    endDate: profile?.endDate ?? profile?.end_date ?? "",
    title: String(profile?.title ?? ""),
    primaryRole:
      profile?.primaryRole ??
      profile?.primary_role_name ??
      profile?.primary_role_id ??
      "",
    yearsOfExperience: String(
      profile?.yearsOfExperience ?? profile?.years_of_experience ?? "",
    ),
    secondaryRole:
      profile?.secondaryRole ??
      profile?.secondary_role_name ??
      profile?.secondary_role_id ??
      "",
    bio: String(profile?.bio ?? ""),
    startupIdea: String(profile?.startupIdea ?? profile?.startup_idea ?? ""),
  }));
  const [compensation, setCompensation] = useState(() => {
    const values = profile?.compensation || profile || {};
    const cashExpectation =
      values.cash_equity_expectation ??
      values.cashEquityExpectation ??
      "";
    const salaryDuration =
      values.salary_duration ?? values.salaryDuration ?? "";
    const currency = values.currency || {};

    return {
      cashEquityExpectationId:
        values.cash_equity_expectation_id ??
        values.cashEquityExpectationId ??
        (typeof cashExpectation === "object" ? cashExpectation.id : null),
      cashEquityExpectation:
        typeof cashExpectation === "object"
          ? cashExpectation.cash_equity_expectation ?? cashExpectation.label ?? ""
          : cashExpectation,
      minimumSalaryPreference:
        values.minimumSalaryPreference ??
        values.expectedMinimumSalaryPreference ??
        values.expected_minimum_salary_preference ??
        "",
      expectedMinimumSalary: String(
        values.expected_minimum_salary ??
          values.expectedMinimumSalary ??
          "",
      ),
      expectedMinimumSalaryId:
        values.expected_minimum_salary_id ??
        values.expectedMinimumSalaryId ??
        null,
      salaryDurationId:
        values.salary_duration_id ??
        values.salaryDurationId ??
        (typeof salaryDuration === "object" ? salaryDuration.id : null),
      salaryDuration:
        typeof salaryDuration === "object"
          ? salaryDuration.salary_duration ?? salaryDuration.label ?? ""
          : salaryDuration,
      currencyId:
        values.currency_id ??
        values.currencyId ??
        currency.currency_id ??
        currency.id ??
        null,
      currencyCode:
        values.currency_code ??
        values.currencyCode ??
        currency.currency_code ??
        "",
      currencyName:
        values.currency_name ?? currency.currency_name ?? "",
      currencySymbol:
        values.currency_symbol ?? currency.currency_symbol ?? "",
    };
  });
  const [companySizeInterests, setCompanySizeInterests] = useState(() =>
    normalizeCompanySizeSelections(
      profile?.companySizeInterests ??
        profile?.companySizeInterestLevels ??
        profile?.company_size_interests ??
        profile?.company_size_interest_levels ??
        profile?.company_size_interest_level ??
        {},
    ),
  );
  const [isHiring, setIsHiring] = useState(true);
  const [promptAnswers, setPromptAnswers] = useState(() =>
    PROMPT_SLOTS.map(() => ""),
  );
  const [promptTitles, setPromptTitles] = useState(() =>
    PROMPT_SLOTS.map(() => ""),
  );
  const [profileName, setProfileName] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState(() =>
    normalizeProfileDateOfBirth(initialDateOfBirth),
  );
  const [profilePhoto, setProfilePhoto] = useState(() => ({
    profileImageUri:
      profileImageUrl ||
      profile?.profileImageUri ||
      profile?.profile_image_uri ||
      "",
    profileImageSource:
      profile?.profileImageSource || profile?.profile_image_source || "",
    profileImageRotation: Number(
      profile?.profileImageRotation ?? profile?.profile_image_rotation ?? 0,
    ),
    profileImageScale: Number(
      profile?.profileImageScale ?? profile?.profile_image_scale ?? 1,
    ),
    profileImageTranslateX: Number(
      profile?.profileImageTranslateX ?? profile?.profile_image_translate_x ?? 0,
    ),
    profileImageTranslateY: Number(
      profile?.profileImageTranslateY ?? profile?.profile_image_translate_y ?? 0,
    ),
    profileImageCropRect:
      profile?.profileImageCropRect ?? profile?.profile_image_crop_rect ?? null,
  }));
  const [profilePhotoDraft, setProfilePhotoDraft] = useState({});
  const [profilePhotoFlowStep, setProfilePhotoFlowStep] = useState("profile");
  const [openProfilePhotoSourceMenu, setOpenProfilePhotoSourceMenu] =
    useState(false);
  const [profileLocation, setProfileLocation] = useState(
    profile?.locationPreference ?? null,
  );
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedinUrl ?? profile?.linkedin_url ?? "");
  const [schedulingLink, setSchedulingLink] = useState(undefined);
  const [profileExperiences, setProfileExperiences] = useState([]);
  const [profileEducation, setProfileEducation] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loadingRoleOptions, setLoadingRoleOptions] = useState(true);
  const [errorMessageRoleOptions, setErrorMessageRoleOptions] = useState("");
  const [retryKeyRoleOptions, setRetryKeyRoleOptions] = useState(0);
  const locationSummary = getLocationSummary(profile, profileLocation);
  const profileScrollOffset = useRef(0);
  const editable = activeTab === "Edit";

  useEffect(() => {
    async function fetchLinkedinDetails() {
      if (firebaseToken) {
        try {
          const data = await getMyProfileLinkedinDetails(firebaseToken);

          // Transform experience
          const experiences = (data.experience || []).map((exp) => {
            // Format dates
            let datesStr = "";
            if (exp.start_date) {
              const startMonth = new Date(
                exp.start_date.year,
                exp.start_date.month - 1,
              ).toLocaleString("en-US", { month: "short" });
              const startYear = exp.start_date.year;
              if (exp.end_date && !exp.is_current) {
                const endMonth = new Date(
                  exp.end_date.year,
                  exp.end_date.month - 1,
                ).toLocaleString("en-US", { month: "short" });
                const endYear = exp.end_date.year;
                datesStr = `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
              } else {
                datesStr = `${startMonth} ${startYear} - Present`;
              }
              // Add duration if available
              if (exp.duration) {
                datesStr += ` · ${exp.duration}`;
              }
            }
            return {
              title: exp.title || "",
              company: exp.company || "",
              organization: exp.company || "",
              dates: datesStr,
              description: exp.description || "",
              startDate: normalizeProfileHistoryDate(exp.start_date),
              endDate: normalizeProfileHistoryDate(exp.end_date),
              currentlyWorkInRole: Boolean(
                exp.is_current || (exp.start_date && !exp.end_date),
              ),
              isCurrent: Boolean(
                exp.is_current || (exp.start_date && !exp.end_date),
              ),
              muted: false,
            };
          });

          // Transform education
          const education = (data.education || []).map((edu) => {
            let datesStr = "";
            if (edu.start_date) {
              const startMonth = new Date(
                edu.start_date.year,
                edu.start_date.month - 1,
              ).toLocaleString("en-US", { month: "short" });
              const startYear = edu.start_date.year;
              if (edu.end_date) {
                const endMonth = new Date(
                  edu.end_date.year,
                  edu.end_date.month - 1,
                ).toLocaleString("en-US", { month: "short" });
                const endYear = edu.end_date.year;
                datesStr = `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
              } else {
                datesStr = `${startMonth} ${startYear} - Present`;
              }
            }
            return {
              title: edu.school || "",
              organization: edu.degree_name || edu.degree || "",
              dates: datesStr,
              description: edu.field_of_study || "",
              muted: false,
            };
          });

          setProfileExperiences(experiences);
          setProfileEducation(education);
        } catch (error) {
          console.error("Failed to fetch LinkedIn details", error);
        }
      }
    }
    fetchLinkedinDetails();
  }, [firebaseToken]);

  useEffect(() => {
    async function fetchUserSkills() {
      if (firebaseToken) {
        try {
          const [skillsPayload, selectedPayload] = await Promise.all([
            getUserSkills(firebaseToken),
            getUserProfileSelectedSkills(firebaseToken),
          ]);
          const mapped = skillsPayload.map(toSkillModel).filter(Boolean);
          const selected = selectedPayload
            .map(toSkillModel)
            .filter(Boolean)
            .map(
              (skill) =>
                mapped.find(
                  (option) =>
                    option.value === skill.value ||
                    option.label === skill.label,
                )?.value,
            )
            .filter((value) => value !== undefined)
            .slice(0, MAX_SKILLS_SELECTION);

          const initialSkills = selectedPayload
            .map(toSkillModel)
            .filter(Boolean)
            .map(
              (skill) =>
                mapped.find(
                  (option) =>
                    option.value === skill.value ||
                    option.label === skill.label,
                )?.label,
            )
            .filter((value) => value !== undefined)
            .slice(0, MAX_SKILLS_SELECTION);

          setSkillOptions(mapped);
          setSelectedSkills(selected);
          setInitialSkills(initialSkills);
        } catch (error) {
          console.error("Failed to fetch user skills", error);
        }
      }
    }
    fetchUserSkills();
  }, [firebaseToken]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoleOptions = async () => {
      try {
        setLoadingRoleOptions(true);
        setErrorMessageRoleOptions("");

        const response = await apiFetch("/user-described-as", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load role options: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        // Normalize string and object responses to the same option shape.
        let options = list
          .map((item, index) => {
            const describedAs =
              typeof item === "string"
                ? item
                : item && typeof item === "object"
                  ? item.described_as || item.label || item.name || ""
                  : "";

            return {
              id: item && typeof item === "object" ? item.id ?? index + 1 : index + 1,
              described_as:
                typeof describedAs === "string" ? describedAs.trim() : "",
              icon: item && typeof item === "object" ? item.icon || null : null,
            };
          })
          .filter((option) => option.described_as !== "");

        // Fallback to default options if API returns empty array
        if (options.length === 0) {
          options = [
            { id: 1, described_as: "Founder", icon: "assets/bulb.png" },
            { id: 2, described_as: "Talent", icon: "assets/star.png" },
            { id: 3, described_as: "Both", icon: null },
          ];
        }

        if (isMounted) {
          setRoleOptions(options);
          const matchingOption = options.find(
            (option) =>
              option.described_as.toLowerCase() ===
              selectedRoleLabel.toLowerCase(),
          );
          if (matchingOption) {
            setSelectedRole(matchingOption.described_as);
          } else if (options.length > 0) {
            setSelectedRole(options[0].described_as);
          }
        }
      } catch {
        if (isMounted) {
          // Fallback to default options on error
          setRoleOptions([
            { id: 1, described_as: "Founder", icon: "assets/bulb.png" },
            { id: 2, described_as: "Talent", icon: "assets/star.png" },
            { id: 3, described_as: "Both", icon: null },
          ]);
          // Preserve initial selection if it's still valid in the fallback list
          const fallbackOptions = ["Founder", "Talent", "Both"];
          if (!fallbackOptions.includes(selectedRoleLabel)) {
            setSelectedRole("Founder"); // Reset to default
          }
          setErrorMessageRoleOptions(
            "Could not load role options. Please try again."
          );
        }
      } finally {
        if (isMounted) {
          setLoadingRoleOptions(false);
        }
      }
    };

    fetchRoleOptions();

    return () => {
      isMounted = false;
    };
  }, [retryKeyRoleOptions, selectedRole]);

  if (profilePhotoFlowStep === "upload") {
    return (
      <ProfilePhotoUploadScreen
        firebaseToken={firebaseToken}
        initialLinkedinProfilePictureUrl={
          profile?.linkedinProfilePreview?.profilePictureUrl ||
          profile?.linkedin_profile_picture_url ||
          ""
        }
        initialProfileImageUri={
          profilePhotoDraft.pendingProfileImageUri ||
          profilePhotoDraft.profileImageUri ||
          profilePhoto.profileImageUri
        }
        initialProfileImageSource={
          profilePhotoDraft.pendingProfileImageSource ||
          profilePhotoDraft.profileImageSource ||
          profilePhoto.profileImageSource
        }
        initialProfileImageRotation={
          profilePhotoDraft.profileImageRotation ??
          profilePhoto.profileImageRotation
        }
        initialProfileImageScale={
          profilePhotoDraft.profileImageScale ?? profilePhoto.profileImageScale
        }
        initialProfileImageTranslateX={
          profilePhotoDraft.profileImageTranslateX ??
          profilePhoto.profileImageTranslateX
        }
        initialProfileImageTranslateY={
          profilePhotoDraft.profileImageTranslateY ??
          profilePhoto.profileImageTranslateY
        }
        initialProfileImageCropRect={
          profilePhotoDraft.profileImageCropRect ??
          profilePhoto.profileImageCropRect
        }
        profileEditTheme
        openSourceMenuOnMount={openProfilePhotoSourceMenu}
        onBack={() => {
          setOpenProfilePhotoSourceMenu(false);
          setProfilePhotoFlowStep("profile");
        }}
        onContinue={(fields) => {
          if (fields?.pendingProfileImageUri) {
            setProfilePhotoDraft((current) => ({ ...current, ...fields }));
            setOpenProfilePhotoSourceMenu(false);
            setProfilePhotoFlowStep("edit");
            return;
          }

          setProfilePhoto((current) => ({ ...current, ...fields }));
          setProfilePhotoDraft({});
          setOpenProfilePhotoSourceMenu(false);
          setProfilePhotoFlowStep("profile");
        }}
      />
    );
  }

  if (profilePhotoFlowStep === "edit") {
    return (
      <ProfileEditPictureScreen
        initialImageUri={
          profilePhotoDraft.pendingProfileImageUri ||
          profilePhotoDraft.profileImageUri ||
          profilePhoto.profileImageUri
        }
        initialImageSource={
          profilePhotoDraft.pendingProfileImageSource ||
          profilePhotoDraft.profileImageSource ||
          profilePhoto.profileImageSource
        }
        initialRotation={
          profilePhotoDraft.profileImageRotation ?? profilePhoto.profileImageRotation
        }
        initialScale={
          profilePhotoDraft.profileImageScale ?? profilePhoto.profileImageScale
        }
        initialTranslateX={
          profilePhotoDraft.profileImageTranslateX ??
          profilePhoto.profileImageTranslateX
        }
        initialTranslateY={
          profilePhotoDraft.profileImageTranslateY ??
          profilePhoto.profileImageTranslateY
        }
        initialCropRect={
          profilePhotoDraft.profileImageCropRect ??
          profilePhoto.profileImageCropRect
        }
        profileEditTheme
        onBack={() => setProfilePhotoFlowStep("upload")}
        onContinue={(fields) => {
          setProfilePhotoDraft((current) => ({ ...current, ...fields }));
          setProfilePhotoFlowStep("upload");
        }}
      />
    );
  }

  if (isEditingHeadline) {
    return (
      <HeadlineEditScreen
        initialValue={headline}
        onBack={() => setIsEditingHeadline(false)}
        onDone={(value) => {
          setHeadline(value);
          setIsEditingHeadline(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingIdea) {
    return (
      <IdeaEditScreen
        initialValue={profile?.startupIdea}
        onBack={() => setIsEditingIdea(false)}
        onDone={(value) => {
          setIdea(value);
          setIsEditingIdea(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (editingPromptIndex !== null) {
    return (
      <WrittenPromptEditScreen
        firebaseToken={firebaseToken}
        initialPrompt={promptTitles[editingPromptIndex]}
        initialAnswer={promptAnswers[editingPromptIndex]}
        onDone={(prompt, answer) => {
          setPromptTitles((titles) =>
            titles.map((title, index) =>
              index === editingPromptIndex ? prompt : title,
            ),
          );
          setPromptAnswers((answers) =>
            answers.map((currentAnswer, index) =>
              index === editingPromptIndex ? answer : currentAnswer,
            ),
          );
          setEditingPromptIndex(null);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingMatchingGoal) {
    return (
      <MatchingGoalEditScreen
        initialGoal={matchingGoal}
        initialHiring={isHiring}
        onDone={(goal, hiring) => {
          setMatchingGoal(goal);
          setIsHiring(hiring);
          setIsEditingMatchingGoal(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingCommitmentLevel) {
    return (
      <CommitmentLevelEditScreen
        initialLevel={commitmentLevel}
        onDone={(level) => {
          setCommitmentLevel(level);
          setIsEditingCommitmentLevel(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingPriorStartupExperience) {
    return (
      <PriorStartupExperienceEditScreen
        initialExperience={priorStartupExperience}
        onDone={(experience) => {
          setPriorStartupExperience(experience);
          setIsEditingPriorStartupExperience(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingFounderCount) {
    return (
      <NumberOfFoundersEditScreen
        initialCount={founderCount}
        onDone={(count) => {
          setFounderCount(count);
          setIsEditingFounderCount(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingSkills) {
    return (
      <SkillsExpertiseEditScreen
        firebaseToken={firebaseToken}
        initialSkills={selectedSkills}
        initialOptions={skillOptions}
        onDone={(skills, options) => {
          setSelectedSkills(skills);
          setSkillOptions(options);
          setIsEditingSkills(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingIndustries) {
    return (
      <IndustriesInterestsEditScreen
        firebaseToken={firebaseToken}
        initialIndustries={selectedIndustries}
        initialOptions={industryOptions}
        onDone={(industries, options) => {
          setSelectedIndustries(industries);
          setIndustryOptions(options);
          setIsEditingIndustries(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingEquitySplit) {
    return (
      <EquitySplitEditScreen
        initialOption={equitySplitOption}
        initialRange={equityRange}
        onDone={(option, range) => {
          setEquitySplitOption(option);
          setEquityRange(range);
          setIsEditingEquitySplit(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingJobSearchProfile) {
    return (
      <JobSearchProfileEditScreen
        initialValue={jobSearchProfile}
        onBack={(value) => {
          setJobSearchProfile(value);
          setIsEditingJobSearchProfile(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingBioExperience) {
    return (
      <BioExperienceProfileEditScreen
        initialValue={bioExperience}
        onBack={() => setIsEditingBioExperience(false)}
        onDone={(value) => {
          setBioExperience(value);
          setIsEditingBioExperience(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingProfileExperience) {
    const experienceToEdit = profileExperiences[editingExperienceIndex] || {};
    const canRemoveExperience =
      editingExperienceIndex !== undefined &&
      editingExperienceIndex >= 0 &&
      editingExperienceIndex < profileExperiences.length;
    return (
      <ProfileHistoryItemEditScreen
        initialData={experienceToEdit}
        onBack={() => {
          setIsEditingProfileExperience(false);
          setEditingExperienceIndex(undefined);
        }}
        onRemove={
          canRemoveExperience
            ? () => {
                setProfileExperiences((current) =>
                  current.filter((_, index) => index !== editingExperienceIndex),
                );
                setIsEditingProfileExperience(false);
                setEditingExperienceIndex(undefined);
              }
            : undefined
        }
        onDone={(experience) => {
          const startDate = formatProfileExperienceDate(experience.startDate);
          const endDate = experience.currentlyWorkInRole
            ? "Present"
            : formatProfileExperienceDate(experience.endDate);
          setProfileExperiences((current) => {
            const hasExistingExperience =
              editingExperienceIndex !== undefined &&
              editingExperienceIndex >= 0 &&
              editingExperienceIndex < current.length;
            const updatedExperience = {
              ...(hasExistingExperience
                ? current[editingExperienceIndex]
                : {}),
              title: experience.title.trim(),
              company: experience.company.trim(),
              organization: experience.company.trim(),
              dates:
                startDate && endDate
                  ? `${startDate} - ${endDate}`
                  : startDate || endDate,
              description: experience.description.trim(),
              startDate: experience.startDate,
              endDate: experience.currentlyWorkInRole ? "" : experience.endDate,
              currentlyWorkInRole: experience.currentlyWorkInRole,
              isCurrent: experience.currentlyWorkInRole,
              muted: false,
            };

            if (hasExistingExperience) {
              const updated = [...current];
              updated[editingExperienceIndex] = updatedExperience;
              return updated;
            }
            return [...current, updatedExperience];
          });
          setIsEditingProfileExperience(false);
          setEditingExperienceIndex(undefined);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingProfileEducation) {
    // Find the education being edited (if any) to pass as initial data
    const educationToEdit = profileEducation[editingEducationIndex] || {};
    const canRemoveEducation =
      editingEducationIndex !== undefined &&
      editingEducationIndex >= 0 &&
      editingEducationIndex < profileEducation.length;
    return (
      <ProfileHistoryItemEditScreen
        type="education"
        initialData={educationToEdit}
        onBack={() => {
          setIsEditingProfileEducation(false);
          setEditingEducationIndex(undefined);
        }}
        onRemove={
          canRemoveEducation
            ? () => {
                setProfileEducation((current) =>
                  current.filter((_, index) => index !== editingEducationIndex),
                );
                setIsEditingProfileEducation(false);
                setEditingEducationIndex(undefined);
              }
            : undefined
        }
        onDone={(education) => {
          const startDate = formatProfileExperienceDate(education.startDate);
          const endDate = formatProfileExperienceDate(education.endDate);
          setProfileEducation((current) => {
            // If we're updating an existing education, replace it; otherwise add new
            if (editingEducationIndex !== undefined && editingEducationIndex >= 0) {
              const updated = [...current];
              updated[editingEducationIndex] = {
                title: education.school.trim(),
                organization: education.degree.trim(),
                fieldOfStudy: education.fieldOfStudy.trim(),
                dates: startDate || endDate ? `${startDate} - ${endDate}` : "",
                description: [
                  education.fieldOfStudy.trim(),
                  education.description.trim(),
                ]
                .filter(Boolean)
                .join(" · "),
                startDate: education.startDate,
                endDate: education.endDate,
                muted: false,
              };
              return updated;
            }
            return [
              ...current,
              {
                title: education.school.trim(),
                organization: education.degree.trim(),
                fieldOfStudy: education.fieldOfStudy.trim(),
                dates: startDate || endDate ? `${startDate} - ${endDate}` : "",
                description: [
                  education.fieldOfStudy.trim(),
                  education.description.trim(),
                ]
                .filter(Boolean)
                .join(" · "),
                startDate: education.startDate,
                endDate: education.endDate,
                muted: false,
              },
            ];
          });
          setIsEditingProfileEducation(false);
          setEditingEducationIndex(undefined);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingCompensation) {
    return (
      <CompensationEditScreen
        initialValue={compensation}
        onBack={() => setIsEditingCompensation(false)}
        onDone={(value) => {
          setCompensation(value);
          setIsEditingCompensation(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingCompanySize) {
    return (
      <CompanySizeProfileEditScreen
        initialValue={companySizeInterests}
        onBack={() => setIsEditingCompanySize(false)}
        onDone={(value) => {
          setCompanySizeInterests(value);
          setIsEditingCompanySize(false);
        }}
        metrics={metrics}
      />
    );
  }

  if (isEditingWorkAuthorization) {
    return (
      <WorkAuthorizationEditScreen
        initialValue={workAuthorization}
        onBack={() => setIsEditingWorkAuthorization(false)}
        onDone={(value) => {
          setWorkAuthorization(value);
          setIsEditingWorkAuthorization(false);
        }}
      />
    );
  }

  if (editingProfileField === "name") {
    return (
      <NameProfileEditScreen
        initialFirstName={profileName?.firstName || ""}
        initialLastName={profileName?.lastName || ""}
        onDone={(firstName, lastName) => {
          setProfileName({ firstName, lastName });
          setEditingProfileField("");
        }}
        metrics={metrics}
      />
    );
  }

  if (editingProfileField === "age") {
    return (
      <AgeProfileEditScreen
        initialDateOfBirth={dateOfBirth || ""}
        onDone={(value) => {
          setDateOfBirth(value);
          setEditingProfileField("");
        }}
        metrics={metrics}
      />
    );
  }

  if (editingProfileField === "location") {
    return (
      <LocationProfileEditScreen
        initialCities={profile.locationDetails?.cities || []}
        initialLocation={{
          ...(profileLocation || {}),
          city:
            profileLocation?.city ??
            profile?.locationDetails?.selected_city ??
            "",
          selectedAnswers:
            profileLocation?.selectedAnswers ??
            profile?.locationPreference ??
            [],
        }}
        locationPreferenceQuestions={profile.locationPreferenceQuestions || []}
        onDone={(value) => {
          setProfileLocation(value);
          setEditingProfileField("");
        }}
        metrics={metrics}
      />
    );
  }

  if (editingProfileField === "linkedin") {
    return (
      <LinkedinProfileEditScreen
        initialUrl={
          linkedinUrl || profile?.linkedinUrl ||
          profile?.linkedin_url ||
          ""
        }
        onDone={(value) => {
          setLinkedinUrl(value);
          setEditingProfileField("");
        }}
        metrics={metrics}
      />
    );
  }

  if (editingProfileField === "schedulingLink") {
    return (
      <SchedulingLinkEditScreen
        initialUrl={schedulingLink ?? ""}
        onDone={(value) => {
          setSchedulingLink(value);
          setEditingProfileField("");
        }}
        metrics={metrics}
      />
    );
  }

  const backgroundSections =
    selectedRoleLabel === "Both"
      ? [
          { title: "My Background as a Founder", rows: BACKGROUND_ROWS },
          { title: "My Background as a Talent", rows: TALENT_BACKGROUND_ROWS },
        ]
      : [
          {
            title: `My Background as a ${selectedRoleLabel === "Talent" ? "Talent" : "Founder"}`,
            rows:
              selectedRoleLabel === "Talent"
                ? TALENT_BACKGROUND_ROWS
                : BACKGROUND_ROWS,
          },
        ];

  const workTypeSummary = jobSearchProfile.workTypes
    .map((workType) => {
      if (workType === "Full Time") return "Full-time";
      if (workType === "Part Time") return "part-time";
      return workType.toLowerCase();
    })
    .join(" or ");
  const jobSearchProfileSummary = [
    jobSearchProfile.status,
    workTypeSummary ? `${workTypeSummary} roles` : "",
  ]
    .filter(Boolean)
    .join(". ");
  const bioExperienceSummary = [
    bioExperience.title || bioExperience.primaryRoleLabel,
    bioExperience.yearsOfExperience
      ? `${bioExperience.yearsOfExperience} years exp`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  const formattedMinimumSalary = compensation.expectedMinimumSalary
    ? Number.isNaN(Number(compensation.expectedMinimumSalary))
      ? compensation.expectedMinimumSalary
      : Number(compensation.expectedMinimumSalary).toLocaleString("en-US")
    : "";
  const compensationSalarySummary = compensation.minimumSalaryPreference
    ?.startsWith("No")
    ? "Flexible on salary"
    : formattedMinimumSalary
      ? `Ideally above (Min: ${compensation.currencyCode || "USD"} ${formattedMinimumSalary})`
      : compensation.minimumSalaryPreference;
  const compensationSummary = [
    compensation.cashEquityExpectation,
    compensationSalarySummary,
  ]
    .filter(Boolean)
    .join(". ");
  const companySizeSummary = COMPANY_SIZE_FIELDS.map((field) => {
    const interestLabel = getCompanySizeSelectionLabel(
      companySizeInterests[field.key],
    );
    return interestLabel
      ? `${field.label.split(" (")[0]}: ${interestLabel}`
      : "";
  })
    .filter(Boolean)
    .join(", ");
  const workAuthorizationSummary = getWorkAuthorizationLabel(workAuthorization);

  const previewDisplayName = [
    profileName?.firstName ?? profile?.firstName ?? profile?.first_name,
    profileName?.lastName ?? profile?.lastName ?? profile?.last_name,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ") || String(profile?.displayName || profile?.full_name || profile?.name || "Your Profile").trim();
  const previewLocationText = getProfileLocationText(profile, profileLocation);
  const previewLocationPreference = getLocationPreferenceText(profile, profileLocation);
  const previewLinkedinUrl = linkedinUrl || profile?.linkedinUrl || profile?.linkedin_url || "";
  const previewSummary = [
    headline || bioExperience.title || profile?.title || profile?.headline,
    bioExperience.bio || profile?.bio,
  ]
    .map((part) => String(part || "").trim())
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(" | ");
  const previewIdea =
    idea || bioExperience.startupIdea || profile?.startupIdea || profile?.startup_idea || "";
  const previewAge = profile?.age
    ? `${profile.age} years old`
    : dateOfBirth && calculateProfileAge(dateOfBirth) !== null
      ? `${calculateProfileAge(dateOfBirth)} years old`
      : "";
  const previewRoleTags = selectedSkills.length
    ? selectedSkills
        .map((value, index) => {
          const option = skillOptions.find((item) => String(item.value) === String(value));
          if (option?.label) return option.label;
          if (/^\d+$/.test(String(value))) return initialSkills[index] || "";
          return String(value || "").trim();
        })
        .filter(Boolean)
    : initialSkills.length
      ? initialSkills
      : getProfileTextList(profile?.roleTags || profile?.role_tags);
  const industryValues = selectedIndustries.length
    ? selectedIndustries
    : profile?.industries || profile?.industryInterests || profile?.industry_interests || [];
  const previewIndustries = getProfileTextList(industryValues)
    .map((value) => {
      const option = industryOptions.find((item) => String(item.value) === String(value));
      if (option?.label) return option.label;
      return /^\d+$/.test(String(value)) ? "" : value;
    })
    .filter(Boolean);
  const storedStartupExperiences = getProfileTextList(
    profile?.startupExperiences || profile?.startup_experiences || profile?.startup_experience,
  );
  const previewStartupExperiences = storedStartupExperiences.length
    && priorStartupExperience === "No prior startup experience"
    ? storedStartupExperiences
    : priorStartupExperience
      ? [priorStartupExperience]
      : storedStartupExperiences;
  const storedWorkPreferences = getProfileTextList(
    profile?.workPreferences || profile?.work_preferences || profile?.work_preference,
  );
  const previewWorkPreferences = storedWorkPreferences.length
    ? storedWorkPreferences
    : jobSearchProfile.workTypes.map((workType) =>
        workType === "Full Time" ? "Full-time" : workType === "Part Time" ? "Part-time" : workType,
      );
  const previewFounderRows = [
    {
      icon: require("../assets/search.png"),
      value: String(profile?.matchingGoal || profile?.matching_goal || matchingGoal || "").trim(),
    },
    {
      icon: require("../assets/teamwork.png"),
      value: String(profile?.timeCommitment || profile?.time_commitment || commitmentLevel || "").trim(),
    },
    {
      icon: require("../assets/internship.png"),
      value: previewRoleTags.join(", "),
    },
    { icon: require("../assets/user.png"), value: previewAge },
  ].filter((row) => String(row.value || "").trim());
  const previewPrompts = getProfilePreviewPrompts(profile, promptTitles, promptAnswers);
  const previewExperiences = profileExperiences.length
    ? profileExperiences
    : getProfileItems(
        profile?.linkedinExperiences || profile?.linkedin_experiences || profile?.experiences,
      );
  const previewEducation = profileEducation.length
    ? profileEducation
    : getProfileItems(
        profile?.educationEntries || profile?.education_details || profile?.education,
      );
  const profileIntentBadge =
    profile?.intentBadge ||
    profile?.intent_badge ||
    (selectedRoleLabel === "Talent" ? "Open to work" : "Open to founding");

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile editor"
          hitSlop={10}
          onPress={onClose}
          style={styles.headerAction}
        >
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onSave}
          style={styles.headerAction}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <View style={styles.modeTabs}>
        {["Edit", "View"].map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === tab }}
            onPress={() => {
              profileScrollOffset.current = 0;
              setActiveTab(tab);
            }}
            style={styles.modeTab}
          >
            <Text
              style={[
                styles.modeTabText,
                activeTab === tab && styles.modeTabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        key={activeTab}
        testID="profile-edit-scroll"
        contentOffset={{ x: 0, y: profileScrollOffset.current }}
        onScroll={(event) => {
          profileScrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {editable ? (
          <>
        <View style={styles.photoHeadlineRow}>
          <View style={styles.photoColumn}>
            <Text style={styles.fieldLabel}>My Photo</Text>
            <View style={styles.photoWrap}>
              <Image
                source={
                  profilePhoto.profileImageUri
                    ? { uri: profilePhoto.profileImageUri }
                    : require("../assets/user.png")
                }
                style={styles.profilePhoto}
                resizeMode="cover"
              />
              {editable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit photo"
                  style={styles.photoEditButton}
                  onPress={() => {
                    setProfilePhotoDraft({});
                    setOpenProfilePhotoSourceMenu(true);
                    setProfilePhotoFlowStep("upload");
                  }}
                >
                  <Image
                    source={require("../assets/edit.png")}
                    style={styles.photoEditIcon}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.headlineColumn}>
            <Text style={styles.fieldLabel}>My Headline</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="My Headline"
              disabled={!editable}
              onPress={() => setIsEditingHeadline(true)}
              style={styles.headlineInput}
            >
              <Text style={styles.headlinePreview}>
                {headline || "Write your headline here"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.fieldLabel}>What Best Describes Me</Text>
          <View style={styles.roleOptions}>
            {loadingRoleOptions ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator
                  accessibilityLabel="Loading role options"
                  size="large"
                  color="#2dbcc4"
                  style={{ marginBottom: 20 }}
                />
                <Text style={styles.profileFieldSubtitle}>Loading...</Text>
              </View>
            ) : errorMessageRoleOptions ? (
              <View style={styles.screen}>
                <View style={{ padding: 20 }}>
                  <Text style={styles.profileFieldSubtitle}>
                    {errorMessageRoleOptions}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry"
                    onPress={() => setRetryKeyRoleOptions((current) => current + 1)}
                    style={styles.profileFieldDone}
                  >
                    <Text style={styles.saveText}>Retry</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {roleOptions.map((option) => (
                  <Pressable
                    key={option.described_as}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedRoleLabel === option.described_as }}
                    disabled={!editable}
                    onPress={() => setSelectedRole(option.described_as)}
                    style={[
                      styles.roleOption,
                      selectedRoleLabel === option.described_as && styles.roleOptionActive,
                    ]}
                  >
                    {option.icon === "assets/bulb.png" ? (
                      <Image source={require("../assets/bulb.png")} style={styles.roleIcon} />
                    ) : option.icon === "assets/star.png" ? (
                      <Image source={require("../assets/star.png")} style={styles.roleIcon} />
                    ) : null}
                    <Text
                      style={[
                        styles.roleLabel,
                        selectedRoleLabel === option.described_as && styles.roleLabelActive,
                      ]}
                    >
                      {option.described_as}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
          <Text style={styles.helperText}>
            You will be shown as a {selectedRoleLabel.toLowerCase()} on your profile
          </Text>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.fieldLabel}>My Idea</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My Idea"
            disabled={!editable}
            onPress={() => setIsEditingIdea(true)}
            style={styles.ideaCard}
          >
            <Text style={styles.cardTitle}>I’m exploring</Text>
            <Text style={styles.ideaPreview}>
              {profile?.startupIdea || "Write your idea here"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>My Prompts</Text>
          <Text style={styles.helperText}>
            Tap on tile to edit, long press to reorder
          </Text>
          {PROMPT_SLOTS.map((promptSlot, index) => (
            <Pressable
              key={promptSlot}
              accessibilityRole="button"
              accessibilityLabel={`Prompt ${index + 1}`}
              disabled={!editable}
              onPress={() => setEditingPromptIndex(index)}
              style={styles.promptCard}
            >
              <Text style={styles.promptPlaceholderTitle}>
                {promptTitles[index] ||
                  promptAnswers[index] ||
                  "Select a prompt"}
              </Text>
              {promptTitles[index] ? (
                <Text style={styles.promptPlaceholderSubtitle}>
                  {promptAnswers[index] || "And write your own answer"}
                </Text>
              ) : !promptAnswers[index] ? (
                <Text style={styles.promptPlaceholderSubtitle}>
                  And write your own answer
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        {backgroundSections.map((section) => (
          <View key={section.title} style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.rows.map((row) => (
              <DetailRow
                key={row.title}
                {...row}
                value={
                  row.title === "Company Size"
                    ? companySizeSummary || row.value
                    : row.title.startsWith("Work Authorization")
                      ? workAuthorizationSummary || row.value
                    : row.title.startsWith("Compensation")
                      ? compensationSummary || row.value
                      : row.title.startsWith("Bio & Experience")
                      ? bioExperienceSummary || row.value
                      : row.title.startsWith("Job Search Profile")
                        ? jobSearchProfileSummary
                        : row.title === "Number of Founders"
                          ? founderCount === 0
                            ? "Not Selected"
                            : String(founderCount)
                          : row.title.startsWith("Skills & Expertise")
                            ? selectedSkills.length
                              ? selectedSkills
                                  .map((value) => {
                                    const foundOption = skillOptions?.find(
                                      (option) =>
                                        String(option.value) === String(value),
                                    );
                                    return foundOption?.label ?? String(value);
                                  })
                                  .join(", ")
                              : initialSkills.length
                                ? initialSkills.join(", ")
                                : "Not Selected"
                            : row.title === "Equity Split"
                              ? equitySplitOption || "Not Selected"
                              : row.title.startsWith("Matching Goal")
                                ? matchingGoal
                                : row.title.startsWith("Commitment Level")
                                  ? commitmentLevel
                                  : row.value
                }
                onPress={
                  row.title === "Company Size"
                    ? () => setIsEditingCompanySize(true)
                    : row.title.startsWith("Work Authorization")
                      ? () => setIsEditingWorkAuthorization(true)
                    : row.title.startsWith("Compensation")
                      ? () => setIsEditingCompensation(true)
                      : row.title.startsWith("Bio & Experience")
                      ? () => setIsEditingBioExperience(true)
                      : row.title.startsWith("Job Search Profile")
                        ? () => setIsEditingJobSearchProfile(true)
                        : row.title.startsWith("Matching Goal")
                          ? () => setIsEditingMatchingGoal(true)
                          : row.title.startsWith("Commitment Level")
                            ? () => setIsEditingCommitmentLevel(true)
                            : row.title === "Number of Founders"
                              ? () => setIsEditingFounderCount(true)
                              : row.title.startsWith("Skills & Expertise")
                                ? () => setIsEditingSkills(true)
                                : row.title === "Equity Split"
                                  ? () => setIsEditingEquitySplit(true)
                                  : undefined
                }
                muted={
                  row.title === "Company Size"
                    ? !companySizeSummary
                    : row.title.startsWith("Work Authorization")
                      ? !workAuthorizationSummary
                    : row.title.startsWith("Compensation")
                      ? !compensationSummary
                      : row.title === "Number of Founders"
                      ? founderCount === 0
                      : row.title.startsWith("Skills & Expertise")
                        ? selectedSkills.length === 0
                        : row.title === "Equity Split"
                          ? !equitySplitOption
                          : row.muted
                }
                styles={styles}
              />
            ))}
          </View>
        ))}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>More About Me</Text>
          {ABOUT_ROWS.map((row) => (
            <DetailRow
              key={row.title}
              {...row}
              value={
                row.title === "Industries & Interests" &&
                selectedIndustries.length
                  ? selectedIndustries
                      .map(
                        (value) =>
                          industryOptions.find(
                            (option) => option.value === value,
                          )?.label || String(value),
                        // value.industry_name || value.label || String(value)
                      )
                      .join(", ")
                  : row.title === "Prior Startup Experience"
                    ? priorStartupExperience
                    : row.value
              }
              muted={
                row.title === "Industries & Interests"
                  ? selectedIndustries.length === 0
                  : row.title === "Prior Startup Experience"
                    ? !priorStartupExperience
                    : row.muted
              }
              onPress={
                row.title === "Industries & Interests"
                  ? () => setIsEditingIndustries(true)
                  : row.title === "Prior Startup Experience"
                    ? () => setIsEditingPriorStartupExperience(true)
                    : undefined
              }
              styles={styles}
            />
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>My Profile</Text>
          <DetailRow
            title="Name"
            value={
              profile === null
                ? "Sohaib Rahman"
                : `${profile.firstName} ${profile.lastName}`.trim() ||
                  "Not Selected"
            }
            onPress={() => setEditingProfileField("name")}
            styles={styles}
          />
          <DetailRow
            title="Age"
            value={
              dateOfBirth === undefined
                ? "NA"
                : dateOfBirth && calculateProfileAge(dateOfBirth) !== null
                  ? `${calculateProfileAge(dateOfBirth)} years old`
                  : "Not Selected"
            }
            onPress={() => setEditingProfileField("age")}
            styles={styles}
          />

          <DetailRow
            title="Location"
            value={
              profileLocation === undefined
                ? getLocationSummary(profile, undefined) || "Not Selected"
                : getLocationSummary(profile, profileLocation) || "Not Selected"
            }
            onPress={() => setEditingProfileField("location")}
            styles={styles}
          />

          <DetailRow
            title="LinkedIn"
            value={
              linkedinUrl ?? "https://www.linkedin.com/in/sohaib-rahman-a5"
            }
            onPress={() => setEditingProfileField("linkedin")}
            styles={styles}
          />
          <DetailRow
            title="Scheduling Link"
            value={schedulingLink ?? "Do not have a scheduling link"}
            onPress={() => setEditingProfileField("schedulingLink")}
            styles={styles}
          />
          <ProfileHistorySection
            title="My Experiences"
            headerIcon={require("../assets/linkedin.png")}
            itemIcon={require("../assets/briefcase.png")}
            items={profileExperiences}
            onAdd={() => {
              setIsEditingProfileExperience(true);
              setEditingExperienceIndex(undefined);
            }}
            onItemPress={(_item, index) => {
              setEditingExperienceIndex(index);
              setIsEditingProfileExperience(true);
            }}
            styles={styles}
          />
          <ProfileHistorySection
            title="My Education"
            headerIcon={require("../assets/linkedin.png")}
            itemIcon={require("../assets/graduation.png")}
            items={profileEducation}
            onAdd={() => {
              setIsEditingProfileEducation(true);
              setEditingEducationIndex(undefined);
            }}
            onItemPress={(_item, index) => {
              setEditingEducationIndex(index);
              setIsEditingProfileEducation(true);
            }}
            styles={styles}
          />
        </View>
          </>
        ) : (
          <ProfilePreview
            metrics={metrics}
            displayName={previewDisplayName}
            photoUri={profilePhoto.profileImageUri || profileImageUrl}
            linkedinUrl={previewLinkedinUrl}
            locationText={previewLocationText}
            locationPreferenceText={previewLocationPreference}
            badges={[
              {
                label: profileIntentBadge,
                style: "foundingBadge",
                textStyle: "darkBadgeText",
              },
              { label: "New", style: "newBadge", textStyle: "tealBadgeText" },
              {
                label: "Active Today",
                style: "activeBadge",
                textStyle: "greenBadgeText",
              },
            ]}
            summary={previewSummary}
            ideaTitle="I'm exploring"
            idea={previewIdea}
            founderTitle={`As a ${selectedRoleLabel === "Both" ? "founder and talent" : selectedRoleLabel.toLowerCase()}, I am...`}
            founderRows={previewFounderRows}
            industries={previewIndustries}
            startupExperiences={previewStartupExperiences}
            workPreferences={previewWorkPreferences}
            prompts={previewPrompts}
            motivation={profile?.motivation}
            superpower={profile?.superpower || profile?.strength}
            experiences={previewExperiences}
            experienceSummary={profile?.experienceSummary || profile?.experience_summary || bioExperienceSummary}
            education={previewEducation}
          />
        )}
      </ScrollView>
    </View>
  );
}

function getProfileTextList(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]/)
      : [];

  return values
    .map((item) => {
      if (item && typeof item === "object") {
        return String(
          item.label ||
            item.name ||
            item.industry_name ||
            item.skill_name ||
            item.title ||
            item.value ||
            "",
        ).trim();
      }
      return String(item ?? "").trim();
    })
    .filter(Boolean);
}

function getProfileItems(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function getProfilePreviewPrompts(profile, promptTitles, promptAnswers) {
  const savedPrompts = [
    profile?.prompts,
    profile?.profilePrompts,
    profile?.profile_prompts,
    profile?.promptResponses,
    profile?.prompt_responses,
    profile?.user_prompts,
  ].find(Array.isArray) || [];
  const combinedPrompts = [
    ...savedPrompts.map((prompt) => ({
      title:
        prompt?.prompt_title ||
        prompt?.title ||
        prompt?.question_text ||
        prompt?.question ||
        prompt?.prompt ||
        prompt?.label ||
        "",
      answer:
        prompt?.answer ||
        prompt?.response ||
        prompt?.answer_text ||
        prompt?.prompt_answer ||
        prompt?.content ||
        "",
    })),
    ...promptTitles.map((title, index) => ({
      title,
      answer: promptAnswers[index],
    })),
  ].filter((prompt) => String(prompt.title || prompt.answer || "").trim());

  const byTitle = new Map();
  combinedPrompts.forEach((prompt, index) => {
    const title = String(prompt.title || "").trim();
    const answer = String(prompt.answer || "").trim();
    const key = title.toLowerCase() || `prompt-${index}`;
    const previous = byTitle.get(key);
    byTitle.set(key, {
      title: title || previous?.title || "",
      answer: answer || previous?.answer || "",
    });
  });

  return [...byTitle.values()].filter((prompt) => prompt.title || prompt.answer);
}

function getProfileLocationText(profile, editedLocation) {
  const locationDetails = profile?.locationDetails || profile?.location_details || {};
  const city =
    editedLocation?.city ??
    editedLocation?.selected_city ??
    locationDetails.selected_city ??
    profile?.selected_city ??
    "";
  const state =
    editedLocation?.state ??
    editedLocation?.selected_state ??
    locationDetails.selected_state ??
    profile?.selected_state ??
    "";
  const country =
    editedLocation?.country ??
    editedLocation?.selected_country ??
    locationDetails.selected_country ??
    profile?.selected_country ??
    "";

  return (
    [city, state, country].map((part) => String(part || "").trim()).filter(Boolean).join(", ") ||
    String(profile?.locationText || profile?.location_text || profile?.location || "").trim()
  );
}

function getLocationPreferenceText(profile, editedLocation) {
  const savedSummary = String(
    profile?.locationPreferenceText ||
      profile?.location_preference_text ||
      getLocationSummary(profile, editedLocation),
  ).toLowerCase();
  const preferences = getProfileTextList(
    profile?.workPreferences || profile?.work_preferences || profile?.work_preference,
  ).join(" ").toLowerCase();
  const source = `${savedSummary} ${preferences}`;
  const isRemote = /remote|work from anywhere/.test(source);
  const isRelocating = /relocat/.test(source);

  if (isRemote && isRelocating) return "Open to relocate or remote work";
  if (isRemote) return "Open to remote work";
  if (isRelocating) return "Open to relocate";
  return "";
}

function getLocationSummary(profile, editedLocation) {
  const locationDetails = profile?.locationDetails || {};

  const city =
    editedLocation?.city ??
    locationDetails.selected_city ??
    profile?.selected_city ??
    "";

  const state = locationDetails.selected_state || profile?.selected_state || "";
  const country =
    locationDetails.selected_country || profile?.selected_country || "";

  const questions = Array.isArray(profile?.locationPreferenceQuestions)
    ? profile.locationPreferenceQuestions
    : [];

  const savedAnswers =
    editedLocation?.selectedAnswers !== undefined
      ? editedLocation.selectedAnswers
      : profile?.locationPreference;

  const normalizedAnswers = Array.isArray(savedAnswers)
    ? savedAnswers
    : savedAnswers && typeof savedAnswers === "object"
      ? Object.entries(savedAnswers).map(([questionId, answerId]) => ({
          question_id: questionId,
          selected_answer_id: answerId,
        }))
      : Array.isArray(profile?.locationPreference)
        ? profile.locationPreference
        : [];

  // const savedAnswers = Array.isArray(editedLocation?.selectedAnswers)
  //   ? Object.entries(editedLocation.selectedAnswers).map(
  //       ([questionId, answerId]) => ({
  //         question_id: questionId,
  //         selected_answer_id: answerId,
  //       }),
  //     )
  //   : Array.isArray(profile?.locationPreference)
  //     ? profile.locationPreference
  //     : [];

  // Find a question by its text.
  const findQuestion = (searchText) =>
    questions.find((item) =>
      item?.question?.toLowerCase().includes(searchText.toLowerCase()),
    );

  // Return the selected answer text for a question.
  const getSelectedAnswer = (question) => {
    if (!question) return "";

    const questionId = question.question_id ?? question.id;

    const savedAnswer = normalizedAnswers.find(
      (item) => String(item.question_id) === String(questionId),
    );

    if (!savedAnswer) return "";

    // Find the answer option matching the saved answer ID.
    const answerOptions =
      question.answers ?? question.options ?? question.answer_options ?? [];

    const selectedOption = answerOptions.find(
      (option) =>
        String(option.answer_id ?? option.id) ===
        String(savedAnswer.selected_answer_id),
    );

    // Return the answer's text, not the savedAnswer object.
    return (
      selectedOption?.answer ??
      selectedOption?.answer_text ??
      selectedOption?.label ??
      selectedOption?.name ??
      ""
    );
  };

  const relocationQuestion = findQuestion("Are you willing to relocate");

  const relocationAnswer = getSelectedAnswer(relocationQuestion);

  const relocationPreference =
    relocationAnswer.toLowerCase() === "yes"
      ? "Willing to relocate"
      : relocationAnswer.toLowerCase() === "no"
        ? "Not willing to relocate"
        : "";

  // 1. Determine the work arrangement.
  const remoteQuestion = findQuestion("Are you open to work remotely?");

  const remoteAnswer = getSelectedAnswer(remoteQuestion);

  let workArrangement = "";
  if (remoteAnswer.toLowerCase() === "no") {
    workArrangement = "On-site";
  } else if (remoteAnswer.toLowerCase() === "yes") {
    workArrangement = "Remote";
  }

  // 2. Determine the preferred remote-work arrangement.
  const preferenceQuestion = findQuestion(
    "What is your preference in working remotely",
  );

  const workPreference = getSelectedAnswer(preferenceQuestion);

  // setProfileLocation({
  //   ...profileLocation,
  //   willingToRelocate: relocationPreference,
  //   openToRemote: workArrangement,
  //   workPreference: workPreference,
  // });

  // Build the location summary.
  const summaryParts = [
    city,
    country,
    workArrangement,
    workPreference,
    relocationPreference,
  ].filter(Boolean);

  return summaryParts.join(" · ");
}

function createStyles(metrics) {
  const scale = metrics.moderateScale;
  return withPlatformFontStyles({
    screen: { flex: 1, backgroundColor: "#f0eee5" },
    header: {
      minHeight: scale(58),
      paddingHorizontal: metrics.vw(5),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerAction: {
      width: scale(58),
      minHeight: scale(44),
      justifyContent: "center",
    },
    headlineEditorHeader: {
      minHeight: scale(72),
      paddingHorizontal: metrics.vw(5),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headlineBackIcon: { width: scale(34), height: scale(34) },
    jobSearchHeader: {
      minHeight: scale(72),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: metrics.vw(5),
    },
    jobSearchHeaderAction: {
      width: scale(34),
      minHeight: scale(44),
      justifyContent: "center",
    },
    jobSearchHeaderTitle: {
      flex: 1,
      color: "#080808",
      fontSize: scale(25),
      fontWeight: "700",
      textAlign: "center",
    },
    jobSearchContent: {
      flexGrow: 1,
      paddingHorizontal: metrics.vw(5.8),
      paddingBottom: scale(32),
    },
    jobSearchQuestion: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginTop: scale(22),
    },
    jobSearchStatusOptions: {
      marginTop: scale(31),
      gap: scale(26),
    },
    jobSearchStatusOption: {
      minHeight: scale(35),
      flexDirection: "row",
      alignItems: "center",
    },
    jobSearchRadio: {
      width: scale(30),
      height: scale(30),
      borderWidth: scale(2.5),
      borderColor: "#7d879e",
      borderRadius: scale(15),
      alignItems: "center",
      justifyContent: "center",
    },
    jobSearchRadioSelected: { borderColor: "#08a9b8" },
    jobSearchRadioDot: {
      width: scale(18),
      height: scale(18),
      borderRadius: scale(9),
      backgroundColor: "#08a9b8",
    },
    jobSearchOptionText: {
      color: "#595959",
      fontSize: scale(18),
      marginLeft: scale(15),
    },
    jobSearchWorkQuestion: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginTop: scale(62),
      marginHorizontal: scale(9),
    },
    jobSearchWorkTypes: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: scale(24),
      rowGap: scale(28),
      marginTop: scale(22),
    },
    jobSearchWorkType: {
      width: "39%",
      minHeight: scale(54),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: scale(28),
      backgroundColor: "#dfe2e7",
      borderWidth: scale(1.5),
      borderColor: "transparent",
    },
    jobSearchInternship: { width: "48%" },
    jobSearchWorkTypeSelected: {
      backgroundColor: "#2dbcc4",
      borderColor: "#bcebed",
    },
    jobSearchWorkTypeText: {
      color: "#7d879e",
      fontSize: scale(18),
    },
    jobSearchWorkTypeTextSelected: { color: "#fff" },
    jobSearchFounderOption: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: scale(48),
      paddingHorizontal: scale(4),
    },
    jobSearchCheckbox: {
      width: scale(36),
      height: scale(36),
      borderWidth: scale(2),
      borderColor: "#7d879e",
      borderRadius: scale(6),
      alignItems: "center",
      justifyContent: "center",
    },
    jobSearchCheckboxSelected: {
      backgroundColor: "#2dbcc4",
      borderColor: "#2dbcc4",
    },
    jobSearchCheckboxCheck: {
      color: "#fff",
      fontSize: scale(27),
      fontWeight: "700",
      lineHeight: scale(30),
    },
    jobSearchFounderOptionText: {
      flex: 1,
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginLeft: scale(16),
    },
    profileExperienceHeader: {
      minHeight: scale(72),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: metrics.vw(5),
    },
    profileExperienceHeaderAction: {
      width: scale(34),
      minHeight: scale(44),
      justifyContent: "center",
    },
    profileExperienceHeaderTitle: {
      flex: 1,
      color: "#080808",
      fontSize: scale(25),
      fontWeight: "700",
      textAlign: "center",
    },
    profileExperienceDoneButton: {
      width: scale(58),
      minHeight: scale(44),
      justifyContent: "center",
      alignItems: "flex-end",
    },
    profileExperienceDoneText: {
      color: "#08b9c2",
      fontSize: scale(22),
    },
    profileExperienceContent: {
      flexGrow: 1,
      paddingHorizontal: metrics.vw(6.3),
      paddingTop: scale(43),
      paddingBottom: scale(32),
    },
    profileExperienceTextFieldGroup: { marginBottom: scale(24) },
    profileExperienceFieldLabel: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(25),
    },
    profileExperienceTextInput: {
      minHeight: scale(42),
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      color: "#000000",
      fontSize: scale(18),
      lineHeight: scale(25),
      paddingHorizontal: scale(4),
      paddingVertical: scale(6),
    },
    profileExperienceCharacterCount: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(25),
      marginTop: scale(5),
      textAlign: "right",
    },
    profileExperienceCurrentRow: {
      minHeight: scale(48),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: scale(8),
      marginBottom: scale(64),
    },
    profileExperienceCurrentText: {
      color: "#a2a2a2",
      fontSize: scale(18),
      marginLeft: scale(14),
    },
    profileExperienceDateGroup: { marginBottom: scale(36) },
    profileExperienceDateField: {
      minHeight: scale(42),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      paddingHorizontal: scale(4),
      position: "relative",
    },
    profileExperienceDisabledDateField: { opacity: 0.55 },
    profileExperienceDateText: {
      flex: 1,
      color: "#000000",
      fontSize: scale(18),
      lineHeight: scale(25),
    },
    profileExperiencePlaceholder: { color: "#7d879e" },
    profileExperienceWebDateInput: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderWidth: 0,
      backgroundColor: "transparent",
      color: "transparent",
      fontFamily: "inherit",
      fontSize: scale(18),
      padding: 0,
    },
    profileExperienceDescriptionGroup: { marginTop: scale(14) },
    profileExperienceDescriptionInput: {
      minHeight: scale(170),
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      color: "#000000",
      fontSize: scale(18),
      lineHeight: scale(25),
      paddingHorizontal: scale(4),
      paddingTop: scale(4),
      paddingBottom: scale(20),
      textAlignVertical: "top",
    },
    profileHistoryRemoveButton: {
      minHeight: scale(48),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: scale(1),
      borderColor: "#cf4b4b",
      borderRadius: scale(8),
      marginTop: scale(28),
      marginHorizontal: scale(4),
      marginBottom: scale(12),
    },
    profileHistoryRemoveButtonText: {
      color: "#cf4b4b",
      fontSize: scale(18),
      fontWeight: "600",
    },
    bioExperienceHeader: {
      minHeight: scale(72),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: metrics.vw(5),
    },
    bioExperienceHeaderAction: {
      width: scale(34),
      minHeight: scale(44),
      justifyContent: "center",
    },
    bioExperienceHeaderTitle: {
      flex: 1,
      color: "#080808",
      fontSize: scale(25),
      fontWeight: "700",
      textAlign: "center",
    },
    bioExperienceDoneButton: {
      width: scale(58),
      minHeight: scale(44),
      justifyContent: "center",
      alignItems: "flex-end",
    },
    bioExperienceDoneText: {
      color: "#62b8b7",
      fontSize: scale(22),
    },
    bioExperienceContent: {
      flexGrow: 1,
      paddingHorizontal: metrics.vw(5.8),
      paddingTop: scale(10),
      paddingBottom: scale(36),
    },
    bioExperienceInputLabel: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(25),
    },
    bioExperienceTextField: {
      minHeight: scale(78),
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      marginBottom: scale(46),
      paddingTop: scale(2),
      paddingHorizontal: scale(4),
    },
    bioExperienceFieldRow: {
      minHeight: scale(52),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      marginBottom: scale(46),
      paddingHorizontal: scale(4),
    },
    bioExperiencePrimaryRoleRow: { marginBottom: scale(62) },
    bioExperienceSecondaryRoleRow: { marginBottom: scale(51) },
    bioExperienceFieldText: {
      flex: 1,
      color: "#333",
      fontSize: scale(18),
      lineHeight: scale(25),
    },
    bioExperiencePlaceholder: { color: "#a2a2a2" },
    bioExperienceChevron: {
      color: "#9b9b9b",
      fontSize: scale(18),
      marginLeft: scale(12),
    },
    bioExperienceTextInput: {
      minHeight: scale(40),
      flexGrow: 1,
      color: "#000000",
      fontSize: scale(18),
      lineHeight: scale(25),
      paddingHorizontal: 0,
      paddingTop: scale(2),
      paddingBottom: scale(6),
    },
    bioExperienceLongInput: {
      minHeight: scale(176),
      marginBottom: scale(42),
    },
    bioExperienceDateField: {
      minHeight: scale(40),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      paddingHorizontal: scale(8),
      marginBottom: scale(28),
    },
    bioExperienceDisabledDateField: { opacity: 0.55 },
    bioExperienceWebDateField: {
      minHeight: scale(40),
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      paddingHorizontal: scale(8),
      marginBottom: scale(28),
    },
    bioExperienceWebDateInput: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderWidth: 0,
      backgroundColor: "transparent",
      color: "transparent",
      fontFamily: "inherit",
      fontSize: scale(18),
      padding: 0,
    },
    bioExperienceWebDateLabel: {
      color: "#a2a2a2",
      fontSize: scale(18),
      paddingHorizontal: scale(4),
    },
    bioExperienceCalendarIcon: {
      width: scale(32),
      height: scale(29),
      borderWidth: scale(2),
      borderColor: "#2dbcc4",
      borderRadius: scale(4),
      marginLeft: scale(10),
      paddingTop: scale(8),
      paddingHorizontal: scale(4),
    },
    bioExperienceCalendarTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: scale(6),
      backgroundColor: "#2dbcc4",
      borderTopLeftRadius: scale(2),
      borderTopRightRadius: scale(2),
    },
    bioExperienceCalendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: scale(3),
    },
    bioExperienceCalendarDot: {
      width: scale(4),
      height: scale(3),
      borderRadius: scale(1),
      backgroundColor: "#2dbcc4",
    },
    bioExperienceCurrentRow: {
      minHeight: scale(48),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: scale(8),
      marginBottom: scale(27),
    },
    bioExperienceCheckbox: {
      width: scale(28),
      height: scale(28),
      borderWidth: scale(2),
      borderColor: "#62b8b7",
      borderRadius: scale(4),
      alignItems: "center",
      justifyContent: "center",
    },
    bioExperienceCheckboxSelected: {
      backgroundColor: "#2dbcc4",
      borderColor: "#2dbcc4",
    },
    bioExperienceCheckboxCheck: {
      color: "#fff",
      fontSize: scale(22),
      fontWeight: "700",
      lineHeight: scale(24),
    },
    bioExperienceCurrentText: {
      color: "#a2a2a2",
      fontSize: scale(18),
      marginLeft: scale(14),
    },
    bioExperienceModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.34)",
      justifyContent: "center",
      paddingHorizontal: metrics.vw(6),
    },
    bioExperienceModalCard: {
      maxHeight: metrics.vh(62),
      borderRadius: scale(20),
      backgroundColor: "#fff",
      paddingHorizontal: metrics.vw(5),
      paddingTop: metrics.vh(2.4),
      paddingBottom: metrics.vh(2),
    },
    bioExperienceModalTitle: {
      color: "#101010",
      fontSize: scale(20),
      fontWeight: "700",
      marginBottom: metrics.vh(1.4),
    },
    bioExperienceModalList: { maxHeight: metrics.vh(44) },
    bioExperienceModalOption: {
      paddingVertical: metrics.vh(1.2),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#ececec",
    },
    bioExperienceModalOptionText: {
      color: "#1f1f1f",
      fontSize: scale(17),
      fontWeight: "600",
    },
    bioExperienceModalDescription: {
      color: "#707070",
      fontSize: scale(14),
      marginTop: scale(4),
    },
    bioExperienceModalError: {
      color: "#c44f4f",
      fontSize: scale(16),
      marginBottom: scale(10),
    },
    bioExperienceRetry: {
      color: "#2dbcc4",
      fontSize: scale(16),
      fontWeight: "600",
    },
    bioExperienceDateModalCard: {
      borderRadius: scale(20),
      backgroundColor: "#fff",
      padding: scale(20),
    },
    bioExperienceIosDatePicker: { alignSelf: "center" },
    bioExperienceDateActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: scale(20),
      marginTop: scale(12),
    },
    bioExperienceDateAction: { paddingVertical: scale(10) },
    bioExperienceDateActionText: {
      color: "#2dbcc4",
      fontSize: scale(16),
      fontWeight: "600",
    },
    headlineDoneAction: {
      width: scale(58),
      minHeight: scale(44),
      justifyContent: "center",
      alignItems: "flex-end",
    },
    profileFieldDone: {
      minWidth: scale(58),
      minHeight: scale(44),
      justifyContent: "center",
      alignItems: "flex-end",
    },
    closeIcon: { color: "#7d879e", fontSize: scale(38), lineHeight: scale(42) },
    headerTitle: { color: "#080808", fontSize: scale(25), fontWeight: "700" },
    saveText: { color: "#24bac4", fontSize: scale(22), textAlign: "right" },
    modeTabs: {
      height: scale(50),
      flexDirection: "row",
      marginBottom: scale(12),
    },
    modeTab: { flex: 1, alignItems: "center", justifyContent: "center" },
    modeTabText: { color: "#7d879e", fontSize: scale(17), fontWeight: "600" },
    modeTabTextActive: { color: "#20b8c2" },
    scroll: { flex: 1 },
    scrollArea: { flex: 1 },
    content: { paddingHorizontal: metrics.vw(3.8), paddingBottom: scale(20) },
    photoHeadlineRow: {
      flexDirection: "row",
      gap: scale(14),
      alignItems: "flex-end",
    },
    photoColumn: { width: metrics.vw(29) },
    headlineColumn: { flex: 1, minWidth: 0 },
    fieldLabel: {
      color: "#7d879e",
      fontSize: scale(17),
      fontWeight: "700",
      marginBottom: scale(8),
    },
    photoWrap: { width: "100%", aspectRatio: 1, position: "relative" },
    profilePhoto: { width: "100%", height: "100%", borderRadius: scale(15) },
    photoEditButton: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      backgroundColor: "#fff",
      position: "absolute",
      right: scale(8),
      bottom: scale(8),
      alignItems: "center",
      justifyContent: "center",
    },
    photoEditIcon: {
      width: scale(21),
      height: scale(21),
      resizeMode: "contain",
    },
    headlineInput: {
      minHeight: scale(112),
      borderWidth: scale(1.5),
      borderColor: "#aaa9a7",
      borderRadius: scale(18),
      padding: scale(12),
      justifyContent: "flex-start",
    },
    headlinePreview: {
      color: "#7d879e",
      fontSize: scale(15),
      lineHeight: scale(22),
    },
    headlineEditorInput: {
      height: metrics.vh(26),
      marginTop: scale(38),
      marginHorizontal: metrics.vw(9.2),
      borderWidth: scale(2),
      borderColor: "#d7d3cf",
      borderRadius: scale(18),
      padding: scale(12),
      color: "#111",
      fontSize: scale(17),
      lineHeight: scale(24),
    },
    profileFieldContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(6.5),
      paddingTop: scale(58),
    },
    profileUnderlineInput: {
      minHeight: scale(58),
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      color: "#333",
      fontSize: scale(18),
      lineHeight: scale(25),
      paddingHorizontal: scale(4),
      paddingVertical: scale(12),
    },
    profileLinkedinInputRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    profileLinkedinUrlInput: {
      flex: 1,
      minWidth: 0,
    },
    profileLinkedinPreviewButton: {
      width: scale(44),
      height: scale(52),
      alignItems: "center",
      justifyContent: "center",
      marginLeft: scale(8),
    },
    profileLinkedinPreviewArrow: {
      width: scale(26),
      height: scale(26),
      tintColor: "#20b8c2",
    },
    profileNameLastInput: {
      marginTop: scale(54),
    },
    profileFieldNote: {
      color: "#7d879e",
      fontSize: scale(17),
      lineHeight: scale(25),
      marginTop: scale(48),
    },
    profileFieldPlaceholder: {
      color: "#7d879e",
    },
    profileDateInput: {
      minHeight: scale(58),
      paddingHorizontal: scale(4),
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    profileDateValueButton: {
      flex: 1,
      minHeight: scale(54),
      justifyContent: "center",
    },
    profileCalendarButton: {
      minWidth: scale(38),
      minHeight: scale(48),
      alignItems: "center",
      justifyContent: "center",
    },
    profileDateText: {
      color: "#333",
      fontSize: scale(18),
    },
    profileAgeText: {
      color: "#7d879e",
      fontSize: scale(17),
      lineHeight: scale(25),
      marginTop: scale(20),
    },
    profileCalendarIcon: {
      width: scale(25),
      height: scale(25),
      borderWidth: scale(1.7),
      borderColor: "#a8a9aa",
      borderRadius: scale(5),
      paddingTop: scale(6),
      paddingHorizontal: scale(3),
    },
    profileCalendarTop: {
      position: "absolute",
      left: 0,
      right: 0,
      top: scale(5),
      borderTopWidth: scale(1.4),
      borderColor: "#a8a9aa",
    },
    profileCalendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: scale(2),
    },
    profileCalendarDot: {
      width: scale(3),
      height: scale(3),
      borderRadius: scale(2),
      backgroundColor: "#a8a9aa",
    },
    profileLocationContent: {
      paddingHorizontal: metrics.vw(6.5),
      paddingTop: scale(34),
      paddingBottom: scale(36),
    },
    profileFieldSubtitle: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
    },
    profileLocationQuestion: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginTop: scale(54),
      marginBottom: scale(22),
    },
    profileRadioRow: {
      minHeight: scale(48),
      flexDirection: "row",
      alignItems: "center",
      marginBottom: scale(16),
      paddingHorizontal: scale(2),
    },
    profileRadioOuter: {
      width: scale(27),
      height: scale(27),
      borderWidth: scale(2.5),
      borderColor: "#7d879e",
      borderRadius: scale(16),
      alignItems: "center",
      justifyContent: "center",
      marginRight: scale(16),
    },
    profileRadioOuterSelected: {
      borderColor: "#00a9bc",
    },
    profileRadioInner: {
      width: scale(13),
      height: scale(13),
      borderRadius: scale(8),
      backgroundColor: "#00a9bc",
    },
    profileRadioLabel: {
      color: "#555",
      fontSize: scale(17),
      lineHeight: scale(24),
    },
    profileLinkedinPreview: {
      minHeight: scale(118),
      marginTop: scale(40),
      borderWidth: scale(2),
      borderColor: "#d7d4ce",
      borderRadius: scale(18),
      justifyContent: "center",
      padding: scale(18),
    },
    profileLinkedinPreviewFilled: {
      justifyContent: "flex-start",
      paddingVertical: scale(18),
    },
    profileLinkedinPreviewDetails: {
      gap: scale(8),
    },
    profileLinkedinPreviewHeadline: {
      color: "#262626",
      fontSize: scale(17),
      lineHeight: scale(23),
      fontWeight: "700",
    },
    profileLinkedinPreviewMeta: {
      color: "#262626",
      fontSize: scale(15),
      lineHeight: scale(22),
    },
    profileLinkedinPreviewText: {
      color: "#a2a2a2",
      fontSize: scale(17),
    },
    profileLinkedinPreviewError: {
      color: "#c44f4f",
      fontSize: scale(14),
      lineHeight: scale(20),
      marginTop: scale(12),
    },
    profileFieldRow: {
      marginBottom: 16,
    },

    profileFieldLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: "#333333",
      marginBottom: 8,
    },

    profileDateInput: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: "#D9D9D9",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: "#FFFFFF",
      justifyContent: "center",
    },

    profileDateText: {
      fontSize: 16,
      color: "#222222",
    },

    profileFieldPlaceholder: {
      color: "#999999",
    },
    ideaEditorContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(7.5),
      paddingTop: scale(60),
    },
    ideaEditorTitle: {
      marginHorizontal: scale(10),
      color: "#080808",
      fontSize: scale(25),
      fontWeight: "700",
    },
    ideaEditorInput: {
      height: metrics.vh(26),
      marginTop: scale(38),
      borderWidth: scale(2),
      borderColor: "#d7d3cf",
      borderRadius: scale(18),
      padding: scale(12),
      color: "#111",
      fontSize: scale(17),
      lineHeight: scale(24),
    },
    writtenPromptContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(8),
      paddingTop: scale(36),
    },
    promptSelector: {
      minHeight: scale(52),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      paddingHorizontal: scale(4),
      marginBottom: scale(46),
      backgroundColor: "transparent",
    },
    promptSelectorText: {
      flex: 1,
      color: "#333",
      fontSize: scale(18),
      lineHeight: scale(25),
    },

    promptEditIcon: { width: scale(30), height: scale(30) },
    promptList: {
      flex: 1,
      borderWidth: scale(1),
      borderColor: "#d7d7d7",
      borderRadius: scale(18),
      backgroundColor: "#fff",
    },
    promptListContent: {
      paddingHorizontal: scale(16),
      paddingVertical: scale(8),
    },
    promptListItem: {
      minHeight: scale(62),
      justifyContent: "center",
      paddingHorizontal: scale(12),
      borderBottomWidth: scale(1),
      borderBottomColor: "#aaa9a7",
    },
    promptListItemText: {
      color: "#26352e",
      fontSize: scale(16),
      lineHeight: scale(23),
    },
    promptListLoading: {
      paddingVertical: scale(30),
    },
    promptListError: {
      alignItems: "center",
      gap: scale(12),
      padding: scale(20),
    },
    promptListErrorText: {
      color: "#7d879e",
      fontSize: scale(15),
      textAlign: "center",
    },
    promptListEmpty: {
      color: "#7d879e",
      fontSize: scale(16),
      padding: scale(20),
      textAlign: "center",
    },
    promptAnswerInput: {
      height: metrics.vh(27),
      marginTop: scale(17),
      marginHorizontal: scale(4),
      borderWidth: scale(1.5),
      borderColor: "#d7d7d7",
      borderRadius: scale(18),
      padding: scale(20),
      color: "#111",
      fontSize: scale(17),
      lineHeight: scale(24),
    },
    matchingGoalContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(3.6),
      paddingTop: scale(46),
    },
    matchingGoalSubtitle: {
      color: "#7d879e",
      fontSize: scale(17),
      marginHorizontal: scale(8),
      marginBottom: scale(24),
    },
    matchingGoalOption: {
      minHeight: scale(48),
      alignSelf: "flex-start",
      maxWidth: "100%",
      justifyContent: "center",
      marginBottom: scale(12),
      paddingVertical: scale(12),
      paddingHorizontal: scale(24),
      borderRadius: scale(32),
      backgroundColor: "#dfe2e8",
    },
    matchingGoalOptionSelected: {
      backgroundColor: "#2dbcc4",
    },
    matchingGoalOptionText: {
      color: "#7d879e",
      fontSize: scale(16),
      lineHeight: scale(24),
    },
    matchingGoalOptionTextSelected: {
      color: "#fff",
    },
    matchingGoalLoading: {
      marginTop: scale(60),
    },
    matchingGoalError: {
      alignItems: "center",
      marginTop: scale(40),
      gap: scale(12),
    },
    matchingGoalErrorText: {
      color: "#7d879e",
      fontSize: scale(16),
      textAlign: "center",
    },
    priorExperienceContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(6.5),
      paddingTop: scale(46),
    },
    priorExperienceQuestion: {
      color: "#7d879e",
      fontSize: scale(17),
      lineHeight: scale(24),
      marginBottom: scale(30),
    },
    priorExperienceOption: {
      minHeight: scale(54),
      maxWidth: "100%",
      alignSelf: "center",
      justifyContent: "center",
      marginBottom: scale(30),
      paddingVertical: scale(14),
      paddingHorizontal: scale(24),
      borderRadius: scale(32),
      backgroundColor: "#dfe2e8",
    },
    priorExperienceOptionText: {
      textAlign: "center",
    },
    founderCountContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(3.6),
      paddingTop: scale(42),
    },
    founderCountStatus: {
      color: "#7d879e",
      fontSize: scale(17),
      marginHorizontal: scale(8),
    },
    skillsExpertiseContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(5.8),
      paddingTop: scale(40),
      paddingBottom: scale(24),
    },
    skillsSelectionStatus: {
      color: "#7d879e",
      fontSize: scale(17),
      marginBottom: scale(18),
    },
    skillsQuestion: {
      color: "#7d879e",
      fontSize: scale(17),
      lineHeight: scale(24),
      marginBottom: scale(52),
    },
    skillsOptions: {
      // flexDirection: "row",
      // flexWrap: "wrap",
      // alignItems: "center",
      // columnGap: scale(20),
      // rowGap: scale(36),
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: scale(18),
    },
    skillsOption: {
      // minHeight: scale(52),
      // minWidth: scale(120),
      // paddingHorizontal: scale(24),
      // alignItems: "center",
      // justifyContent: "center",
      // borderRadius: scale(28),
      // backgroundColor: "#dfe2e8",
      width: "48%",
      minHeight: scale(46),
      paddingHorizontal: scale(15),
      borderRadius: scale(28),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#dfe2e8",
    },
    skillsOptionSelected: {
      backgroundColor: "#2dbcc4",
    },
    skillsOptionText: {
      color: "#7d879e",
      fontSize: scale(16),
    },
    skillsOptionTextSelected: {
      color: "#fff",
    },
    skillsHelper: {
      color: "#7d879e",
      fontSize: scale(16),
      lineHeight: scale(24),
      marginTop: scale(36),
    },
    skillsLoading: {
      marginTop: scale(60),
    },
    skillsError: {
      alignItems: "center",
      marginTop: scale(40),
      gap: scale(12),
    },
    skillsErrorText: {
      color: "#7d879e",
      fontSize: scale(16),
      textAlign: "center",
    },
    skillsSelectionMessage: {
      color: "#c44f4f",
      fontSize: scale(14),
      lineHeight: scale(21),
      textAlign: "center",
    },
    industryInterestContent: {
      paddingHorizontal: metrics.vw(5.8),
      paddingTop: scale(18),
      paddingBottom: scale(24),
    },
    industrySelectionMessage: {
      color: "#7d879e",
      fontSize: scale(14),
      marginBottom: scale(16),
    },
    industryPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: scale(18),
    },
    industryPill: {
      width: "48%",
      minHeight: scale(46),
      paddingHorizontal: scale(10),
      borderRadius: scale(28),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#dfe2e8",
    },
    industryPillSelected: {
      backgroundColor: "#2dbcc4",
    },
    industryPillText: {
      color: "#7d879e",
      fontSize: scale(16),
    },
    industryPillTextSelected: {
      color: "#fff",
    },
    industryLoading: {
      marginTop: scale(60),
    },
    industryError: {
      alignItems: "center",
      marginTop: scale(40),
      gap: scale(12),
    },
    industryErrorText: {
      color: "#7d879e",
      fontSize: scale(16),
      textAlign: "center",
    },
    industryRetryText: {
      color: "#20b8c2",
      fontSize: scale(17),
      fontWeight: "600",
    },
    equitySplitContent: {
      flex: 1,
      paddingHorizontal: metrics.vw(5.8),
      paddingTop: scale(40),
    },
    equityStatus: {
      color: "#7d879e",
      fontSize: scale(17),
      marginBottom: scale(18),
    },
    equityQuestion: {
      color: "#7d879e",
      fontSize: scale(17),
      lineHeight: scale(24),
      marginBottom: scale(12),
    },
    equityOptions: {
      marginBottom: scale(28),
    },
    equityOption: {
      minHeight: scale(62),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
    },
    equityRadio: {
      width: scale(28),
      height: scale(28),
      borderWidth: scale(2.5),
      borderColor: "#7d879e",
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    equityRadioSelected: {
      borderColor: "#12aebb",
    },
    equityRadioDot: {
      width: scale(14),
      height: scale(14),
      borderRadius: scale(7),
      backgroundColor: "#12aebb",
    },
    equityOptionText: {
      flex: 1,
      color: "#555",
      fontSize: scale(16),
      lineHeight: scale(22),
    },
    equityRangeQuestion: {
      color: "#7d879e",
      fontSize: scale(17),
      lineHeight: scale(24),
      marginBottom: scale(36),
    },
    equityRangeContainer: {
      paddingHorizontal: scale(2),
    },
    equityRangeLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: scale(36),
    },
    equityRangeTitle: {
      color: "#080808",
      fontSize: scale(16),
      fontWeight: "700",
    },
    equityRangeValue: {
      color: "#7d879e",
      fontSize: scale(16),
    },
    equitySliderTrack: {
      height: scale(40),
      marginHorizontal: scale(8),
      justifyContent: "center",
    },
    equitySliderLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: scale(4),
      borderRadius: scale(2),
      backgroundColor: "#2dbcc4",
    },
    equitySliderHandle: {
      position: "absolute",
      top: "50%",
      width: scale(22),
      height: scale(22),
      marginTop: scale(-11),
      marginLeft: scale(-11),
      borderRadius: scale(11),
      backgroundColor: "#2dbcc4",
    },
    founderCountQuestion: {
      color: "#7d879e",
      fontSize: scale(17),
      marginHorizontal: scale(8),
      marginTop: scale(8),
    },
    founderCounter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(48),
      marginTop: scale(18),
    },
    founderCounterButton: {
      minWidth: scale(34),
      minHeight: scale(44),
      alignItems: "center",
      justifyContent: "center",
    },
    founderCounterMinus: {
      color: "#7d879e",
      fontSize: scale(27),
      fontWeight: "700",
    },
    founderCounterPlus: {
      color: "#2dbcc4",
      fontSize: scale(30),
      fontWeight: "700",
    },
    founderCounterValue: {
      minWidth: scale(24),
      color: "#080808",
      fontSize: scale(25),
      fontWeight: "700",
      textAlign: "center",
    },
    hiringQuestion: {
      color: "#7d879e",
      fontSize: scale(17),
      marginTop: scale(22),
      marginBottom: scale(12),
      marginHorizontal: scale(16),
    },
    hiringOption: {
      minHeight: scale(56),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(20),
      paddingHorizontal: scale(20),
    },
    hiringRadio: {
      width: scale(28),
      height: scale(28),
      borderWidth: scale(2.5),
      borderColor: "#7d879e",
      borderRadius: scale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    hiringRadioSelected: {
      borderColor: "#12aebb",
    },
    hiringRadioDot: {
      width: scale(14),
      height: scale(14),
      borderRadius: scale(7),
      backgroundColor: "#12aebb",
    },
    hiringOptionText: {
      color: "#555",
      fontSize: scale(17),
    },
    sectionBlock: { marginTop: scale(22) },
    roleOptions: {
      minHeight: scale(46),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(8),
    },
    roleOption: {
      flex: 1,
      minHeight: scale(44),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: scale(8),
      borderRadius: scale(24),
    },
    roleOptionActive: { backgroundColor: "#e0e4e9" },
    roleIcon: { width: scale(20), height: scale(20) },
    roleLabel: { color: "#111", fontSize: scale(15), fontWeight: "700" },
    roleLabelActive: { color: "#111" },
    helperText: {
      color: "#7d879e",
      fontSize: scale(14),
      lineHeight: scale(21),
      marginTop: scale(8),
    },
    ideaCard: {
      minHeight: scale(138),
      borderWidth: scale(1.5),
      borderColor: "#aaa9a7",
      borderRadius: scale(18),
      padding: scale(14),
    },
    cardTitle: { color: "#111", fontSize: scale(15), fontWeight: "700" },
    ideaPreview: {
      marginTop: scale(8),
      color: "#7d879e",
      fontSize: scale(15),
      lineHeight: scale(22),
    },
    sectionTitle: {
      color: "#7d879e",
      fontSize: scale(18),
      fontWeight: "700",
      paddingHorizontal: scale(8),
      paddingBottom: scale(14),
    },
    promptCard: {
      borderWidth: scale(1.5),
      borderColor: "#aaa9a7",
      borderRadius: scale(18),
      padding: scale(16),
      marginTop: scale(10),
    },
    promptPlaceholderTitle: {
      color: "#111",
      fontSize: scale(15),
      fontWeight: "700",
    },
    promptPlaceholderSubtitle: {
      color: "#7d879e",
      fontSize: scale(15),
      lineHeight: scale(22),
      marginTop: scale(8),
    },
    promptAnswer: {
      color: "#7d879e",
      fontSize: scale(15),
      lineHeight: scale(22),
      marginTop: scale(8),
    },
    detailRow: {
      minHeight: scale(74),
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#d7d5cd",
      paddingHorizontal: scale(12),
      paddingVertical: scale(12),
    },
    detailCopy: { flex: 1, minWidth: 0 },
    detailTitle: { color: "#111", fontSize: scale(17), fontWeight: "700" },
    detailValue: {
      color: "#7d879e",
      fontSize: scale(14),
      lineHeight: scale(20),
      marginTop: scale(5),
    },
    mutedValue: { fontStyle: "italic" },
    chevron: { color: "#111", fontSize: scale(32), marginLeft: scale(10) },
    historySection: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#d7d5cd",
    },
    historyHeader: {
      minHeight: scale(72),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: scale(8),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#d7d5cd",
    },
    historyHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(16),
    },
    historyHeaderIcon: { width: scale(34), height: scale(34) },
    historyAddButton: {
      minWidth: scale(36),
      minHeight: scale(44),
      alignItems: "center",
      justifyContent: "center",
    },
    addIcon: { color: "#596772", fontSize: scale(34), lineHeight: scale(38) },
    historyRow: {
      minHeight: scale(132),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(20),
      paddingHorizontal: scale(8),
      paddingVertical: scale(16),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#d7d5cd",
    },
    historyIconWrap: {
      width: scale(88),
      height: scale(88),
      borderRadius: scale(10),
      backgroundColor: "#e0e4e9",
      alignItems: "center",
      justifyContent: "center",
    },
    historyIcon: { width: "68%", height: "68%", tintColor: "#929aa2" },
    historyCopy: { flex: 1, minWidth: 0 },
    historyTitle: { color: "#111", fontSize: scale(17), fontWeight: "700" },
    historyOrganization: {
      color: "#111",
      fontSize: scale(17),
      marginTop: scale(4),
    },
    historyDates: {
      color: "#7d879e",
      fontSize: scale(14),
      lineHeight: scale(19),
      marginTop: scale(4),
    },
    historyDescription: {
      color: "#7d879e",
      fontSize: scale(14),
      lineHeight: scale(19),
      fontStyle: "italic",
      marginTop: scale(2),
    },
  });
}
