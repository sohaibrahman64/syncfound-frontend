import { Platform } from 'react-native';

const PLUS_JAKARTA_FAMILIES = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export function getPlatformBaseFontFamily() {
  if (Platform.OS === 'ios') {
    return 'System';
  }

  return PLUS_JAKARTA_FAMILIES.regular;
}

export function getPlatformFontFamilyForWeight(fontWeight) {
  if (Platform.OS === 'ios') {
    return 'System';
  }

  const normalizedWeight = Number.parseInt(String(fontWeight ?? '400'), 10);

  if (normalizedWeight >= 700) {
    return PLUS_JAKARTA_FAMILIES.bold;
  }

  if (normalizedWeight >= 600) {
    return PLUS_JAKARTA_FAMILIES.semibold;
  }

  if (normalizedWeight >= 500) {
    return PLUS_JAKARTA_FAMILIES.medium;
  }

  return PLUS_JAKARTA_FAMILIES.regular;
}

export function withPlatformFontStyles(styleDefinitions) {
  if (Platform.OS === 'ios') {
    return styleDefinitions;
  }

  return Object.fromEntries(
    Object.entries(styleDefinitions).map(([styleName, styleValue]) => {
      if (!styleValue || Array.isArray(styleValue) || typeof styleValue !== 'object') {
        return [styleName, styleValue];
      }

      if (styleValue.fontFamily || !styleValue.fontWeight) {
        return [styleName, styleValue];
      }

      return [
        styleName,
        {
          ...styleValue,
          fontFamily: getPlatformFontFamilyForWeight(styleValue.fontWeight),
        },
      ];
    }),
  );
}