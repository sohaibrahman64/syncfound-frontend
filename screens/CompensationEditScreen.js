import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../utils/apiClient";
import { useResponsiveMetrics } from "../utils/responsive";
import { withPlatformFontStyles } from "../utils/typography";
import CurrencyPickerScreen from "./CurrencyPickerScreen";

const MINIMUM_SALARY_PREFERENCES = [
  "Yes, I do have a strict one",
  "Yes, though I may go lower depending on the opportunity",
  "No, I am flexible on my salary",
];

function getInitialValue(value, ...keys) {
  for (const key of keys) {
    if (value?.[key] !== undefined && value?.[key] !== null) {
      return value[key];
    }
  }
  return "";
}

function mapCompensationOptions(items, labelKey, idKey = "id") {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      id: item?.[idKey] ?? item?.id ?? index + 1,
      label: String(item?.[labelKey] ?? "").trim(),
    }))
    .filter((option) => option.label);
}

function mapCurrencies(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      id: item?.currency_id ?? item?.id ?? index + 1,
      code: String(item?.currency_code ?? "").trim(),
      name: String(item?.currency_name ?? "").trim(),
      symbol: String(item?.currency_symbol ?? "").trim(),
      countryName: String(item?.country_name ?? "").trim(),
      flagPath: String(item?.country_flag_path ?? "").trim(),
    }))
    .filter((currency) => currency.code || currency.name);
}

function findOption(options, value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") {
    value = value.id ?? value.value ?? value.label ?? value.code ?? "";
  }
  const normalized = String(value).toLowerCase();
  return (
    options.find(
      (option) =>
        String(option.id).toLowerCase() === normalized ||
        option.label?.toLowerCase() === normalized ||
        option.code?.toLowerCase() === normalized,
    ) || null
  );
}

