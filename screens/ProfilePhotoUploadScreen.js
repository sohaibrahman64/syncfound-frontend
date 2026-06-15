import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { removeProfileImage, uploadProfileImage } from '../utils/backendAuth';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';
import { BASE_URL } from '../utils/Constants';

const DEFAULT_CROP_RECT = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };

function buildProxyImageUrl(url) {
  const normalizedUrl = String(url ?? '').trim();

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return '';
  }

  return `https://images.weserv.nl/?url=${encodeURIComponent(normalizedUrl.replace(/^https?:\/\//i, ''))}`;
}

function getApiOrigin() {
  const base = String(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL || '').trim();

  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
}

function isBackendHostedUri(value) {
  const uri = String(value ?? '').trim();

  if (!/^https?:\/\//i.test(uri)) {
    return false;
  }

  const apiOrigin = getApiOrigin();
  if (!apiOrigin) {
    return false;
  }

  try {
    return new URL(uri).origin === apiOrigin;
  } catch {
    return false;
  }
}

function extractStorageUrlPath(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return '';
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      return new URL(text).pathname || '';
    } catch {
      return '';
    }
  }

  return text.startsWith('/') ? text : `/${text}`;
}

export default function ProfilePhotoUploadScreen({
  firebaseToken = '',
  onBack,
  onContinue,
  initialLinkedinProfilePictureUrl = '',
  initialProfileImageUri = '',
  initialProfileImageSource = '',
  initialProfileImageRotation = 0,
  initialProfileImageScale = 1,
  initialProfileImageTranslateX = 0,
  initialProfileImageTranslateY = 0,
  initialProfileImageCropRect = null,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(initialProfileImageUri);
  const [selectedImageSource, setSelectedImageSource] = useState(initialProfileImageSource);
  const [selectedImageOriginalUri, setSelectedImageOriginalUri] = useState(initialProfileImageUri);
  const [selectedImageRotation, setSelectedImageRotation] = useState(Number(initialProfileImageRotation) || 0);
  const [selectedImageScale, setSelectedImageScale] = useState(Number(initialProfileImageScale) || 1);
  const [selectedImageTranslateX, setSelectedImageTranslateX] = useState(Number(initialProfileImageTranslateX) || 0);
  const [selectedImageTranslateY, setSelectedImageTranslateY] = useState(Number(initialProfileImageTranslateY) || 0);
  const [selectedImageCropRect, setSelectedImageCropRect] = useState(initialProfileImageCropRect);
  const [hasTriedLinkedinProxy, setHasTriedLinkedinProxy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [uploadedImageUrlPath, setUploadedImageUrlPath] = useState('');

  const hasSelectedImage = Boolean(selectedImageUri);

  function isRemoteUri(value) {
    return /^https?:\/\//i.test(String(value ?? '').trim());
  }

  function handleEditBadgePress() {
    if (!selectedImageUri) {
      return;
    }

    onContinue?.({
      pendingProfileImageUri: selectedImageUri,
      pendingProfileImageSource: selectedImageSource || 'manual',
      profileImageRotation: selectedImageRotation,
      profileImageScale: selectedImageScale,
      profileImageTranslateX: selectedImageTranslateX,
      profileImageTranslateY: selectedImageTranslateY,
      profileImageCropRect: selectedImageCropRect,
    });
  }

  useEffect(() => {
    setSelectedImageUri(initialProfileImageUri);
    setSelectedImageSource(initialProfileImageSource);
    setSelectedImageOriginalUri(initialProfileImageUri);
    setSelectedImageRotation(Number(initialProfileImageRotation) || 0);
    setSelectedImageScale(Number(initialProfileImageScale) || 1);
    setSelectedImageTranslateX(Number(initialProfileImageTranslateX) || 0);
    setSelectedImageTranslateY(Number(initialProfileImageTranslateY) || 0);
    setSelectedImageCropRect(initialProfileImageCropRect);
    setUploadedImageUrlPath(extractStorageUrlPath(initialProfileImageUri));
    setHasTriedLinkedinProxy(false);
    setPhotoError('');
  }, [
    initialProfileImageUri,
    initialProfileImageSource,
    initialProfileImageRotation,
    initialProfileImageScale,
    initialProfileImageTranslateX,
    initialProfileImageTranslateY,
    initialProfileImageCropRect,
  ]);

  useEffect(() => {
    const normalizedUri = String(initialProfileImageUri ?? '').trim();
    const normalizedSource = String(initialProfileImageSource ?? '').trim().toLowerCase();
    const isLinkedinSource = normalizedSource === 'linkedin';
    const isRemoteImage = isRemoteUri(normalizedUri);
    const isAlreadyUploadedLinkedin = isLinkedinSource && isBackendHostedUri(normalizedUri);

    if (
      !normalizedUri
      || (isRemoteImage && !isLinkedinSource)
      || isAlreadyUploadedLinkedin
    ) {
      return undefined;
    }

    let isCancelled = false;

    async function uploadImageAfterEdit() {
      setIsUploadingPhoto(true);
      setPhotoError('');

      try {
        const result = await uploadProfileImage(normalizedUri, firebaseToken);

        if (isCancelled) {
          return;
        }

        const uploadedUri = String(result?.imageUri ?? '').trim();
        const uploadedUrlPath = extractStorageUrlPath(result?.payload?.url || uploadedUri);
        if (!uploadedUri) {
          throw new Error('Upload completed but no image URL was returned.');
        }

        setSelectedImageUri(uploadedUri);
        setSelectedImageOriginalUri(uploadedUri);
        setUploadedImageUrlPath(uploadedUrlPath);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Could not upload the edited image. Please try again.';
        setPhotoError(message);
      } finally {
        if (!isCancelled) {
          setIsUploadingPhoto(false);
        }
      }
    }

    uploadImageAfterEdit();

    return () => {
      isCancelled = true;
    };
  }, [firebaseToken, initialProfileImageSource, initialProfileImageUri]);

  async function handleRemovePress() {
    if (!hasSelectedImage || isRemovingPhoto || isUploadingPhoto) {
      return;
    }

    const removalTarget = uploadedImageUrlPath || extractStorageUrlPath(selectedImageUri);

    if (!removalTarget) {
      setPhotoError('Could not identify image URL for removal.');
      return;
    }

    setIsRemovingPhoto(true);
    setPhotoError('');

    try {
      await removeProfileImage(removalTarget, firebaseToken);

      setSelectedImageUri('');
      setSelectedImageSource('');
      setSelectedImageOriginalUri('');
      setSelectedImageRotation(0);
      setSelectedImageScale(1);
      setSelectedImageTranslateX(0);
      setSelectedImageTranslateY(0);
      setSelectedImageCropRect(null);
      setUploadedImageUrlPath('');
      setHasTriedLinkedinProxy(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Could not remove profile image. Please try again.';
      setPhotoError(message);
    } finally {
      setIsRemovingPhoto(false);
    }
  }

  function handleLinkedinSelection() {
    const linkedinPhotoUrl = String(initialLinkedinProfilePictureUrl ?? '').trim();

    if (!linkedinPhotoUrl) {
      setPhotoError('No LinkedIn profile photo found. Please use Camera or Gallery.');
      return;
    }

    setPhotoError('');
    setIsDrawerVisible(false);

    onContinue?.({
      pendingProfileImageUri: linkedinPhotoUrl,
      pendingProfileImageSource: 'linkedin',
      profileImageRotation: 0,
      profileImageScale: 1,
      profileImageTranslateX: 0,
      profileImageTranslateY: 0,
      profileImageCropRect: DEFAULT_CROP_RECT,
    });
  }

  async function handleCameraSelection() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== 'granted') {
        setPhotoError('Camera permission is required to take a picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      const pickedAsset = result.assets?.[0];
      const pickedUri = String(pickedAsset?.uri ?? '').trim();

      if (!pickedUri) {
        setPhotoError('Could not read the captured photo. Please try again.');
        return;
      }

      setPhotoError('');
      setIsDrawerVisible(false);

      onContinue?.({
        pendingProfileImageUri: pickedUri,
        pendingProfileImageSource: 'camera',
        profileImageRotation: 0,
        profileImageScale: 1,
        profileImageTranslateX: 0,
        profileImageTranslateY: 0,
        profileImageCropRect: DEFAULT_CROP_RECT,
      });
    } catch (error) {
      setPhotoError('Could not open camera on this device/browser. Please use Gallery.');
    }
  }

  async function handleGallerySelection() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        setPhotoError('Photo library permission is required to upload from gallery.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      const pickedAsset = result.assets?.[0];
      const pickedUri = String(pickedAsset?.uri ?? '').trim();

      if (!pickedUri) {
        setPhotoError('Could not read the selected photo. Please try again.');
        return;
      }

      setPhotoError('');
      setIsDrawerVisible(false);

      onContinue?.({
        pendingProfileImageUri: pickedUri,
        pendingProfileImageSource: 'gallery',
        profileImageRotation: 0,
        profileImageScale: 1,
        profileImageTranslateX: 0,
        profileImageTranslateY: 0,
        profileImageCropRect: DEFAULT_CROP_RECT,
      });
    } catch (error) {
      setPhotoError('Could not open gallery on this device/browser. Please try again.');
    }
  }

  function handleSelectedImageLoadError() {
    const canRetryWithProxy =
      selectedImageSource === 'linkedin' &&
      !hasTriedLinkedinProxy &&
      Boolean(selectedImageOriginalUri);

    if (canRetryWithProxy) {
      const proxyUrl = buildProxyImageUrl(selectedImageOriginalUri);

      if (proxyUrl) {
        setSelectedImageUri(proxyUrl);
        setHasTriedLinkedinProxy(true);
        return;
      }
    }

    setPhotoError('Could not load LinkedIn photo on this network/device. Please use Camera or Gallery.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <Text style={styles.heading}>Add your recent pic</Text>

        <View style={styles.centerWrap}>
          <View style={styles.photoWrap}>
            <Pressable
              style={styles.uploadCircle}
              onPress={() => {
                if (!hasSelectedImage) {
                  setIsDrawerVisible(true);
                }
              }}
              disabled={hasSelectedImage}
            >
              {selectedImageUri ? (
                <Image
                  source={{ uri: selectedImageUri }}
                  style={[
                    styles.selectedPhoto,
                    {
                      transform: [
                        { rotate: `${selectedImageRotation}deg` },
                        { scale: selectedImageScale },
                        { translateX: selectedImageTranslateX },
                        { translateY: selectedImageTranslateY },
                      ],
                    },
                  ]}
                  onError={handleSelectedImageLoadError}
                />
              ) : (
                <Image source={require('../assets/upload-photo.png')} style={styles.uploadIcon} />
              )}
            </Pressable>

            {selectedImageUri ? (
              <Pressable style={styles.editBadge} onPress={handleEditBadgePress} hitSlop={8}>
                <Image source={require('../assets/edit.png')} style={styles.editBadgeIcon} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actionButtonsRow}>
            <Pressable
              style={[
                styles.uploadPictureButton,
                hasSelectedImage && styles.uploadPictureButtonDisabled,
              ]}
              onPress={() => setIsDrawerVisible(true)}
              disabled={hasSelectedImage}
            >
              <Text
                style={[
                  styles.uploadPictureButtonText,
                  hasSelectedImage && styles.uploadPictureButtonTextDisabled,
                ]}
              >
                Upload Picture
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.removeButton,
                (!hasSelectedImage || isRemovingPhoto || isUploadingPhoto) && styles.removeButtonDisabled,
              ]}
              onPress={handleRemovePress}
              disabled={!hasSelectedImage || isRemovingPhoto || isUploadingPhoto}
            >
              <Text
                style={[
                  styles.removeButtonText,
                  (!hasSelectedImage || isRemovingPhoto || isUploadingPhoto) && styles.removeButtonTextDisabled,
                ]}
              >
                {isRemovingPhoto ? 'Removing...' : 'Remove'}
              </Text>
            </Pressable>
          </View>

          {selectedImageSource === 'linkedin' ? (
            <Text style={styles.selectedSourceText}>Selected from LinkedIn</Text>
          ) : null}

          {photoError ? <Text style={styles.photoErrorText}>{photoError}</Text> : null}
        </View>

        <Pressable
          style={[
            styles.continueButton,
            (!selectedImageUri || isUploadingPhoto || isRemovingPhoto) && styles.continueButtonDisabled,
          ]}
          disabled={!selectedImageUri || isUploadingPhoto || isRemovingPhoto}
          onPress={() =>
            onContinue?.({
              profileImageUri: selectedImageUri,
              profileImageSource: selectedImageSource,
              profileImageRotation: selectedImageRotation,
              profileImageScale: selectedImageScale,
              profileImageTranslateX: selectedImageTranslateX,
              profileImageTranslateY: selectedImageTranslateY,
              profileImageCropRect: selectedImageCropRect,
            })}
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedImageUri && styles.continueButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
        </Pressable>
      </View>

      {isDrawerVisible ? (
        <View style={styles.drawerOverlay} pointerEvents="box-none">
          <Pressable style={styles.drawerBackdrop} onPress={() => setIsDrawerVisible(false)} />

          <View style={styles.drawerContainer}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setIsDrawerVisible(false)}
              hitSlop={10}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>

            <Text style={styles.drawerTitle}>Show Us That Smile</Text>
            <Text style={styles.drawerSubtitle}>Upload A Profile Picture</Text>

            <Pressable style={styles.drawerRow} onPress={handleLinkedinSelection}>
              <Image
                source={require('../assets/linkedin.png')}
                style={[styles.drawerIcon, styles.drawerLinkedinIcon]}
              />
              <Text style={styles.drawerRowText}>Upload From LinkedIn</Text>
            </Pressable>

            <View style={styles.rowDivider} />

            <Pressable style={styles.drawerRow} onPress={handleCameraSelection}>
              <Image source={require('../assets/take-photo.png')} style={styles.drawerIcon} />
              <Text style={styles.drawerRowText}>Take a Picture</Text>
            </Pressable>

            <View style={styles.rowDivider} />

            <Pressable style={styles.drawerRow} onPress={handleGallerySelection}>
              <Image source={require('../assets/gallery.png')} style={styles.drawerIcon} />
              <Text style={styles.drawerRowText}>Upload From Gallery</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={isUploadingPhoto} animationType="fade" statusBarTranslucent>
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadDialog}>
            <ActivityIndicator size="large" color="#26c6d0" />
            <Text style={styles.uploadDialogTitle}>Uploading photo...</Text>
            <Text style={styles.uploadDialogSubtitle}>Please wait while we save your edited image.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#f3f3f3',
    },
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: vw(95),
      height: vh(1.2),
      backgroundColor: '#26c6d0',
      zIndex: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(5),
      paddingTop: isShortScreen ? vh(3.2) : vh(4.2),
      paddingBottom: vh(3.2),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: isShortScreen ? vh(2.8) : vh(3.5),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      height: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      resizeMode: 'contain',
      tintColor: '#7d8498',
    },
    heading: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      marginBottom: vh(4),
      maxWidth: '90%',
    },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingBottom: vh(2),
    },
    uploadCircle: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f3f3',
    },
    photoWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadIcon: {
      width: moderateScale(isShortScreen ? 200 : 250),
      height: moderateScale(isShortScreen ? 200 : 250),
      resizeMode: 'contain',
      tintColor: '#26c6d0',
    },
    uploadPictureButton: {
      minWidth: vw(isNarrowScreen ? 40 : 35),
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 42 : 46),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
    },
    uploadPictureButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 18, 22),
      fontWeight: '600',
      textAlign: 'center',
    },
    uploadPictureButtonDisabled: {
      backgroundColor: '#cdcdcf',
    },
    uploadPictureButtonTextDisabled: {
      color: '#707c96',
    },
    actionButtonsRow: {
      marginTop: vh(1.6),
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: vw(3),
    },
    removeButton: {
      minWidth: vw(isNarrowScreen ? 32 : 30),
      borderRadius: 999,
      backgroundColor: '#ef4444',
      minHeight: moderateScale(isShortScreen ? 42 : 46),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
    },
    removeButtonDisabled: {
      backgroundColor: '#cdcdcf',
    },
    removeButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 18, 22),
      fontWeight: '600',
      textAlign: 'center',
    },
    removeButtonTextDisabled: {
      color: '#707c96',
    },
    continueButton: {
      marginTop: 'auto',
      width: isNarrowScreen ? '84%' : '80%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginBottom: vh(0.6),
    },
    continueButtonDisabled: {
      backgroundColor: '#cdcdcf',
    },
    continueButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
      textAlign: 'center',
    },
    continueButtonTextDisabled: {
      color: '#707c96',
    },
    selectedPhoto: {
      width: moderateScale(isShortScreen ? 180 : 220),
      height: moderateScale(isShortScreen ? 180 : 220),
      borderRadius: moderateScale(isShortScreen ? 90 : 110),
      resizeMode: 'cover',
      backgroundColor: '#d7d7d7',
    },
    editBadge: {
      position: 'absolute',
      right: vw(0.2),
      bottom: vh(0.2),
      width: moderateScale(isShortScreen ? 36 : 40),
      height: moderateScale(isShortScreen ? 36 : 40),
      borderRadius: 999,
      backgroundColor: '#ffffff',
      borderWidth: 2,
      borderColor: '#26c6d0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBadgeIcon: {
      width: moderateScale(isShortScreen ? 18 : 20),
      height: moderateScale(isShortScreen ? 18 : 20),
      resizeMode: 'contain',
      tintColor: '#26c6d0',
    },
    selectedSourceText: {
      color: '#5e5e5e',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '500',
      marginTop: vh(1.2),
    },
    photoErrorText: {
      color: '#dc2626',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '400',
      marginTop: vh(0.9),
      textAlign: 'center',
      paddingHorizontal: vw(7),
    },
    drawerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    drawerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(27, 27, 27, 0.16)',
    },
    drawerContainer: {
      borderTopLeftRadius: moderateScale(28),
      borderTopRightRadius: moderateScale(28),
      backgroundColor: '#f3f3f3',
      paddingTop: vh(1.8),
      paddingBottom: vh(3.4),
      paddingHorizontal: vw(6),
      borderTopWidth: 1,
      borderColor: '#d4d1cf',
    },
    closeButton: {
      alignSelf: 'flex-end',
      paddingHorizontal: vw(1.2),
      paddingVertical: vh(0.2),
      marginBottom: vh(0.8),
    },
    closeButtonText: {
      color: '#575757',
      fontSize: responsiveFont(30, 24, 34),
      lineHeight: responsiveFont(30, 24, 34),
      fontWeight: '400',
    },
    drawerTitle: {
      textAlign: 'center',
      color: '#1f1f1f',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 18, 24),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 22, 32),
      fontWeight: '700',
      marginBottom: vh(0.4),
    },
    drawerSubtitle: {
      textAlign: 'center',
      color: '#666666',
      fontSize: responsiveFont(isShortScreen ? 16 : 17, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 21 : 22, 18, 25),
      fontWeight: '400',
      marginBottom: vh(2),
    },
    drawerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: vw(4),
      paddingVertical: vh(1.7),
      paddingHorizontal: vw(1.2),
    },
    drawerIcon: {
      width: moderateScale(isShortScreen ? 35 : 39),
      height: moderateScale(isShortScreen ? 35 : 39),
      resizeMode: 'contain',
      tintColor: '#26c6d0',
    },
    drawerLinkedinIcon: {
      width: moderateScale(isShortScreen ? 36 : 40),
      height: moderateScale(isShortScreen ? 36 : 40),
      tintColor: undefined,
    },
    drawerRowText: {
      color: '#555555',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '600',
    },
    rowDivider: {
      height: 1,
      backgroundColor: '#c8c5c3',
      marginHorizontal: vw(0.5),
    },
    uploadOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(8),
    },
    uploadDialog: {
      width: '100%',
      maxWidth: moderateScale(320),
      borderRadius: moderateScale(20),
      backgroundColor: '#ffffff',
      paddingVertical: vh(2.8),
      paddingHorizontal: vw(6),
      alignItems: 'center',
    },
    uploadDialogTitle: {
      marginTop: vh(1.5),
      color: '#1d1d1d',
      fontSize: responsiveFont(20, 17, 22),
      lineHeight: responsiveFont(24, 20, 26),
      fontWeight: '700',
      textAlign: 'center',
    },
    uploadDialogSubtitle: {
      marginTop: vh(0.8),
      color: '#606060',
      fontSize: responsiveFont(14, 13, 16),
      lineHeight: responsiveFont(19, 16, 21),
      fontWeight: '400',
      textAlign: 'center',
    },
  }));
}
