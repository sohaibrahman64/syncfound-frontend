import React, { useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Image,
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
  getMyProfileIndustries,
  getMyProfileLinkedinDetails,
  getPrompts,
} from "../utils/backendAuth";
import { apiFetch } from "../utils/apiClient";
import { withPlatformFontStyles } from "../utils/typography";

const PROMPT_SLOTS = ["prompt-1", "prompt-2", "prompt-3"];
const MAX_INDUSTRY_SELECTION = 5;
const PRIOR_STARTUP_EXPERIENCE_OPTIONS = [
  "Sold a startup",
  "Founded/cofounded a company",
  "Worked in a startup",
  "No prior startup experience",
];

const BACKGROUND_ROWS = [
  { title: "Matching Goal*", value: "Have some ideas but open to exploring" },
  { title: "Commitment Level*", value: "Ready to go full-time with the right co-founder" },
  { title: "Number of Founders", value: "Not selected", muted: true },
  { title: "Skills & Expertise*", value: "AI/ML, Design, Engineering" },
  { title: "Equity Split", value: "Not Selected", muted: true },
];

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
        <Text style={[styles.detailValue, muted && styles.mutedValue]}>{value}</Text>
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

function NameProfileEditScreen({ initialFirstName, initialLastName, onDone, metrics }) {
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
    ? `${dateOfBirth.getFullYear()}-${String(dateOfBirth.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(dateOfBirth.getDate()).padStart(2, "0")}`
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

function LocationProfileEditScreen({ initialLocation, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [city, setCity] = useState(initialLocation.city);
  const [openToRemote, setOpenToRemote] = useState(initialLocation.openToRemote);
  const [workPreference, setWorkPreference] = useState(initialLocation.workPreference);
  const [willingToRelocate, setWillingToRelocate] = useState(
    initialLocation.willingToRelocate,
  );
  const workOptions = [
    "Hybrid (Onsite or remote)",
    "Onsite preferred",
    "Remote preferred",
    "Remote only",
  ];

  return (
    <View style={styles.screen}>
      <ProfileEditorHeader
        title="Location"
        onBack={() =>
          onDone({ city: city.trim(), openToRemote, workPreference, willingToRelocate })
        }
        onDone={() =>
          onDone({ city: city.trim(), openToRemote, workPreference, willingToRelocate })
        }
        styles={styles}
      />
      <ScrollView
        contentContainerStyle={styles.profileLocationContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.profileFieldSubtitle}>Where are you based?</Text>
        <TextInput
          accessibilityLabel="Your city"
          value={city}
          onChangeText={setCity}
          placeholder="Your city*"
          placeholderTextColor="#7d879e"
          autoCapitalize="words"
          style={styles.profileUnderlineInput}
        />
        <Text style={styles.profileLocationQuestion}>
          Are you open to work remotely?
        </Text>
        <ProfileRadioOption
          label="Yes"
          selected={openToRemote}
          onPress={() => setOpenToRemote(true)}
          styles={styles}
        />
        <ProfileRadioOption
          label="No"
          selected={!openToRemote}
          onPress={() => setOpenToRemote(false)}
          styles={styles}
        />
        <Text style={styles.profileLocationQuestion}>
          What is your preference of working remotely?
        </Text>
        {workOptions.map((option) => (
          <ProfileRadioOption
            key={option}
            label={option}
            selected={workPreference === option}
            onPress={() => setWorkPreference(option)}
            styles={styles}
          />
        ))}
        <Text style={styles.profileLocationQuestion}>
          Are you willing to relocate?
        </Text>
        <ProfileRadioOption
          label="Yes"
          selected={willingToRelocate}
          onPress={() => setWillingToRelocate(true)}
          styles={styles}
        />
        <ProfileRadioOption
          label="No"
          selected={!willingToRelocate}
          onPress={() => setWillingToRelocate(false)}
          styles={styles}
        />
      </ScrollView>
    </View>
  );
}

function LinkedinProfileEditScreen({ initialUrl, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [linkedinUrl, setLinkedinUrl] = useState(initialUrl);

  return (
    <View style={styles.screen}>
      <ProfileEditorHeader
        title="LinkedIn"
        onBack={() => onDone(linkedinUrl.trim())}
        onDone={() => onDone(linkedinUrl.trim())}
        styles={styles}
      />
      <View style={styles.profileFieldContent}>
        <TextInput
          accessibilityLabel="LinkedIn profile URL"
          value={linkedinUrl}
          onChangeText={setLinkedinUrl}
          placeholder="linkedin.com/in/your-profile"
          placeholderTextColor="#a2a2a2"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.profileUnderlineInput}
        />
        <View style={styles.profileLinkedinPreview}>
          <Text style={styles.profileLinkedinPreviewText}>
            LinkedIn Profile Preview
          </Text>
        </View>
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

function ProfileHistorySection({ title, headerIcon, itemIcon, items, styles }) {
  return (
    <View style={styles.historySection}>
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.historyHeaderActions}>
          <Image source={headerIcon} style={styles.historyHeaderIcon} resizeMode="contain" />
          <Text style={styles.addIcon}>+</Text>
        </View>
      </View>
      {items.map((item) => (
        <View key={`${item.title}-${item.organization}`} style={styles.historyRow}>
          <View style={styles.historyIconWrap}>
            <Image source={itemIcon} style={styles.historyIcon} resizeMode="contain" />
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
              style={[styles.historyDescription, item.muted && styles.mutedValue]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      ))}
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
                  accessibilityState={{ selected: selectedPrompt === prompt.text }}
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
const SKILL_OPTIONS = ["AI/ML", "Design", "Engineering", "Operations", "Sales/Marketing"];
const EQUITY_SPLIT_OPTIONS = [
  "Fully Negotiable",
  "Equal split",
  "Willing to accept a specific equity range",
  "Willing to offer specific equity range",
];

function MatchingGoalEditScreen({ initialGoal, initialHiring, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [selectedGoal, setSelectedGoal] = useState(initialGoal);
  const [isHiring, setIsHiring] = useState(initialHiring);
  const [matchingGoals, setMatchingGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const MATCHING_GOALS_ENDPOINT = '/matching-goals';

  useEffect(() => {
    let isMounted = true;

    const fetchMatchingGoals = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const response = await apiFetch(MATCHING_GOALS_ENDPOINT, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
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
          .map(item => String(item?.matching_goal || '').trim())
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
          setErrorMessage('Could not load matching goals. Please try again.');
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
            <Text style={styles.matchingGoalSubtitle}>Select Your matching goal</Text>
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
                  {isHiring === hiring ? <View style={styles.hiringRadioDot} /> : null}
                </View>
                <Text style={styles.hiringOptionText}>{hiring ? "Yes" : "No"}</Text>
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
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const COMMITMENT_LEVELS_ENDPOINT = '/commitment-levels';

  useEffect(() => {
    let isMounted = true;

    const fetchCommitmentLevels = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const response = await apiFetch(COMMITMENT_LEVELS_ENDPOINT, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load commitment levels: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        // Extract commitment_level field from each dictionary
        const levels = list
          .map(item => String(item?.commitment_level || '').trim())
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
          setErrorMessage('Could not load commitment levels. Please try again.');
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
  const [selectedExperience, setSelectedExperience] =
    useState(initialExperience);

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
        <Text style={styles.priorExperienceQuestion}>
          Do you have any startup experience?
        </Text>
        {PRIOR_STARTUP_EXPERIENCE_OPTIONS.map((experience) => {
          const selected = selectedExperience === experience;
          return (
            <Pressable
              key={experience}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSelectedExperience(experience)}
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
                {experience}
              </Text>
            </Pressable>
          );
        })}
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
          <Text accessibilityLabel="Founder count" style={styles.founderCounterValue}>
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
  // Try multiple possible fields for the skill name/label
  const skillName = String(
    item?.skill_name ||
    item?.skillName ||
    item?.label ||
    item?.name ||
    item?.title ||
    item?.description ||
    item?.skill_title ||
    item?.skill_description ||
    item?.display_name ||
    item?.displayName ||
    item?.skill ||
    item?.value ||
    item?.expertise ||
    item?.tech ||
    item?.technology ||
    ""
  ).trim();

  if (!skillName) {
    return null;
  }

  // Try multiple possible fields for the skill ID/value
  const value =
    item?.id ||
    item?.skill_id ||
    item?.skillId ||
    item?.code ||
    item?.skill_code ||
    item?.skillCode ||
    skillName; // fallback to skillName if no ID field found

  return { value, skillName };
}

function SkillsExpertiseEditScreen({ initialSkills, initialOptions, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [skillOptions, setSkillOptions] = useState(initialOptions);
  const [selectedSkills, setSelectedSkills] = useState(() => {
    if (Array.isArray(initialSkills)) {
      return initialSkills
        .map((value) => {
          if (typeof value === 'number') {
            return value;
          }
          return String(value || '').trim();
        })
        .filter(Boolean);
    }

    const single = typeof initialSkills === 'number'
      ? initialSkills
      : String(initialSkills || '').trim();
    return single ? [single] : [];
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionMessage, setSelectionMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const USER_SKILLS_ENDPOINT = '/user-skills';

  useEffect(() => {
    let isMounted = true;

    const fetchUserSkills = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const response = await apiFetch(USER_SKILLS_ENDPOINT, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load user skills: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mapped = list
          .map(toSkillModel)
          .filter((item) => Boolean(item?.label));

        if (isMounted) {
          setSkillOptions(mapped);
          setSelectedSkills((prev) => prev.map((selectedSkill) => {
            const matchedSkill = mapped.find((item) => (
              item.value === selectedSkill || item.label === selectedSkill
            ));
            return matchedSkill ? matchedSkill.value : selectedSkill;
          }));
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Could not load user skills. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserSkills();

    return () => {
      isMounted = false;
    };
  }, [retryKey, initialOptions]);

  function toggleSkill(value) {
    setSelectedSkills((prev) => {
      if (prev.includes(value)) {
        setSelectionMessage('');
        return prev.filter((skill) => skill !== value);
      }

      if (prev.length >= 5) {
        setSelectionMessage('Sorry. You can select upto 5 skills');
        return prev;
      }

      setSelectionMessage('');
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
              Include skills and expertise that your cofounders own, if applicable
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function toIndustryModel(item) {
  // Try multiple possible fields for the industry name/label
  const label = String(
    item?.industry_name ||
    item?.industryName ||
    item?.name ||
    item?.title ||
    item?.description ||
    item?.industry_title ||
    item?.industry_description ||
    item?.display_name ||
    item?.displayName ||
    ""
  ).trim();

  if (!label) {
    return null;
  }

  // Try multiple possible fields for the industry ID/value
  const value =
    item?.id ||
    item?.industry_id ||
    item?.industryId ||
    item?.code ||
    item?.industry_code ||
    item?.industryCode ||
    label; // fallback to label if no ID field found

  return { value, label };
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
  const [selectedIndustries, setSelectedIndustries] = useState(initialIndustries);
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
          getMyProfileIndustries(firebaseToken),
        ]);
        const mapped = industriesPayload.map(toIndustryModel).filter(Boolean);
        const selected = selectedPayload
          .map(toIndustryModel)
          .filter(Boolean)
          .map((industry) =>
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
        const delta = Math.round(
          (gestureState.dx / trackWidthRef.current) * rangeSpan / 5,
        ) * 5;
        const startRange = initialRangeRef.current;
        const nextValue = Math.max(10, Math.min(90, startRange[handle] + delta));
        onRangeChange((currentRange) => {
          const nextRange = [...currentRange];
          nextRange[handle] = handle === 0
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

function EquitySplitEditScreen({ initialOption, initialRange, onDone, metrics }) {
  const styles = createStyles(metrics);
  const [selectedOption, setSelectedOption] = useState(initialOption);
  const [equityRange, setEquityRange] = useState(initialRange);
  const [equitySplitOptions, setEquitySplitOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const EQUITY_SPLIT_ENDPOINT = '/equity-split';

  useEffect(() => {
    let isMounted = true;

    const fetchEquitySplitOptions = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const response = await apiFetch(EQUITY_SPLIT_ENDPOINT, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load equity split options: ${response.status}`);
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
          if (typeof list[0] === 'string') {
            // Array of strings
            options = list.map(item => String(item).trim()).filter(Boolean);
          } else if (typeof list[0] === 'object' && list[0] !== null) {
            // Array of objects - try common field names
            options = list
              .map(item =>
                String(
                  item?.equity_split_option ||
                  item?.option ||
                  item?.label ||
                  item?.name ||
                  item?.value ||
                  ''
                ).trim()
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
          if (initialOption && ![
            "Fully Negotiable",
            "Equal split",
            "Willing to accept a specific equity range",
            "Willing to offer specific equity range",
          ].includes(initialOption)) {
            setSelectedOption(initialOption);
          }
          setErrorMessage('Could not load equity split options. Please try again.');
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

  const rangeQuestion = selectedOption === equitySplitOptions[2]
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
            <Text style={styles.equityStatus}>
              {selectedOption || "Not Selected"}
            </Text>
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
  profileImageUrl = "",
  firebaseToken = "",
  initialDateOfBirth = "",
  onClose,
  onSave,
}) {
  const metrics = useResponsiveMetrics();
  const styles = createStyles(metrics);
  const [activeTab, setActiveTab] = useState("Edit");
  const [selectedRole, setSelectedRole] = useState("Founder");
  const [headline, setHeadline] = useState("");
  const [idea, setIdea] = useState("");
  const [isEditingHeadline, setIsEditingHeadline] = useState(false);
  const [isEditingIdea, setIsEditingIdea] = useState(false);
  const [editingPromptIndex, setEditingPromptIndex] = useState(null);
  const [isEditingMatchingGoal, setIsEditingMatchingGoal] = useState(false);
  const [isEditingCommitmentLevel, setIsEditingCommitmentLevel] = useState(false);
  const [isEditingPriorStartupExperience, setIsEditingPriorStartupExperience] =
    useState(false);
  const [isEditingFounderCount, setIsEditingFounderCount] = useState(false);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [isEditingIndustries, setIsEditingIndustries] = useState(false);
  const [isEditingEquitySplit, setIsEditingEquitySplit] = useState(false);
  const [editingProfileField, setEditingProfileField] = useState("");
  const [matchingGoal, setMatchingGoal] = useState(
    "Have some ideas but open to exploring",
  );
  const [commitmentLevel, setCommitmentLevel] = useState(
    "Ready to go full-time with the right cofounder",
  );
  const [priorStartupExperience, setPriorStartupExperience] = useState(
    "No prior startup experience",
  );
  const [founderCount, setFounderCount] = useState(0);
  const [skills, setSkills] = useState([]);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [skillOptions, setSkillOptions] = useState([]);
  const [equitySplitOption, setEquitySplitOption] = useState("");
  const [equityRange, setEquityRange] = useState([10, 90]);
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
  const [profileLocation, setProfileLocation] = useState(undefined);
  const [linkedinUrl, setLinkedinUrl] = useState(undefined);
  const [schedulingLink, setSchedulingLink] = useState(undefined);
  const [profileExperiences, setProfileExperiences] = useState([]);
  const [profileEducation, setProfileEducation] = useState([]);
  const profileScrollOffset = useRef(0);
  const editable = activeTab === "Edit";

  useEffect(() => {
    async function fetchLinkedinDetails() {
      if (firebaseToken) {
        try {
          const data = await getMyProfileLinkedinDetails(firebaseToken);

          // Transform experience
          const experiences = (data.experience || []).map(exp => {
            // Format dates
            let datesStr = '';
            if (exp.start_date) {
              const startMonth = new Date(exp.start_date.year, exp.start_date.month - 1).toLocaleString('en-US', { month: 'short' });
              const startYear = exp.start_date.year;
              if (exp.end_date && !exp.is_current) {
                const endMonth = new Date(exp.end_date.year, exp.end_date.month - 1).toLocaleString('en-US', { month: 'short' });
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
              title: exp.title || '',
              organization: exp.company || '',
              dates: datesStr,
              description: exp.description || '',
              muted: false,
            };
          });

          // Transform education
          const education = (data.education || []).map(edu => {
            let datesStr = '';
            if (edu.start_date) {
              const startMonth = new Date(edu.start_date.year, edu.start_date.month - 1).toLocaleString('en-US', { month: 'short' });
              const startYear = edu.start_date.year;
              if (edu.end_date) {
                const endMonth = new Date(edu.end_date.year, edu.end_date.month - 1).toLocaleString('en-US', { month: 'short' });
                const endYear = edu.end_date.year;
                datesStr = `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
              } else {
                datesStr = `${startMonth} ${startYear} - Present`;
              }
            }
            return {
              title: edu.school || '',
              organization: edu.degree_name || edu.degree || '',
              dates: datesStr,
              description: edu.field_of_study || '',
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
        initialValue={idea}
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
        initialSkills={skills}
        initialOptions={skillOptions}
        onDone={(selectedSkills, options) => {
          setSkills(selectedSkills);
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
        initialLocation={
          profileLocation || {
            city: "",
            openToRemote: true,
            workPreference: "Hybrid (Onsite or remote)",
            willingToRelocate: true,
          }
        }
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
          linkedinUrl ?? "https://www.linkedin.com/in/sohaib-rahman-a5"
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
            onPress={() => setActiveTab(tab)}
            style={styles.modeTab}
          >
            <Text style={[styles.modeTabText, activeTab === tab && styles.modeTabTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
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
        <View style={styles.photoHeadlineRow}>
          <View style={styles.photoColumn}>
            <Text style={styles.fieldLabel}>My Photo</Text>
            <View style={styles.photoWrap}>
              <Image
                source={profileImageUrl ? { uri: profileImageUrl } : require("../assets/user.png")}
                style={styles.profilePhoto}
                resizeMode="cover"
              />
              {editable ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Edit photo" style={styles.photoEditButton}>
                  <Image source={require("../assets/edit.png")} style={styles.photoEditIcon} />
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
            {[
              { label: "Founder", icon: "♙" },
              { label: "Talent", icon: "☆" },
              { label: "Both", icon: "" },
            ].map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedRole === option.label }}
                disabled={!editable}
                onPress={() => setSelectedRole(option.label)}
                style={[styles.roleOption, selectedRole === option.label && styles.roleOptionActive]}
              >
                {!!option.icon && <Text style={styles.roleIcon}>{option.icon}</Text>}
                <Text style={[styles.roleLabel, selectedRole === option.label && styles.roleLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helperText}>
            You will be shown as a {selectedRole.toLowerCase()} on your profile
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
              {idea || "Write your idea here"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>My Prompts</Text>
          <Text style={styles.helperText}>Tap on tile to edit, long press to reorder</Text>
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
                {promptTitles[index] || promptAnswers[index] || "Select a prompt"}
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

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>My Background as a Founder</Text>
          {BACKGROUND_ROWS.map((row) => (
            <DetailRow
              key={row.title}
              {...row}
              value={
                row.title === "Number of Founders"
                  ? founderCount === 0
                    ? "Not Selected"
                    : String(founderCount)
                  : row.title.startsWith("Skills & Expertise")
                    ? skills.length
                      ? skills
                          .map((value) =>
                            skillOptions.find((option) => option.value === value)?.skillName ||
                              String(value),
                          )
                          .join(", ")
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
                row.title.startsWith("Matching Goal")
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
                row.title === "Number of Founders"
                  ? founderCount === 0
                  : row.title.startsWith("Skills & Expertise")
                    ? skills.length === 0
                    : row.title === "Equity Split"
                      ? !equitySplitOption
                    : row.muted
              }
              styles={styles}
            />
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>More About Me</Text>
          {ABOUT_ROWS.map((row) => (
            <DetailRow
              key={row.title}
              {...row}
              value={
                row.title === "Industries & Interests" && selectedIndustries.length
                  ? selectedIndustries
                      .map((value) =>
                        industryOptions.find((option) => option.value === value)?.label || String(value),
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
                profileName === null
                  ? "Sohaib Rahman"
                  : `${profileName.firstName} ${profileName.lastName}`.trim() ||
                    "Not Selected"
              }
              onPress={() => setEditingProfileField("name")}
              styles={styles}
            />
            <DetailRow
              title="Age"
              value={
                dateOfBirth === undefined
                  ? "40 years old"
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
                  ? "Mumbai, Maharashtra, India. Remote only."
                  : [
                      profileLocation.city,
                      profileLocation.workPreference,
                      profileLocation.willingToRelocate ? "Willing to relocate" : "",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not Selected"
              }
              onPress={() => setEditingProfileField("location")}
              styles={styles}
            />
            <DetailRow
              title="LinkedIn"
              value={
                linkedinUrl ??
                "https://www.linkedin.com/in/sohaib-rahman-a5"
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
            styles={styles}
          />
          <ProfileHistorySection
            title="My Education"
            headerIcon={require("../assets/linkedin.png")}
            itemIcon={require("../assets/graduation.png")}
            items={profileEducation}
            styles={styles}
          />
        </View>
      </ScrollView>
    </View>
  );
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
    photoHeadlineRow: { flexDirection: "row", gap: scale(14), alignItems: "flex-end" },
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
    photoEditIcon: { width: scale(21), height: scale(21), resizeMode: "contain" },
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
      borderRadius: scale(18),
      padding: scale(24),
      backgroundColor: "#fff",
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
    profileLinkedinPreviewText: {
      color: "#a2a2a2",
      fontSize: scale(17),
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
      marginTop: scale(22),
      borderRadius: scale(18),
      padding: scale(24),
      backgroundColor: "#fff",
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
      minHeight: scale(70),
      paddingHorizontal: scale(24),
      borderWidth: scale(1.5),
      borderColor: "#d7d7d7",
      borderRadius: scale(18),
      backgroundColor: "#fff",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    promptSelectorText: {
      color: "#080808",
      fontSize: scale(17),
      fontWeight: "700",
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
      backgroundColor: "#fff",
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
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      columnGap: scale(20),
      rowGap: scale(36),
    },
    skillsOption: {
      minHeight: scale(52),
      minWidth: scale(120),
      paddingHorizontal: scale(24),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: scale(28),
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
    roleIcon: { color: "#292929", fontSize: scale(22) },
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