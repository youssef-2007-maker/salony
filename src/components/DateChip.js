import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

export default function DateChip({ day, label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.active]}
    >
      <Text style={[styles.day, active && styles.dayActive]}>{day}</Text>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 54,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  day: { fontSize: 18, fontWeight: '800', color: colors.text },
  dayActive: { color: '#fff' },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  labelActive: { color: '#fff' },
});
