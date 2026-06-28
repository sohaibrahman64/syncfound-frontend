import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from "../utils/Constants";
import { getFlagAssetFromPath } from "../utils/flagAssetMap";
import { useResponsiveMetrics } from "../utils/responsive";
import { withPlatformFontStyles } from '../utils/typography';

function toCountryModel(item) {
  const countryName = item?.country_name || "";
  const iso = item?.iso2 || countryName.slice(0, 2).toUpperCase();
  const iso3 = item?.iso3 || item?.iso3_code || "";
  const rawPhoneCode = String(item?.phone_code || "").trim();
  const dial = rawPhoneCode
    ? (rawPhoneCode.startsWith("+") ? rawPhoneCode : `+${rawPhoneCode}`)
    : "";

  return {
    id: item?.id,
    name: countryName,
    code: iso,
    iso3,
    phoneCode: rawPhoneCode.replace(/^\+/, ""),
    dial,
    flagPath: item?.country_flag_path || "",
  };
}

export default function CountryPickerScreen({ onBack, onSelectCountry }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchText, setSearchText] = useState("");

  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(metrics, insets.top), [metrics, insets.top]);
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL;

  useEffect(() => {
    let isMounted = true;

    const fetchCountries = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/countries-new`);
        if (!response.ok) {
          throw new Error(`Failed to load countries: ${response.status}`);
        }

        const data = await response.json();
        const mapped = Array.isArray(data) ? data.map(toCountryModel) : [];

        if (isMounted) {
          setCountries(mapped);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage("Could not load countries. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCountries();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  const filteredCountries = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
      return countries;
    }

    return countries.filter((country) => {
      return (
        country.name.toLowerCase().includes(normalized) ||
        country.code.toLowerCase().includes(normalized) ||
        country.dial.toLowerCase().includes(normalized)
      );
    });
  }, [countries, searchText]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image
            source={require("../assets/back_arrow.png")}
            style={styles.backArrowImage}
          />
        </Pressable>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search Country"
            placeholderTextColor="#777777"
          />
        </View>

        {loading ? (
          <View style={styles.centerStateWrap}>
            <ActivityIndicator size="small" color="#31c6d5" />
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.centerStateWrap}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!loading && !errorMessage ? (
          <FlatList
            data={filteredCountries}
            keyExtractor={(country) =>
              String(country.id || `${country.name}-${country.dial}`)
            }
            style={styles.listWrap}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: country }) => {
              const flagSource = getFlagAssetFromPath(country.flagPath);

              return (
                <Pressable
                  style={styles.countryRow}
                  onPress={() => {
                    onSelectCountry?.(country);
                    onBack?.();
                  }}
                >
                  <Text style={styles.countryName} numberOfLines={1}>
                    {country.name}
                  </Text>

                  <View style={styles.codeWrap}>
                    <View style={styles.flagSlot}>
                      {flagSource ? (
                        <Image source={flagSource} style={styles.flagImage} />
                      ) : (
                        <View style={styles.flagPlaceholder} />
                      )}
                    </View>
                    <View style={styles.dialSlot}>
                      <Text style={styles.countryCode}>{country.dial}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No countries found</Text>
            }
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, responsiveFont }, topInset = 0) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: "#f3f3f3",
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(6),
      paddingTop: topInset + (isShortScreen ? vh(1.6) : vh(2)),
      paddingBottom: vh(1.5),
    },
    backButton: {
      alignSelf: "flex-start",
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: vh(1.2),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
      height: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
      resizeMode: "contain",
    },
    searchWrap: {
      borderBottomWidth: 1,
      borderBottomColor: "#cbcbcb",
      marginBottom: vh(0.8),
    },
    searchInput: {
      fontSize: responsiveFont(isNarrowScreen ? 16 : 18, 14, 22),
      lineHeight: responsiveFont(isNarrowScreen ? 20 : 22, 18, 26),
      color: "#5a5a5a",
      fontWeight: "400",
      paddingHorizontal: 0,
      paddingVertical: vh(0.8),
    },
    centerStateWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      color: "#c44f4f",
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 17, 22),
      textAlign: "center",
      fontWeight: "400",
    },
    listWrap: {
      flex: 1,
    },
    emptyText: {
      color: "#6f6f6f",
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 17, 22),
      textAlign: "center",
      fontWeight: "400",
      marginTop: vh(3),
    },
    countryRow: {
      minHeight: isShortScreen ? vh(7.8) : vh(8.5),
      borderBottomWidth: 2,
      borderBottomColor: "#a8a8a8",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: vw(3),
    },
    countryName: {
      flex: 1,
      color: "#293a31",
      fontSize: responsiveFont(isNarrowScreen ? 15 : 17, 13, 20),
      lineHeight: responsiveFont(isNarrowScreen ? 20 : 22, 17, 25),
      fontWeight: "400",
      marginRight: vw(2),
    },
    codeWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: vw(2),
      flexShrink: 0,
      justifyContent: "flex-end",
    },
    flagSlot: {
      width: responsiveFont(isNarrowScreen ? 38 : 42, 32, 48),
      alignItems: "center",
      marginRight: vw(2.5),
    },
    dialSlot: {
      minWidth: vw(18),
      alignItems: "flex-start",
    },
    flagImage: {
      width: responsiveFont(isNarrowScreen ? 38 : 42, 32, 48),
      height: responsiveFont(isNarrowScreen ? 26 : 30, 20, 34),
      resizeMode: "contain",
    },
    flagPlaceholder: {
      width: responsiveFont(isNarrowScreen ? 38 : 42, 32, 48),
      height: responsiveFont(isNarrowScreen ? 26 : 30, 20, 34),
    },
    countryCode: {
      color: "#293a31",
      fontSize: responsiveFont(isNarrowScreen ? 15 : 17, 13, 20),
      lineHeight: responsiveFont(isNarrowScreen ? 20 : 22, 17, 25),
      fontWeight: "400",
    },
  }));
}
