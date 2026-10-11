import React, { useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFlagAssetFromPath } from "../utils/flagAssetMap";
import { useResponsiveMetrics } from "../utils/responsive";
import { withPlatformFontStyles } from "../utils/typography";

export default function CurrencyPickerScreen({
  currencies = [],
  loading = false,
  errorMessage = "",
  onRetry,
  onBack,
  onSelectCurrency,
}) {
  const [searchText, setSearchText] = useState("");
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(metrics, insets.top),
    [metrics, insets.top],
  );

  const filteredCurrencies = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) return currencies;

    return currencies.filter((currency) =>
      [currency.code, currency.name, currency.countryName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [currencies, searchText]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={10}
            style={styles.backButton}
          >
            <Image
              source={require("../assets/back_arrow.png")}
              style={styles.backArrowImage}
              resizeMode="contain"
            />
          </Pressable>
          <Text style={styles.title}>Select Currency</Text>
          <View style={styles.headerAction} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            accessibilityLabel="Search currency"
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search Currency"
            placeholderTextColor="#777777"
            autoCapitalize="none"
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
            <Pressable accessibilityRole="button" onPress={onRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !errorMessage ? (
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(currency) =>
              String(currency.id || currency.code || currency.name)
            }
            style={styles.listWrap}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: currency }) => {
              const flagSource = getFlagAssetFromPath(currency.flagPath);

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${currency.code} ${currency.name}`}
                  style={styles.currencyRow}
                  onPress={() => onSelectCurrency?.(currency)}
                >
                  <View style={styles.currencyCopy}>
                    <Text style={styles.currencyCode}>{currency.code}</Text>
                    <Text style={styles.currencyName} numberOfLines={1}>
                      {currency.name}
                      {currency.countryName ? ` · ${currency.countryName}` : ""}
                    </Text>
                  </View>
                  <View style={styles.flagSlot}>
                    {flagSource ? (
                      <Image source={flagSource} style={styles.flagImage} />
                    ) : (
                      <View style={styles.flagPlaceholder} />
                    )}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {currencies.length ? "No currencies found" : "No currencies available"}
              </Text>
            }
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(metrics, topInset = 0) {
  const { width, height, vw, vh, responsiveFont } = metrics;
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: { flex: 1, backgroundColor: "#f0eee5" },
    content: {
      flex: 1,
      paddingHorizontal: vw(6),
      paddingTop: topInset + (isShortScreen ? vh(1.6) : vh(2)),
      paddingBottom: vh(1.5),
    },
    header: {
      minHeight: isShortScreen ? vh(8) : vh(9),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: responsiveFont(isNarrowScreen ? 30 : 34, 26, 38),
      minHeight: vh(5.5),
      justifyContent: "center",
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
      height: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
    },
    title: {
      flex: 1,
      color: "#080808",
      fontSize: responsiveFont(25, 21, 28),
      fontWeight: "700",
      textAlign: "center",
    },
    headerAction: { width: responsiveFont(isNarrowScreen ? 30 : 34, 26, 38) },
    searchWrap: {
      borderBottomWidth: 1,
      borderBottomColor: "#cbcbcb",
      marginTop: vh(1),
      marginBottom: vh(0.8),
    },
    searchInput: {
      fontSize: responsiveFont(isNarrowScreen ? 16 : 18, 14, 22),
      lineHeight: responsiveFont(isNarrowScreen ? 20 : 22, 18, 26),
      color: "#5a5a5a",
      paddingHorizontal: 0,
      paddingVertical: vh(0.8),
    },
    centerStateWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: vw(5),
    },
    errorText: {
      color: "#c44f4f",
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 17, 22),
      textAlign: "center",
    },
    retryText: {
      color: "#2dbcc4",
      fontSize: responsiveFont(16, 14, 18),
      fontWeight: "600",
      marginTop: vh(1),
    },
    listWrap: { flex: 1 },
    emptyText: {
      color: "#6f6f6f",
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 17, 22),
      textAlign: "center",
      marginTop: vh(3),
    },
    currencyRow: {
      minHeight: isShortScreen ? vh(7.8) : vh(8.5),
      borderBottomWidth: 2,
      borderBottomColor: "#d7d4ce",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: vw(3),
    },
    currencyCopy: { flex: 1, minWidth: 0 },
    currencyCode: {
      color: "#333333",
      fontSize: responsiveFont(isNarrowScreen ? 16 : 18, 14, 21),
      fontWeight: "600",
    },
    currencyName: {
      color: "#777777",
      fontSize: responsiveFont(isNarrowScreen ? 13 : 15, 12, 18),
      marginTop: vh(0.3),
    },
    flagSlot: {
      width: responsiveFont(isNarrowScreen ? 42 : 48, 36, 54),
      minHeight: vh(5),
      alignItems: "center",
      justifyContent: "center",
      marginRight: vw(2.5),
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
  }));
}
