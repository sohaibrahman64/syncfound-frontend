import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRotation(value) {
  return ((value % 360) + 360) % 360;
}

function buildProxyImageUrl(url) {
  const normalizedUrl = String(url ?? '').trim();

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return '';
  }

  return `https://images.weserv.nl/?url=${encodeURIComponent(normalizedUrl.replace(/^https?:\/\//i, ''))}`;
}

const MIN_CROP_RATIO = 0.2;
const DEFAULT_CROP_RECT = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };

function normalizeCropRect(value) {
  const raw = value && typeof value === 'object' ? value : DEFAULT_CROP_RECT;
  const next = {
    x: Number(raw.x),
    y: Number(raw.y),
    width: Number(raw.width),
    height: Number(raw.height),
  };

  if (
    !Number.isFinite(next.x) ||
    !Number.isFinite(next.y) ||
    !Number.isFinite(next.width) ||
    !Number.isFinite(next.height)
  ) {
    return { ...DEFAULT_CROP_RECT };
  }

  return {
    x: clamp(next.x, 0, 1),
    y: clamp(next.y, 0, 1),
    width: clamp(next.width, MIN_CROP_RATIO, 1),
    height: clamp(next.height, MIN_CROP_RATIO, 1),
  };
}

export default function ProfileEditPictureScreen({
  onBack,
  onContinue,
  initialImageUri = '',
  initialImageSource = '',
  initialRotation = 0,
  initialScale = 1,
  initialTranslateX = 0,
  initialTranslateY = 0,
  initialCropRect = null,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const frameSize = Math.min(metrics.width, metrics.height) * 0.9;

  function clampTranslation(value, forScale) {
    const maxOffset = ((forScale - 1) * frameSize) / 2;
    return clamp(value, -maxOffset, maxOffset);
  }

  const [activeTool, setActiveTool] = useState('rotate');
  const [rotation, setRotation] = useState(normalizeRotation(Number(initialRotation) || 0));
  const [scale, setScale] = useState(clamp(Number(initialScale) || 1, 1, 2));
  const [translateX, setTranslateX] = useState(clampTranslation(Number(initialTranslateX) || 0, Number(initialScale) || 1));
  const [translateY, setTranslateY] = useState(clampTranslation(Number(initialTranslateY) || 0, Number(initialScale) || 1));
  const [cropRect, setCropRect] = useState(() => normalizeCropRect(initialCropRect));
  const [rulerTrackWidth, setRulerTrackWidth] = useState(0);
  const [imageUri, setImageUri] = useState(initialImageUri);
  const [hasTriedProxy, setHasTriedProxy] = useState(false);
  const [imageLoadError, setImageLoadError] = useState('');

  const activeToolRef = useRef(activeTool);
  const gestureStartRotationRef = useRef(rotation);
  const gestureStartScaleRef = useRef(scale);
  const gestureStartTranslateXRef = useRef(translateX);
  const gestureStartTranslateYRef = useRef(translateY);
  const cropRectRef = useRef(cropRect);
  const cropStartRectRef = useRef(cropRect);

  const isRotateTool = activeTool === 'rotate';
  const valueMin = isRotateTool ? 0 : 1;
  const valueMax = isRotateTool ? 360 : 2;
  const currentValue = isRotateTool ? rotation : scale;
  const normalized = clamp((currentValue - valueMin) / (valueMax - valueMin), 0, 1);
  const indicatorLeftPercent = normalized * 100;
  const rulerLabel = isRotateTool ? `${Math.round(rotation)}°` : `${Math.round(scale * 100)}%`;

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    cropRectRef.current = cropRect;
  }, [cropRect]);

  const imagePanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStartRotationRef.current = rotation;
        gestureStartScaleRef.current = scale;
        gestureStartTranslateXRef.current = translateX;
        gestureStartTranslateYRef.current = translateY;
      },
      onPanResponderMove: (_, gestureState) => {
        if (activeToolRef.current === 'rotate') {
          const nextRotation = normalizeRotation(gestureStartRotationRef.current + gestureState.dx * 0.18);
          setRotation(nextRotation);
        }
      },
    }),
    [rotation, scale],
  );

  useEffect(() => {
    setTranslateX((value) => clampTranslation(value, scale));
    setTranslateY((value) => clampTranslation(value, scale));
  }, [scale]);

  function applyRulerValue(locationX, trackWidth) {
    if (!trackWidth) {
      return;
    }

    const ratio = clamp(locationX / trackWidth, 0, 1);
    const mappedValue = valueMin + ratio * (valueMax - valueMin);

    if (isRotateTool) {
      setRotation(normalizeRotation(mappedValue));
    } else {
      setScale(clamp(mappedValue, 1, 2));
    }
  }

  function handleRulerStart(event) {
    const { locationX } = event.nativeEvent;
    applyRulerValue(locationX, rulerTrackWidth);
  }

  function handleRulerMove(event) {
    const { locationX } = event.nativeEvent;
    applyRulerValue(locationX, rulerTrackWidth);
  }

  function handleSave() {
    onContinue?.({
      profileImageUri: imageUri,
      profileImageSource: initialImageSource,
      profileImageRotation: rotation,
      profileImageScale: scale,
      profileImageTranslateX: translateX,
      profileImageTranslateY: translateY,
      profileImageCropRect: cropRect,
      pendingProfileImageUri: '',
      pendingProfileImageSource: '',
    });
  }

  function updateCropRectFromCorner(corner, dx, dy) {
    const start = cropStartRectRef.current;
    const dxRatio = dx / frameSize;
    const dyRatio = dy / frameSize;

    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    if (corner.includes('left')) {
      left = clamp(left + dxRatio, 0, right - MIN_CROP_RATIO);
    }

    if (corner.includes('right')) {
      right = clamp(right + dxRatio, left + MIN_CROP_RATIO, 1);
    }

    if (corner.includes('top')) {
      top = clamp(top + dyRatio, 0, bottom - MIN_CROP_RATIO);
    }

    if (corner.includes('bottom')) {
      bottom = clamp(bottom + dyRatio, top + MIN_CROP_RATIO, 1);
    }

    setCropRect({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }

  function createCornerPanResponder(corner) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => activeToolRef.current === 'crop',
      onMoveShouldSetPanResponder: () => activeToolRef.current === 'crop',
      onPanResponderGrant: () => {
        cropStartRectRef.current = cropRectRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        updateCropRectFromCorner(corner, gestureState.dx, gestureState.dy);
      },
    });
  }

  const topLeftCornerResponder = useMemo(() => createCornerPanResponder('top-left'), []);
  const topRightCornerResponder = useMemo(() => createCornerPanResponder('top-right'), []);
  const bottomLeftCornerResponder = useMemo(() => createCornerPanResponder('bottom-left'), []);
  const bottomRightCornerResponder = useMemo(() => createCornerPanResponder('bottom-right'), []);

  function handleRotateButtonPress() {
    setActiveTool('rotate');
    setRotation((currentRotation) => normalizeRotation(currentRotation + 90));
  }

  function handleCropButtonPress() {
    setActiveTool('crop');
  }

  function handleImageLoadError() {
    if (!hasTriedProxy && initialImageSource === 'linkedin') {
      const proxyUrl = buildProxyImageUrl(initialImageUri);
      if (proxyUrl) {
        setImageUri(proxyUrl);
        setHasTriedProxy(true);
        return;
      }
    }

    setImageLoadError('Could not load this image for editing.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.headerIconWrap}>
          <Text style={styles.headerIconText}>×</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Edit Picture</Text>

        <Pressable onPress={handleSave} hitSlop={10} style={styles.headerIconWrap}>
          <Text style={styles.headerIconText}>✓</Text>
        </Pressable>
      </View>

      <View style={styles.editorWrap}>
        <View style={styles.previewFrame} {...imagePanResponder.panHandlers}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.previewImage,
                {
                  transform: [
                    { rotate: `${rotation}deg` },
                    { scale },
                    { translateX },
                    { translateY },
                  ],
                },
              ]}
              onError={handleImageLoadError}
            />
          ) : (
            <Text style={styles.emptyText}>No image selected</Text>
          )}

          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.gridLineHorizontal} />
            <View style={styles.gridLineHorizontalBottom} />
            <View style={styles.gridLineVertical} />
            <View style={styles.gridLineVerticalRight} />
          </View>

          {!isRotateTool ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View
                style={[
                  styles.cropMaskTop,
                  {
                    height: `${cropRect.y * 100}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.cropMaskBottom,
                  {
                    top: `${(cropRect.y + cropRect.height) * 100}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.cropMaskLeft,
                  {
                    top: `${cropRect.y * 100}%`,
                    height: `${cropRect.height * 100}%`,
                    width: `${cropRect.x * 100}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.cropMaskRight,
                  {
                    top: `${cropRect.y * 100}%`,
                    left: `${(cropRect.x + cropRect.width) * 100}%`,
                    height: `${cropRect.height * 100}%`,
                  },
                ]}
              />

              <View
                style={[
                  styles.cropOutline,
                  {
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                    width: `${cropRect.width * 100}%`,
                    height: `${cropRect.height * 100}%`,
                  },
                ]}
                pointerEvents="none"
              />

              <View
                style={[
                  styles.cropCorner,
                  {
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                  },
                ]}
                {...topLeftCornerResponder.panHandlers}
              >
                <Image source={require('../assets/crop-top-left-corner.png')} style={styles.cropCornerIcon} />
              </View>

              <View
                style={[
                  styles.cropCorner,
                  {
                    left: `${(cropRect.x + cropRect.width) * 100}%`,
                    top: `${cropRect.y * 100}%`,
                  },
                ]}
                {...topRightCornerResponder.panHandlers}
              >
                <Image source={require('../assets/crop-top-right-corner.png')} style={styles.cropCornerIcon} />
              </View>

              <View
                style={[
                  styles.cropCorner,
                  {
                    left: `${cropRect.x * 100}%`,
                    top: `${(cropRect.y + cropRect.height) * 100}%`,
                  },
                ]}
                {...bottomLeftCornerResponder.panHandlers}
              >
                <Image source={require('../assets/crop-bottom-left-corner.png')} style={styles.cropCornerIcon} />
              </View>

              <View
                style={[
                  styles.cropCorner,
                  {
                    left: `${(cropRect.x + cropRect.width) * 100}%`,
                    top: `${(cropRect.y + cropRect.height) * 100}%`,
                  },
                ]}
                {...bottomRightCornerResponder.panHandlers}
              >
                <Image source={require('../assets/crop-bottom-right-corner.png')} style={styles.cropCornerIcon} />
              </View>
            </View>
          ) : null}
        </View>

        {imageLoadError ? <Text style={styles.errorText}>{imageLoadError}</Text> : null}
      </View>

      {isRotateTool ? (
        <View style={styles.rulerArea}>
          <Text style={styles.rulerLabel}>{rulerLabel}</Text>
          <View
            style={styles.rulerTrack}
            onLayout={(event) => setRulerTrackWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleRulerStart}
            onResponderMove={handleRulerMove}
          >
            {Array.from({ length: 17 }).map((_, index) => (
              <View key={`tick-${index}`} style={styles.rulerTick} />
            ))}
            <View style={[styles.rulerIndicator, { left: `${indicatorLeftPercent}%` }]} />
          </View>
        </View>
      ) : null}

      <View style={styles.toolBar}>
        <Pressable
          style={[styles.toolButton, isRotateTool && styles.toolButtonActive]}
          onPress={handleRotateButtonPress}
          hitSlop={10}
        >
          <Image source={require('../assets/rotate-image.png')} style={styles.toolIcon} />
          <Text style={styles.toolLabel}>Rotate</Text>
        </Pressable>

        <Pressable
          style={[styles.toolButton, !isRotateTool && styles.toolButtonActive]}
          onPress={handleCropButtonPress}
          hitSlop={10}
        >
          <Image source={require('../assets/crop-image.png')} style={styles.toolIcon} />
          <Text style={styles.toolLabel}>Crop</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }) {
  const isShortScreen = height < 760;
  const frameSize = Math.min(width, height) * 0.9;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#efefef',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: vw(4),
      paddingVertical: vh(1.4),
      borderBottomWidth: 1,
      borderBottomColor: '#d9d9d9',
      backgroundColor: '#efefef',
    },
    headerIconWrap: {
      minWidth: moderateScale(34),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconText: {
      color: '#7d8498',
      fontSize: responsiveFont(38, 30, 42),
      lineHeight: responsiveFont(38, 30, 42),
      fontWeight: '500',
    },
    headerTitle: {
      color: '#0f0f0f',
       fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
    },
    editorWrap: {
      alignItems: 'center',
      paddingTop: vh(1.2),
    },
    previewFrame: {
      width: frameSize,
      height: frameSize,
      backgroundColor: '#d9d9d9',
      overflow: 'hidden',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    emptyText: {
      color: '#6e6e6e',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 18, 22),
      fontWeight: '500',
    },
    gridOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    gridLineHorizontal: {
      position: 'absolute',
      top: '33.33%',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
    gridLineHorizontalBottom: {
      position: 'absolute',
      top: '66.66%',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
    gridLineVertical: {
      position: 'absolute',
      left: '33.33%',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
    gridLineVerticalRight: {
      position: 'absolute',
      left: '66.66%',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
    cropMaskTop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      backgroundColor: 'rgba(0,0,0,0.26)',
    },
    cropMaskBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.26)',
    },
    cropMaskLeft: {
      position: 'absolute',
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.26)',
    },
    cropMaskRight: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.26)',
    },
    cropOutline: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.9)',
    },
    cropCorner: {
      position: 'absolute',
      marginLeft: -20,
      marginTop: -20,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cropCornerIcon: {
      width: moderateScale(28),
      height: moderateScale(28),
      resizeMode: 'contain',
    },
    errorText: {
      color: '#dc2626',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '400',
      marginTop: vh(1),
    },
    rulerArea: {
      marginTop: vh(1.4),
      paddingHorizontal: vw(3),
      alignItems: 'center',
    },
    rulerLabel: {
      color: '#028fb0',
      fontSize: responsiveFont(isShortScreen ? 34 : 38, 24, 42),
      lineHeight: responsiveFont(isShortScreen ? 40 : 44, 28, 48),
      fontWeight: '700',
      marginBottom: vh(0.8),
    },
    rulerTrack: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: vw(0.8),
      paddingVertical: vh(0.8),
      position: 'relative',
      borderTopWidth: 1,
      borderTopColor: '#cfcfcf',
    },
    rulerTick: {
      width: 2,
      height: moderateScale(22),
      backgroundColor: '#191919',
      borderRadius: 1,
    },
    rulerIndicator: {
      position: 'absolute',
      top: 0,
      marginLeft: -1,
      width: 3,
      height: moderateScale(30),
      backgroundColor: '#00a3c4',
      borderRadius: 2,
    },
    toolBar: {
      marginTop: 'auto',
      backgroundColor: '#090909',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      paddingTop: vh(1.6),
      paddingBottom: vh(2.2),
      minHeight: moderateScale(102),
    },
    toolButton: {
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.8,
      minWidth: vw(28),
      gap: vh(0.4),
    },
    toolButtonActive: {
      opacity: 1,
      borderBottomWidth: 2,
      borderBottomColor: '#00afce',
    },
    toolIcon: {
      width: moderateScale(34),
      height: moderateScale(34),
      resizeMode: 'contain',
      tintColor: '#00afce',
    },
    toolLabel: {
      color: '#f0f0f0',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(20, 16, 22),
      fontWeight: '500',
    },
  }));
}
