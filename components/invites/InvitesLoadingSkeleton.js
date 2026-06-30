import React from 'react';
import { View } from 'react-native';

function SkeletonCard({ styles }) {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonTop} />
      <View style={styles.skeletonDivider} />
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.skeletonLinesWrap}>
          <View style={styles.skeletonLineLarge} />
          <View style={styles.skeletonLineMedium} />
        </View>
      </View>
      <View style={styles.skeletonLineSmall} />
      <View style={styles.skeletonLineSmall} />
      <View style={styles.skeletonLineShort} />
    </View>
  );
}

export default function InvitesLoadingSkeleton({ styles }) {
  return (
    <View style={styles.listContentWrap}>
      <SkeletonCard styles={styles} />
      <SkeletonCard styles={styles} />
    </View>
  );
}
