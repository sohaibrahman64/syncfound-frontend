import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

export function getCompanySizeSelectionLabel(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "object") return String(value);
  return String(
    value.label ??
      value.company_size_interest_level ??
      value.company_size_interest_level_name ??
      value.company_size_interest_level_label ??
      value.interest_level ??
      value.interest_level_name ??
      value.name ??
      "",
  );
}

export default function CompanySizeInterestLevelPicker({
  field,
  selectedOption,
  options,
  loading,
  errorMessage,
  isOpen,
  onOpen,
  onClose,
  onRetry,
  onSelect,
  styles,
}) {
  const selectedLabel = getCompanySizeSelectionLabel(selectedOption);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select interest level for ${field.label}`}
        accessibilityState={{ expanded: isOpen }}
        onPress={onOpen}
        style={styles.companySizeField}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.companySizeFieldText,
            selectedLabel && styles.companySizeSelectedFieldText,
          ]}
        >
          {selectedLabel ? `${field.label} · ${selectedLabel}` : field.label}
        </Text>
        <Text style={styles.companySizeChevron}>▼</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.companySizeModalBackdrop} onPress={onClose}>
          <Pressable
            style={styles.companySizeModalCard}
            onPress={() => {}}
          >
            <Text style={styles.companySizeModalTitle}>
              Select interest level
            </Text>
            <Text style={styles.companySizeModalSubtitle}>{field.label}</Text>

            {loading ? (
              <ActivityIndicator color="#2dbcc4" style={styles.companySizePickerLoading} />
            ) : errorMessage ? (
              <View>
                <Text style={styles.companySizePickerError}>{errorMessage}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetry}
                  style={styles.companySizeRetryButton}
                >
                  <Text style={styles.companySizeRetryText}>Retry</Text>
                </Pressable>
              </View>
            ) : options.length ? (
              <ScrollView
                style={styles.companySizeOptionsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {options.map((option) => {
                  const selected =
                    String(selectedOption?.id ?? selectedLabel) ===
                    String(option.id ?? option.label);
                  return (
                    <Pressable
                      key={String(option.id ?? option.label)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => onSelect(option)}
                      style={styles.companySizeModalOption}
                    >
                      <Text style={styles.companySizeModalOptionText}>
                        {option.label}
                      </Text>
                      <View
                        style={[
                          styles.companySizeOptionRadio,
                          selected && styles.companySizeOptionRadioSelected,
                        ]}
                      >
                        {selected ? (
                          <View style={styles.companySizeOptionRadioDot} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.companySizePickerError}>
                No interest levels are available.
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
