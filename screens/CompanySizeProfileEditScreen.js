import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../utils/apiClient";
import { useResponsiveMetrics } from "../utils/responsive";
import { withPlatformFontStyles } from "../utils/typography";
import CompanySizeInterestLevelPicker, {
  getCompanySizeSelectionLabel,
} from "./CompanySizeInterestLevelPicker";

export const COMPANY_SIZE_FIELDS = [
  { key: "founding", label: "Founding (1-5 employees)" },
  { key: "growing", label: "Growing (6-10 employees)" },
  { key: "scaling", label: "Scaling (11-50 employees)" },
  { key: "midSize", label: "Mid-size (50-100 employees)" },
  { key: "large", label: "Large (200-1000 employees)" },
  { key: "enterprise", label: "Enterprise (>1000 employees)" },
];

const OPTION_LABEL_KEYS = [
  "company_size_interest_level",
  "company_size_interest_level_name",
  "interest_level",
  "interest_level_name",
  "company_size_interest_level_label",
  "label",
  "name",
  "title",
  "value",
];

function toInterestLevelOption(item) {
  if (typeof item === "string" || typeof item === "number") {
    return { id: String(item), label: String(item), description: "" };
  }

  const labelValue = OPTION_LABEL_KEYS.map((key) => item?.[key]).find(
    (value) => value !== undefined && value !== null && value !== "",
  );
  const label =
    typeof labelValue === "object"
      ? getCompanySizeSelectionLabel(labelValue)
      : String(labelValue ?? "").trim();

  return {
    id:
      item?.company_size_interest_level_id ??
      item?.interest_level_id ??
      item?.id ??
      label,
    label,
    description: String(item?.description ?? "").trim(),
  };
}

function extractInterestLevelList(payload) {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;

  const listKeys = [
    "company_size_interest_levels",
    "company_size_interest_level",
    "companySizeInterestLevels",
    "results",
    "items",
  ];
  const listKey = listKeys.find((key) => Array.isArray(data?.[key]));
  return listKey ? data[listKey] : [];
}

export function normalizeCompanySizeSelections(value) {
  const selections = {};

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const companySize = String(
        item?.company_size_key ??
          item?.company_size_name ??
          item?.company_size ??
          item?.size ??
          item?.field_key ??
          "",
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (!companySize) return;
      const field = COMPANY_SIZE_FIELDS.find((candidate) => {
        const fieldLabel = candidate.label
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        return (
          companySize === candidate.key.toLowerCase() ||
          fieldLabel.includes(companySize) ||
          companySize.includes(candidate.key.toLowerCase())
        );
      });
      if (!field) return;

      const selected =
        item?.selected_interest_level ??
        item?.interest_level ??
        item?.company_size_interest_level ??
        item?.value ??
        item;
      selections[field.key] = normalizeSelection(selected);
    });
    return selections;
  }

  if (!value || typeof value !== "object") return selections;
  COMPANY_SIZE_FIELDS.forEach((field) => {
    const selection = value[field.key] ?? value[field.label];
    if (selection !== undefined && selection !== null && selection !== "") {
      selections[field.key] = normalizeSelection(selection);
    }
  });
  return selections;
}

function normalizeSelection(value) {
  if (value && typeof value === "object") {
    return {
      ...value,
      id:
        value.id ??
        value.company_size_interest_level_id ??
        value.interest_level_id ??
        null,
      label: getCompanySizeSelectionLabel(value),
    };
  }
  return { id: String(value), label: String(value) };
}

function matchOption(options, value) {
  if (!value) return null;
  const id = typeof value === "object" ? value.id : value;
  const label = getCompanySizeSelectionLabel(value).toLowerCase();
  return (
    options.find(
      (option) =>
        (id !== undefined && id !== null && String(option.id) === String(id)) ||
        (label && option.label.toLowerCase() === label),
    ) || null
  );
}

