import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/colors';

export default function CategoryCard({ category, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={category.icon} size={28} color="#fff" />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {category.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    aspectRatio: 1.4,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    marginBottom: spacing.md,
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.h2, color: '#fff' },
});
