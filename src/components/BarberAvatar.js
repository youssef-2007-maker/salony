import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';

export default function BarberAvatar({ barber, active, onPress }) {
  const tint = barber.isAny
    ? colors.surfaceMuted
    : colors.avatarTints[barber.tint ?? 0];
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: tint },
          active && styles.activeRing,
        ]}
      >
        {barber.isAny ? (
          <Ionicons name="people" size={22} color={colors.textMuted} />
        ) : (
          <Text style={styles.initial}>{barber.initial}</Text>
        )}
      </View>
      <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
        {barber.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginRight: spacing.lg, width: 64 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeRing: { borderColor: colors.primary },
  initial: { color: '#fff', fontWeight: '800', fontSize: 20 },
  name: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  nameActive: { color: colors.primary, fontWeight: '700' },
});
