import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { useFavourites } from '../state/FavouritesContext';

export default function SalonCard({ salon, onPress, wide }) {
  const { isFavourite, toggle } = useFavourites();
  const fav = isFavourite(salon.id);

  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.wide, shadow.card]}>
      <View style={styles.logoWrap}>
        <Text style={styles.logoText}>
          {salon.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
        </Text>
      </View>
      <View style={styles.body}>
        {(salon.isBoosted || salon.deal) && (
          <View style={styles.badgeRow}>
            {salon.isBoosted && (
              <View style={styles.promotedTag}>
                <Ionicons name="rocket" size={8} color="#fff" />
                <Text style={styles.promotedText}>Promoted</Text>
              </View>
            )}
            {salon.deal && (
              <View style={styles.dealTag}>
                <Text style={styles.dealTagText}>{salon.deal.pct}% OFF</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            <Text numberOfLines={1} style={styles.name}>{salon.name}</Text>
            {salon.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
            )}
          </View>
          <Pressable onPress={() => toggle(salon.id)} hitSlop={10}>
            <Ionicons
              name={fav ? 'heart' : 'heart-outline'}
              size={20}
              color={fav ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="star" size={14} color={colors.accent} />
          <Text style={styles.metaText}>
            {Number(salon.rating || 0).toFixed(1)} ({salon.reviewCount || 0})
          </Text>
          {salon.distanceKm != null && (
            <Text style={[styles.metaText, { marginLeft: 8 }]}>· {salon.distanceKm} km</Text>
          )}
        </View>
        <View style={styles.tagRow}>
          {salon.plan === 'premium' && (
            <View style={[styles.tag, styles.premiumTag]}>
              <Ionicons name="diamond" size={10} color="#fff" />
              <Text style={[styles.tagText, { color: '#fff', marginLeft: 4 }]}>Premium</Text>
            </View>
          )}
          {(salon.tags || []).slice(0, 3).map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: 260,
    marginRight: spacing.md,
  },
  wide: { width: '100%', marginRight: 0, marginBottom: spacing.md, flexDirection: 'row' },
  logoWrap: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 },
  promotedTag: {
    backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center',
    marginRight: 6,
  },
  promotedText: {
    color: '#fff', fontSize: 8, fontWeight: '800', marginLeft: 2,
    includeFontPadding: false,
  },
  dealTag: {
    backgroundColor: colors.danger, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.pill, alignItems: 'center',
  },
  dealTagText: {
    color: '#fff', fontSize: 8, fontWeight: '800', includeFontPadding: false,
  },
  body: { flex: 1, justifyContent: 'center' },
  name: { ...typography.h2, color: colors.text, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { ...typography.small, color: colors.textMuted, marginLeft: 4 },
  tagRow: { flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: colors.surfaceMuted, borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 4,
    flexDirection: 'row', alignItems: 'center',
  },
  premiumTag: { backgroundColor: colors.primary },
  tagText: { ...typography.tiny, color: colors.textMuted },
});
