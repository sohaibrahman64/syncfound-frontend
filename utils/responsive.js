import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function useResponsiveMetrics() {
  const { width, height, fontScale } = useWindowDimensions();

  const safeWidth = width || BASE_WIDTH;
  const safeHeight = height || BASE_HEIGHT;

  const vw = (value) => (safeWidth * value) / 100;
  const vh = (value) => (safeHeight * value) / 100;

  const widthScale = safeWidth / BASE_WIDTH;
  const heightScale = safeHeight / BASE_HEIGHT;
  const baseScale = Math.min(widthScale, heightScale);

  const scale = (size) => size * baseScale;
  const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

  const responsiveFont = (size, min = size * 0.85, max = size * 1.25) => {
    const adjusted = moderateScale(size) / clamp(fontScale || 1, 1, 1.25);
    return clamp(adjusted, min, max);
  };

  return {
    width: safeWidth,
    height: safeHeight,
    vw,
    vh,
    scale,
    moderateScale,
    responsiveFont,
  };
}
