import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BASE_URL } from "../utils/Constants";
import { useResponsiveMetrics } from "../utils/responsive";
import { withPlatformFontStyles } from "../utils/typography";
import CityPickerScreen from "./CityPickerScreen";
import StatePickerScreen from "./StatePickerScreen";

function buildStatesEndpoint(base) {
  const normalized = String(base || "").replace(/\/$/, "");
  if (!normalized) {
    return "http://127.0.0.1:8000/api/v1/countries/states/by-country-code";
  }

  if (normalized.endsWith("/api/v1")) {
    return `${normalized}/countries/states/by-country-code`;
  }

  return `${normalized}/api/v1/countries/states/by-country-code`;
}

function buildCitiesEndpoint(base) {
  const normalized = String(base || "").replace(/\/$/, "");
  if (!normalized) {
    return "http://127.0.0.1:8000/api/v1/countries/cities/by-country-code";
  }

  if (normalized.endsWith("/api/v1")) {
    return `${normalized}/countries/cities/by-country-code`;
  }

  return `${normalized}/api/v1/countries/cities/by-country-code`;
}

function toStateModel(item) {
  if (typeof item === "string") {
    return { value: item, label: item };
  }

  const label = String(
    item?.state_name ||
      item?.name ||
      item?.state ||
      item?.province_name ||
      item?.province ||
      "",
  ).trim();

  const value =
    item?.id ?? item?.state_id ?? item?.state_code ?? item?.code ?? label;

  return {
    value,
    label: label || String(value || "").trim(),
  };
}

function toCityModel(item) {
  if (typeof item === "string") {
    return { value: item, label: item };
  }

  const label = String(
    item?.city_name || item?.name || item?.city || item?.district || "",
  ).trim();
  const value =
    item?.id ?? item?.city_id ?? item?.city_code ?? item?.code ?? label;

  return {
    value,
    label: label || String(value || "").trim(),
  };
}

function isIdLike(value) {
  if (typeof value === "number") return true;
  const text = String(value || "").trim();
  return /^\d+$/.test(text);
}

function toInitialOption(initialValue) {
  if (initialValue == null || initialValue === "") return null;
  if (isIdLike(initialValue)) {
    return { value: initialValue, label: "" };
  }

  const label = String(initialValue).trim();
  return {
    value: label,
    label,
  };
}

function Chevron({ styles }) {
  return (
    <View style={styles.chevronWrap}>
      <Text style={styles.chevron}>▼</Text>
    </View>
  );
}

