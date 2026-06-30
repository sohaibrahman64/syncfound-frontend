import React from 'react';
import { Pressable, Text, View } from 'react-native';

export default function InvitesTabHeader({ tabs, activeTab, onTabPress, styles }) {
  return (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            style={styles.tabButton}
            onPress={() => onTabPress?.(tab.key)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            <View style={[styles.tabUnderline, isActive && styles.tabUnderlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}
