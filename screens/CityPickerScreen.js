import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { BASE_URL } from '../utils/Constants';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

function buildCitiesEndpoint(base) {
  const normalized = String(base || '').replace(/\/$/, '');
  if (!normalized) {
    return 'http://127.0.0.1:8000/api/v1/countries/cities/by-country-code';
  }

  if (normalized.endsWith('/api/v1')) {
    return `${normalized}/countries/cities/by-country-code`;
  }

  return `${normalized}/api/v1/countries/cities/by-country-code`;
}

function toCityModel(item) {
  if (typeof item === 'string') {
    return { value: item, label: item, stateLabel: '' };
  }

  const label = item?.city_name || item?.name || item?.city || item?.district || '';
  const stateLabel =
    item?.state_name || item?.state || item?.province_name || item?.province || '';
  const value = item?.id ?? item?.city_id ?? item?.city_code ?? item?.code ?? label;

  return {
    value,
    label: label || value,
    stateLabel,
  };
}

export default function CityPickerScreen({
  onBack,
  onSelectCity,
  countryIso3,
  countryPhoneCode,
  selectedStateLabel = '',
}) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');

  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  useEffect(() => {
    let isMounted = true;

    const fetchCities = async () => {
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

        const endpoint = buildCitiesEndpoint(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL);
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
          throw new Error(`Failed to load cities: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.cities)
            ? payload.cities
            : [];

        const mapped = list
          .map(toCityModel)
          .filter((item) => Boolean(item?.label));

        if (isMounted) {
          setCities(mapped);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage('Could not load cities. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCities();

    return () => {
      isMounted = false;
    };
  }, [countryIso3, countryPhoneCode]);

  const filteredCities = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const stateQuery = selectedStateLabel.trim().toLowerCase();

    const stateFiltered = stateQuery
      ? cities.filter((city) => !city.stateLabel || city.stateLabel.toLowerCase() === stateQuery)
      : cities;

    if (!query) return stateFiltered;

    return stateFiltered.filter((city) => city.label.toLowerCase().includes(query));
  }, [cities, searchText, selectedStateLabel]);

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
            placeholder="Search City"
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
            data={filteredCities}
            keyExtractor={(city, index) => String(city.value || `${city.label}-${index}`)}
            style={styles.listWrap}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.cityRow}
                onPress={() => {
                  onSelectCity?.(item);
                }}
              >
                <Text style={styles.cityName}>{item.label}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No cities found</Text>}
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
    cityRow: {
      minHeight: isShortScreen ? vh(7.8) : vh(8.5),
      borderBottomWidth: 2,
      borderBottomColor: '#a8a8a8',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: vw(3),
    },
    cityName: {
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