export default function CompensationEditScreen({
  initialValue = {},
  onBack,
  onDone,
  metrics,
}) {
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const [cashEquityOptions, setCashEquityOptions] = useState([]);
  const [salaryDurationOptions, setSalaryDurationOptions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [selectedCashEquity, setSelectedCashEquity] = useState(null);
  const [minimumSalaryPreference, setMinimumSalaryPreference] = useState(() => {
    const initialPreference = getInitialValue(
      initialValue,
      "minimumSalaryPreference",
      "expectedMinimumSalaryPreference",
      "expected_minimum_salary_preference",
    );
    return MINIMUM_SALARY_PREFERENCES.includes(initialPreference)
      ? initialPreference
      : MINIMUM_SALARY_PREFERENCES[1];
  });
  const [selectedSalaryDuration, setSelectedSalaryDuration] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [salaryAmount, setSalaryAmount] = useState(() =>
    String(
      getInitialValue(
        initialValue,
        "amount",
        "expectedMinimumSalaryAmount",
        "expected_minimum_salary_amount",
        "expectedMinimumSalary",
      ) || "",
    ),
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCompensationOptions() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await apiFetch("/compensation", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Failed to load compensation options: ${response.status}`);
        }

        const payload = await response.json();
        const data = payload?.data || payload || {};
        const cashOptions = mapCompensationOptions(
          data.cash_equity_expectations,
          "cash_equity_expectation",
          "cash_equity_expectation_id",
        );
        const durationChoices = mapCompensationOptions(
          data.salary_durations,
          "salary_duration",
          "salary_duration_id",
        );
        const currencyChoices = mapCurrencies(data.currencies);

        if (!isMounted) return;

        setCashEquityOptions(cashOptions);
        setSalaryDurationOptions(durationChoices);
        setCurrencies(currencyChoices);

        const initialCashEquity = getInitialValue(
          initialValue,
          "cashEquityExpectationId",
          "cashEquityExpectation",
          "cash_equity_expectation_id",
          "cash_equity_expectation",
        );
        setSelectedCashEquity(
          findOption(cashOptions, initialCashEquity) ||
            findOption(cashOptions, 1) ||
            cashOptions[0] ||
            null,
        );

        const initialDuration = getInitialValue(
          initialValue,
          "salaryDurationId",
          "salaryDuration",
          "salary_duration_id",
          "salary_duration",
        );
        setSelectedSalaryDuration(
          findOption(durationChoices, initialDuration) ||
            findOption(durationChoices, 1) ||
            durationChoices[0] ||
            null,
        );

        const initialCurrency =
          getInitialValue(
            initialValue,
            "currencyId",
            "currencyCode",
            "currency_id",
            "currency_code",
          ) || 1;
        setSelectedCurrency(
          findOption(currencyChoices, initialCurrency) ||
            findOption(currencyChoices, "USD") ||
            currencyChoices[0] ||
            null,
        );
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load compensation options. Please try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCompensationOptions();
    return () => {
      isMounted = false;
    };
  }, [retryKey]);

  function finishEditing() {
    onDone?.({
      cashEquityExpectationId:
        selectedCashEquity?.id ?? initialValue.cashEquityExpectationId ?? null,
      cashEquityExpectation:
        selectedCashEquity?.label ?? initialValue.cashEquityExpectation ?? "",
      minimumSalaryPreference,
      expectedMinimumSalary: salaryAmount,
      expectedMinimumSalaryId:
        initialValue.expectedMinimumSalaryId ??
        initialValue.expected_minimum_salary_id ??
        2,
      salaryDurationId:
        selectedSalaryDuration?.id ?? initialValue.salaryDurationId ?? null,
      salaryDuration:
        selectedSalaryDuration?.label ?? initialValue.salaryDuration ?? "",
      currencyId: selectedCurrency?.id ?? initialValue.currencyId ?? null,
      currencyCode: selectedCurrency?.code ?? initialValue.currencyCode ?? "",
      currencyName: selectedCurrency?.name ?? initialValue.currencyName ?? "",
      currencySymbol:
        selectedCurrency?.symbol ?? initialValue.currencySymbol ?? "",
    });
  }

  if (showCurrencyPicker) {
    return (
      <CurrencyPickerScreen
        currencies={currencies}
        loading={loading}
        errorMessage={errorMessage}
        onRetry={() => setRetryKey((current) => current + 1)}
        onBack={() => setShowCurrencyPicker(false)}
        onSelectCurrency={(currency) => {
          setSelectedCurrency(currency);
          setShowCurrencyPicker(false);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => {
            if (onDone) finishEditing();
            else onBack?.();
          }}
          style={styles.headerAction}
        >
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.backArrow}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Compensation</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Text accessibilityLabel="Information" style={styles.infoIcon}>
            ⓘ
          </Text>
          <Text style={styles.infoText}>
            This info is only visible to founders who are hiring.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading compensation options"
            size="large"
            color="#2dbcc4"
            style={styles.loading}
          />
        ) : errorMessage ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.question}>
              What’s your cash-equity expectation?
            </Text>
            <View style={styles.cashOptions}>
              {cashEquityOptions.length ? (
                cashEquityOptions.map((option) => (
                  <CompensationRadioOption
                    key={String(option.id ?? option.label)}
                    label={option.label}
                    selected={selectedCashEquity?.id === option.id}
                    onPress={() => setSelectedCashEquity(option)}
                    styles={styles}
                  />
                ))
              ) : (
                <Text style={styles.emptyOptionsText}>
                  No cash-equity expectations are available.
                </Text>
              )}
            </View>

            <Text style={styles.minimumQuestion}>
              Do you have an expected minimum salary?
            </Text>
            <View style={styles.salaryPreferenceOptions}>
              {MINIMUM_SALARY_PREFERENCES.map((preference) => (
                <CompensationRadioOption
                  key={preference}
                  label={preference}
                  selected={minimumSalaryPreference === preference}
                  onPress={() => setMinimumSalaryPreference(preference)}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.salaryQuestion}>
              What minimum salary are you looking for?
            </Text>
            <View style={styles.durationOptions}>
              {salaryDurationOptions.map((duration) => {
                const selected = selectedSalaryDuration?.id === duration.id;
                const isHourly = duration.label.toLowerCase().includes("hour");
                return (
                  <Pressable
                    key={String(duration.id ?? duration.label)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setSelectedSalaryDuration(duration)}
                    style={[
                      styles.durationOption,
                      selected && styles.durationOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationIcon,
                        selected && styles.durationIconSelected,
                      ]}
                    >
                      {isHourly ? "◷" : "▣"}
                    </Text>
                    <Text
                      style={[
                        styles.durationText,
                        selected && styles.durationTextSelected,
                      ]}
                    >
                      {duration.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select currency"
              onPress={() => setShowCurrencyPicker(true)}
              style={styles.currencyField}
            >
              <Text
                style={[
                  styles.currencyFieldText,
                  !selectedCurrency && styles.placeholder,
                ]}
              >
                {selectedCurrency?.code || "Currency"}
              </Text>
              <Text style={styles.currencyChevron}>▼</Text>
            </Pressable>

            <TextInput
              accessibilityLabel="Minimum salary amount"
              value={salaryAmount}
              onChangeText={setSalaryAmount}
              placeholder="e.g. 250,000"
              placeholderTextColor="#a2a2a2"
              keyboardType="numeric"
              style={styles.salaryInput}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CompensationRadioOption({ label, selected, onPress, styles }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.radioOption}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </Pressable>
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
      paddingBottom: scale(36),
    },
    infoCard: {
      minHeight: scale(112),
      paddingHorizontal: scale(18),
      paddingVertical: scale(18),
      backgroundColor: "#ffffff",
      borderRadius: scale(18),
      flexDirection: "row",
      alignItems: "center",
      marginBottom: scale(10),
    },
    infoIcon: {
      color: "#222222",
      fontSize: scale(21),
      marginRight: scale(18),
    },
    infoText: {
      flex: 1,
      color: "#111111",
      fontSize: scale(18),
      lineHeight: scale(26),
    },
    loading: { marginTop: scale(50) },
    errorWrap: { alignItems: "center", marginTop: scale(40) },
    errorText: {
      color: "#c44f4f",
      fontSize: scale(16),
      lineHeight: scale(23),
      textAlign: "center",
    },
    retryButton: { padding: scale(12) },
    retryText: { color: "#2dbcc4", fontSize: scale(17), fontWeight: "600" },
    question: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginTop: scale(20),
      marginHorizontal: scale(9),
    },
    cashOptions: { marginTop: scale(25), gap: scale(18) },
    radioOption: {
      minHeight: scale(44),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: scale(2),
    },
    radioOuter: {
      width: scale(28),
      height: scale(28),
      borderWidth: scale(2.5),
      borderColor: "#7d879e",
      borderRadius: scale(16),
      alignItems: "center",
      justifyContent: "center",
      marginRight: scale(15),
    },
    radioOuterSelected: { borderColor: "#08a9b8" },
    radioInner: {
      width: scale(16),
      height: scale(16),
      borderRadius: scale(9),
      backgroundColor: "#08a9b8",
    },
    radioLabel: {
      flex: 1,
      color: "#595959",
      fontSize: scale(17),
      lineHeight: scale(24),
    },
    emptyOptionsText: {
      color: "#7d879e",
      fontSize: scale(16),
      paddingHorizontal: scale(4),
    },
    minimumQuestion: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginTop: scale(43),
      marginHorizontal: scale(9),
    },
    salaryPreferenceOptions: { marginTop: scale(22), gap: scale(16) },
    salaryQuestion: {
      color: "#7d879e",
      fontSize: scale(18),
      lineHeight: scale(26),
      marginTop: scale(28),
      marginHorizontal: scale(9),
    },
    durationOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: scale(15),
      rowGap: scale(12),
      marginTop: scale(19),
      marginHorizontal: scale(10),
    },
    durationOption: {
      minWidth: scale(128),
      minHeight: scale(54),
      paddingHorizontal: scale(14),
      borderRadius: scale(28),
      backgroundColor: "#dfe2e7",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: scale(1.5),
      borderColor: "transparent",
    },
    durationOptionSelected: {
      backgroundColor: "#2dbcc4",
      borderColor: "#bcebed",
    },
    durationIcon: {
      color: "#7d879e",
      fontSize: scale(22),
      marginRight: scale(9),
    },
    durationIconSelected: { color: "#ffffff" },
    durationText: { color: "#7d879e", fontSize: scale(17) },
    durationTextSelected: { color: "#ffffff" },
    currencyField: {
      minHeight: scale(54),
      marginTop: scale(48),
      marginHorizontal: scale(8),
      paddingHorizontal: scale(4),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
    },
    currencyFieldText: { color: "#111111", fontSize: scale(18) },
    placeholder: { color: "#a2a2a2" },
    currencyChevron: { color: "#a2a2a2", fontSize: scale(16) },
    salaryInput: {
      minHeight: scale(58),
      marginTop: scale(24),
      marginHorizontal: scale(8),
      paddingHorizontal: scale(4),
      paddingVertical: scale(12),
      borderBottomWidth: scale(2),
      borderBottomColor: "#d7d4ce",
      color: "#111111",
      fontSize: scale(18),
    },
  }));
}
