import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native';
import { BASE_URL } from '../utils/Constants';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

function buildStatesEndpoint(base) {
  const normalized = String(base || '').replace(/\/$/, '');
  if (!normalized) {
    return 'http://127.0.0.1:8000/api/v1/countries/states/by-country-code';
  }

  if (normalized.endsWith('/api/v1')) {
    return `${normalized}/countries/states/by-country-code`;
  }

  return `${normalized}/api/v1/countries/states/by-country-code`;
}

function toStateModel(item) {
  if (typeof item === 'string') {
    return { value: item, label: item, cities: [] };
  }

  const label =
    item?.state_name ||
    item?.name ||
    item?.state ||
    item?.province_name ||
    item?.province ||
    '';

  const citiesRaw =
    item?.cities || item?.city_list || item?.districts || item?.municipalities || [];

  const cities = Array.isArray(citiesRaw)
    ? citiesRaw
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          return entry?.city_name || entry?.name || entry?.city || entry?.district || '';
        })
        .filter(Boolean)
    : [];

  const value = item?.id ?? item?.state_id ?? item?.state_code ?? item?.code ?? label;

  return {
    value,
    label: label || value,
    cities,
  };
}

export default function StatePickerScreen({
  onBack,
  onSelectState,
  countryIso3,
  countryPhoneCode,
}) {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');

  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  useEffect(() => {
    let isMounted = true;

    const fetchStates = async () => {
      if (!countryIso3 || !countryPhoneCode) {
        if (isMounted) {
          setErrorMessage('Missing country details. Please select country again.');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setErrorMessage('');

        const endpoint = buildStatesEndpoint(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            iso3: String(countryIso3).toUpperCase(),
            phone_code: String(countryPhoneCode).replace(/^\+/, ''),
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to load states: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.states)
            ? payload.states
            : [];

        const mapped = list
          .map(toStateModel)
          .filter((item) => Boolean(item?.label));

        if (isMounted) {
          setStates(mapped);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage('Could not load states. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStates();

    return () => {
      isMounted = false;
    };
  }, [countryIso3, countryPhoneCode]);

  const filteredStates = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return states;

    return states.filter((state) => state.label.toLowerCase().includes(query));
  }, [states, searchText]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search State"
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
            data={filteredStates}
            keyExtractor={(state) => String(state.value)}
            style={styles.listWrap}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.stateRow}
                onPress={() => {
                  onSelectState?.(item);
                }}
              >
                <Text style={styles.stateName}>{item.label}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No states found</Text>}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, responsiveFont }) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#f3f3f3',
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(6),
      paddingTop: isShortScreen ? vh(1.5) : vh(2),
      paddingBottom: vh(1.5),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: vh(1.2),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
      height: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
      resizeMode: 'contain',
    },
    searchWrap: {
      borderBottomWidth: 1,
      borderBottomColor: '#cbcbcb',
      marginBottom: vh(0.8),
    },
    searchInput: {
      fontSize: responsiveFont(isNarrowScreen ? 15 : 17, 13, 20),
      lineHeight: responsiveFont(isNarrowScreen ? 20 : 22, 17, 25),
      color: '#5a5a5a',
      fontWeight: '400',
      paddingHorizontal: 0,
      paddingVertical: vh(0.8),
    },
    centerStateWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: '#c44f4f',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 17, 22),
      textAlign: 'center',
      fontWeight: '400',
    },
    listWrap: {
      flex: 1,
    },
    stateRow: {
      minHeight: isShortScreen ? vh(7.8) : vh(8.5),
      borderBottomWidth: 2,
      borderBottomColor: '#a8a8a8',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: vw(3),
    },
    stateName: {
      flex: 1,
      color: '#293a31',
      fontSize: responsiveFont(isNarrowScreen ? 15 : 17, 13, 20),
      lineHeight: responsiveFont(isNarrowScreen ? 20 : 22, 17, 25),
      fontWeight: '400',
      marginRight: vw(2),
    },
    emptyText: {
      color: '#6f6f6f',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 17, 22),
      textAlign: 'center',
      fontWeight: '400',
      marginTop: vh(3),
    },
  }));
}