export default function ProfileLocationScreen({
  onBack,
  onContinue,
  initialState = "",
  initialCity = "",
  countryIso3 = "",
  countryPhoneCode = "",
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  const [selectedState, setSelectedState] = useState(() =>
    toInitialOption(initialState),
  );
  const [selectedCity, setSelectedCity] = useState(() =>
    toInitialOption(initialCity),
  );
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const shouldResolveState = Boolean(
      selectedState &&
      countryIso3 &&
      countryPhoneCode &&
      (!selectedState.label || !isIdLike(selectedState.value)),
    );
    const shouldResolveCity = Boolean(
      selectedCity &&
      countryIso3 &&
      countryPhoneCode &&
      (!selectedCity.label || !isIdLike(selectedCity.value)),
    );

    if (!shouldResolveState && !shouldResolveCity) {
      return () => {
        isMounted = false;
      };
    }

    const resolveLocationSelections = async () => {
      try {
        if (shouldResolveState) {
          const statesEndpoint = buildStatesEndpoint(
            process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL,
          );
          const stateResponse = await fetch(statesEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              iso3: String(countryIso3).toUpperCase(),
              phone_code: String(countryPhoneCode).replace(/^\+/, ""),
            }),
          });

          if (stateResponse.ok) {
            const statePayload = await stateResponse.json();
            const stateList = Array.isArray(statePayload)
              ? statePayload
              : Array.isArray(statePayload?.states)
                ? statePayload.states
                : [];

            const stateOptions = stateList
              .map(toStateModel)
              .filter((item) => Boolean(item?.label));
            const matchedState = stateOptions.find(
              (item) =>
                String(item.value) === String(selectedState?.value) ||
                item.label.toLowerCase() ===
                  String(
                    selectedState?.label || selectedState?.value || "",
                  ).toLowerCase(),
            );

            if (isMounted && matchedState) {
              setSelectedState((prev) =>
                prev
                  ? {
                      ...prev,
                      value: matchedState.value,
                      label: matchedState.label,
                    }
                  : prev,
              );
            }
          }
        }

        if (shouldResolveCity) {
          const citiesEndpoint = buildCitiesEndpoint(
            process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL,
          );
          const cityResponse = await fetch(citiesEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              iso3: String(countryIso3).toUpperCase(),
              phone_code: String(countryPhoneCode).replace(/^\+/, ""),
            }),
          });

          if (cityResponse.ok) {
            const cityPayload = await cityResponse.json();
            const cityList = Array.isArray(cityPayload)
              ? cityPayload
              : Array.isArray(cityPayload?.cities)
                ? cityPayload.cities
                : [];

            const cityOptions = cityList
              .map(toCityModel)
              .filter((item) => Boolean(item?.label));
            const matchedCity = cityOptions.find(
              (item) =>
                String(item.value) === String(selectedCity?.value) ||
                item.label.toLowerCase() ===
                  String(
                    selectedCity?.label || selectedCity?.value || "",
                  ).toLowerCase(),
            );

            if (isMounted && matchedCity) {
              setSelectedCity((prev) =>
                prev
                  ? {
                      ...prev,
                      value: matchedCity.value,
                      label: matchedCity.label,
                    }
                  : prev,
              );
            }
          }
        }
      } catch {
        // Keep existing selection values if normalization lookup fails.
      }
    };

    resolveLocationSelections();

    return () => {
      isMounted = false;
    };
  }, [selectedState, selectedCity, countryIso3, countryPhoneCode]);

  const canContinue = Boolean(
    selectedState?.value != null && selectedCity?.value != null,
  );

  const selectedStateLabel = selectedState?.label || "State";
  const selectedCityLabel = selectedCity?.label || "City";

  if (showStatePicker) {
    return (
      <StatePickerScreen
        countryIso3={countryIso3}
        countryPhoneCode={countryPhoneCode}
        onBack={() => setShowStatePicker(false)}
        onSelectState={(stateItem) => {
          setSelectedState(stateItem);
          setSelectedCity("");
          setShowStatePicker(false);
        }}
      />
    );
  }

  if (showCityPicker) {
    return (
      <CityPickerScreen
        countryIso3={countryIso3}
        countryPhoneCode={countryPhoneCode}
        selectedStateLabel={selectedState?.label ?? ""}
        onBack={() => setShowCityPicker(false)}
        onSelectCity={(cityItem) => {
          setSelectedCity(cityItem || null);
          setShowCityPicker(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.backArrowImage}
          />
        </Pressable>

        <Text style={styles.subheading}>Let’s build your general profile</Text>
        <Text style={styles.heading}>Where are you based?</Text>

        <View style={styles.inputGroup}>
          <Pressable
            style={styles.inputRow}
            onPress={() => setShowStatePicker(true)}
          >
            <Text
              style={[
                styles.inputText,
                !selectedState && styles.placeholderText,
              ]}
            >
              {selectedStateLabel}
            </Text>
            <Chevron styles={styles} />
          </Pressable>

          <Pressable
            style={[
              styles.inputRow,
              styles.cityRow,
              !selectedState && styles.disabledRow,
            ]}
            onPress={() => {
              if (!selectedState) return;
              setShowCityPicker(true);
            }}
          >
            <Text
              style={[
                styles.inputText,
                !selectedCity && styles.placeholderText,
              ]}
            >
              {selectedCityLabel}
            </Text>
            <Chevron styles={styles} />
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
          ]}
          disabled={!canContinue}
          onPress={() => {
            onContinue?.({
              state: selectedState?.value,
              city: selectedCity?.value,
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

function createStyles({
  width,
  height,
  vw,
  vh,
  moderateScale,
  responsiveFont,
}) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(
    withPlatformFontStyles({
      container: {
        flex: 1,
        backgroundColor: "#f3f3f3",
      },
      topAccent: {
        position: "absolute",
        top: 0,
        left: 0,
        width: vw(25),
        height: vh(1.2),
        backgroundColor: "#26c6d0",
        zIndex: 2,
      },
      content: {
        flex: 1,
        paddingHorizontal: vw(6),
        paddingTop: isShortScreen ? vh(3.2) : vh(4.2),
        paddingBottom: vh(4),
      },
      backButton: {
        alignSelf: "flex-start",
        paddingVertical: vh(0.7),
        paddingHorizontal: vw(1),
        marginBottom: isShortScreen ? vh(3.2) : vh(4),
      },
      backArrowImage: {
        width: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
        height: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
        resizeMode: "contain",
      },
      subheading: {
        color: "#616161",
        fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
        lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
        fontWeight: "400",
        marginBottom: isShortScreen ? vh(4.6) : vh(5.6),
      },
      heading: {
        color: "#0f0f0f",
        fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
        lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
        fontWeight: "700",
        marginBottom: isShortScreen ? vh(11) : vh(13),
      },
      inputGroup: {
        gap: vh(3.5),
      },
      inputRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 2,
        borderBottomColor: "#9f9fa1",
        minHeight: moderateScale(isShortScreen ? 48 : 54),
        paddingBottom: vh(0.6),
      },
      cityRow: {
        marginTop: vh(0.5),
      },
      disabledRow: {
        opacity: 0.75,
      },
      inputText: {
        color: "#3d3d3d",
        fontSize: responsiveFont(isShortScreen ? 19 : 22, 16, 24),
        lineHeight: responsiveFont(isShortScreen ? 24 : 27, 20, 30),
        fontWeight: "400",
      },
      placeholderText: {
        color: "#565656",
      },
      chevronWrap: {
        minWidth: moderateScale(26),
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: moderateScale(2),
      },
      chevron: {
        color: "#a4a4a4",
        fontSize: responsiveFont(isShortScreen ? 26 : 28, 22, 30),
        lineHeight: responsiveFont(isShortScreen ? 28 : 30, 24, 32),
        fontWeight: "400",
      },
      continueButton: {
        marginTop: "auto",
        width: isNarrowScreen ? "86%" : "84%",
        alignSelf: "center",
        borderRadius: 999,
        backgroundColor: "#31c6d5",
        minHeight: moderateScale(isShortScreen ? 52 : 58),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: vw(4),
        marginBottom: vh(0.8),
      },
      continueButtonDisabled: {
        backgroundColor: "#cdcdcf",
      },
      continueButtonText: {
        color: "#ffffff",
        fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
        lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
        fontWeight: "400",
        textAlign: "center",
      },
      continueButtonTextDisabled: {
        color: "#707c96",
      },
    }),
  );
}
