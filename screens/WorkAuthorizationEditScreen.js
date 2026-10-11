import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

const WORK_AUTHORIZATION_LABEL_KEYS = [
  "work_authorization",
  "work_authorization_name",
  "work_authorization_status",
  "authorization_name",
  "authorization",
  "label",
  "name",
  "title",
  "value",
];

export function getWorkAuthorizationLabel(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "object") return String(value);

  const label = WORK_AUTHORIZATION_LABEL_KEYS.map((key) => value[key]).find(
    (item) => item !== undefined && item !== null && item !== "",
  );
  return String(label ?? "").trim();
}

function normalizeWorkAuthorizationOption(item) {
  const label = getWorkAuthorizationLabel(item);
  if (!label) return null;

  return {
    id:
      item?.work_authorization_id ??
      item?.authorization_id ??
      item?.id ??
      label,
    label,
  };
}

function getWorkAuthorizationOptions(payload) {
  if (Array.isArray(payload)) return payload;

  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;

  const listKey = [
    "work_authorizations",
    "work_authorization",
    "work_authorization_options",
    "workAuthorizations",
    "workAuthorizationOptions",
    "results",
    "items",
  ].find((key) => Array.isArray(data?.[key]));

  return listKey ? data[listKey] : [];
}

function normalizeSelection(value) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "object") {
    return {
      ...value,
      id:
        value.work_authorization_id ??
        value.authorization_id ??
        value.id ??
        null,
      label: getWorkAuthorizationLabel(value),
    };
  }

  return { id: String(value), label: String(value) };
}

function findMatchingOption(options, selection) {
  if (!selection) return null;

  const selectedId = selection.id;
  const selectedLabel = getWorkAuthorizationLabel(selection).toLowerCase();
  return (
    options.find(
      (option) =>
        (selectedId !== undefined &&
          selectedId !== null &&
          String(option.id) === String(selectedId)) ||
        (selectedLabel && option.label.toLowerCase() === selectedLabel),
    ) || null
  );
}

export default function WorkAuthorizationEditScreen({
  initialValue,
  onBack,
  onDone,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const [selectedOption, setSelectedOption] = useState(() =>
    normalizeSelection(initialValue),
  );
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkAuthorizations() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await apiFetch("/work-authorizations", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load work authorizations: ${response.status}`,
          );
        }

        const payload = await response.json();
        const nextOptions = getWorkAuthorizationOptions(payload)
          .map(normalizeWorkAuthorizationOption)
          .filter(Boolean);

        if (!isMounted) return;
        setOptions(nextOptions);
        setSelectedOption((current) =>
          findMatchingOption(nextOptions, current) || current,
        );
      } catch {
        if (isMounted) {
          setErrorMessage(
            "Could not load work authorization options. Please try again.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadWorkAuthorizations();
    return () => {
      isMounted = false;
    };
  }, [retryKey]);

  function handleBack() {
    if (onDone) onDone(selectedOption);
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
        <Text style={styles.headerTitle}>Work Authorization</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.noticeCard}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>i</Text>
          </View>
          <Text style={styles.noticeText}>
            Only founders who are hiring can see your work authorization status
          </Text>
        </View>

        <Text style={styles.question}>
          What describes your U.S. work authorization?
        </Text>

        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading work authorization options"
            color="#08a9b8"
            style={styles.loadingIndicator}
          />
        ) : errorMessage ? (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : options.length ? (
          <View style={styles.optionsList}>
            {options.map((option) => {
              const selected =
                String(selectedOption?.id ?? selectedOption?.label ?? "") ===
                String(option.id ?? option.label);

              return (
                <Pressable
                  key={String(option.id ?? option.label)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setSelectedOption(option)}
                  style={styles.optionRow}
                >
                  <View
                    style={[
                      styles.radio,
                      selected && styles.radioSelected,
                    ]}
                  >
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.optionText}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.feedbackText}>
            No work authorization options are available.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(metrics) {
  const scale = metrics.moderateScale;
  return StyleSheet.create(
    withPlatformFontStyles({
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
      noticeCard: {
        minHeight: scale(112),
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: scale(18),
        paddingHorizontal: scale(18),
        paddingVertical: scale(14),
      },
      infoIcon: {
        width: scale(20),
        height: scale(20),
        borderWidth: scale(1.5),
        borderColor: "#161616",
        borderRadius: scale(10),
        alignItems: "center",
        justifyContent: "center",
        marginRight: scale(14),
      },
      infoIconText: {
        color: "#161616",
        fontSize: scale(13),
        fontWeight: "600",
        lineHeight: scale(16),
      },
      noticeText: {
        flex: 1,
        color: "#111111",
        fontSize: scale(18),
        lineHeight: scale(26),
        textAlign: "justify",
      },
      question: {
        color: "#7d879e",
        fontSize: scale(18),
        lineHeight: scale(26),
        marginTop: scale(32),
        marginHorizontal: scale(12),
      },
      optionsList: {
        marginTop: scale(40),
        gap: scale(20),
      },
      optionRow: {
        minHeight: scale(44),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: scale(14),
      },
      radio: {
        width: scale(30),
        height: scale(30),
        flexShrink: 0,
        borderWidth: scale(2.5),
        borderColor: "#7d879e",
        borderRadius: scale(15),
        alignItems: "center",
        justifyContent: "center",
        marginRight: scale(16),
      },
      radioSelected: { borderColor: "#08a9b8" },
      radioDot: {
        width: scale(18),
        height: scale(18),
        borderRadius: scale(9),
        backgroundColor: "#08a9b8",
      },
      optionText: {
        flex: 1,
        color: "#595959",
        fontSize: scale(18),
        lineHeight: scale(26),
      },
      loadingIndicator: { marginTop: scale(30) },
      feedbackContainer: { marginTop: scale(24) },
      feedbackText: {
        color: "#777777",
        fontSize: scale(16),
        lineHeight: scale(23),
        marginTop: scale(24),
      },
      retryButton: { alignSelf: "flex-start", paddingVertical: scale(8) },
      retryText: {
        color: "#08a9b8",
        fontSize: scale(16),
        fontWeight: "600",
      },
    }),
  );
}
