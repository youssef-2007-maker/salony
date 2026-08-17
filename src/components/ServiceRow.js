import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';

export default function ServiceRow({ service, onPress, compact }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, shadow.card, compact && { marginBottom: 0 }]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="cut" size={20} color="#fff" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{service.title}</Text>
        <Text style={styles.meta} numberOfLines={2}>
          {service.duration} · {service.details}
        </Text>
      </View>
      <Text style={styles.price}>{service.price} EGP</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  body: { flex: 1 },
  title: { ...typography.h2, color: colors.text },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  price: { ...typography.h2, color: colors.primary, marginLeft: spacing.md },
});