export default function CompanySizeProfileEditScreen({
  initialValue = {},
  onBack,
  onDone,
  metrics,
}) {
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const initialSelections = useMemo(
    () => normalizeCompanySizeSelections(initialValue),
    [initialValue],
  );
  const [selections, setSelections] = useState(initialSelections);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [openFieldKey, setOpenFieldKey] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInterestLevels() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await apiFetch("/company-size-interest-levels", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Failed to load company size interest levels: ${response.status}`);
        }

        const payload = await response.json();
        const nextOptions = extractInterestLevelList(payload)
          .map(toInterestLevelOption)
          .filter((option) => option.label);

        if (!isMounted) return;
        setOptions(nextOptions);
        setSelections((current) => {
          const nextSelections = { ...current };
          COMPANY_SIZE_FIELDS.forEach((field) => {
            const existing = current[field.key] || initialSelections[field.key];
            const matched = matchOption(nextOptions, existing);
            if (matched) nextSelections[field.key] = matched;
          });
          return nextSelections;
        });
      } catch {
        if (isMounted) {
          setErrorMessage(
            "Could not load company size interest levels. Please try again.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInterestLevels();
    return () => {
      isMounted = false;
    };
  }, [initialSelections, retryKey]);

  function handleBack() {
    if (onDone) onDone(selections);
    else onBack?.();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={handleBack}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.backArrow}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Company Size</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.question}>
          What company sizes are you interested in working at?
        </Text>

        <View style={styles.companySizeFields}>
          {COMPANY_SIZE_FIELDS.map((field) => (
            <CompanySizeInterestLevelPicker
              key={field.key}
              field={field}
              selectedOption={selections[field.key]}
              options={options}
              loading={loading}
              errorMessage={errorMessage}
              isOpen={openFieldKey === field.key}
              onOpen={() => setOpenFieldKey(field.key)}
              onClose={() => setOpenFieldKey("")}
              onRetry={() => setRetryKey((current) => current + 1)}
              onSelect={(option) => {
                setSelections((current) => ({
                  ...current,
                  [field.key]: option,
                }));
                setOpenFieldKey("");
              }}
              styles={styles}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(metrics) {
  const scale = metrics.moderateScale;
  return StyleSheet.create(withPlatformFontStyles({
    screen: { flex: 1, backgroundColor: "#f0eee5" },
    header: {
      minHeight: scale(72),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: metrics.vw(5),
    },
    headerAction: {
      width: scale(34),
      minHeight: scale(44),
      justifyContent: "center",
    },
    backArrow: { width: scale(32), height: scale(32) },
    headerTitle: {
      flex: 1,
      color: "#080808",
      fontSize: scale(25),
      fontWeight: "700",
      textAlign: "center",
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: metrics.vw(5.8),
      paddingTop: scale(10),
      paddingBottom: scale(36),
    },
    question: {
      color: "#a2a2a2",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginHorizontal: scale(4),
      marginBottom: scale(32),
    },
    companySizeFields: { gap: scale(42) },
    companySizeField: {
      minHeight: scale(52),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      paddingHorizontal: scale(4),
    },
    companySizeFieldText: {
      flex: 1,
      color: "#a2a2a2",
      fontSize: scale(18),
      lineHeight: scale(24),
      marginRight: scale(16),
    },
    companySizeSelectedFieldText: { color: "#595959" },
    companySizeChevron: { color: "#a2a2a2", fontSize: scale(16) },
    companySizeModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      paddingHorizontal: metrics.vw(7),
    },
    companySizeModalCard: {
      maxHeight: "78%",
      borderRadius: scale(18),
      backgroundColor: "#ffffff",
      padding: scale(22),
    },
    companySizeModalTitle: {
      color: "#111111",
      fontSize: scale(20),
      fontWeight: "700",
    },
    companySizeModalSubtitle: {
      color: "#7d879e",
      fontSize: scale(15),
      lineHeight: scale(21),
      marginTop: scale(5),
      marginBottom: scale(12),
    },
    companySizePickerLoading: { marginVertical: scale(24) },
    companySizePickerError: {
      color: "#777777",
      fontSize: scale(15),
      lineHeight: scale(22),
      marginVertical: scale(16),
    },
    companySizeRetryButton: { alignSelf: "flex-start", paddingVertical: scale(8) },
    companySizeRetryText: {
      color: "#2dbcc4",
      fontSize: scale(16),
      fontWeight: "600",
    },
    companySizeOptionsList: { flexGrow: 0, marginTop: scale(2) },
    companySizeModalOption: {
      minHeight: scale(52),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#d7d4ce",
      gap: scale(16),
    },
    companySizeModalOptionText: {
      flex: 1,
      color: "#555555",
      fontSize: scale(16),
      lineHeight: scale(22),
    },
    companySizeOptionRadio: {
      width: scale(22),
      height: scale(22),
      borderRadius: scale(12),
      borderWidth: scale(2),
      borderColor: "#7d879e",
      alignItems: "center",
      justifyContent: "center",
    },
    companySizeOptionRadioSelected: { borderColor: "#08a9b8" },
    companySizeOptionRadioDot: {
      width: scale(12),
      height: scale(12),
      borderRadius: scale(7),
      backgroundColor: "#08a9b8",
    },
  }));
}
