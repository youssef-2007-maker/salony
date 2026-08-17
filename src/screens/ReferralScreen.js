import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { useLoyalty } from '../state/LoyaltyContext';

export default function ReferralScreen({ navigation }) {
  const { referralCode, referralCount } = useLoyalty();

  const onShare = async () => {
    try {
      await Share.share({
        message: `I've been booking my cuts on Salony — use my code ${referralCode} when you sign up and we both get 50 points! https://salony.app`,
      });
    } catch { /* */ }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Refer a friend</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.hero, shadow.card]}>
          <Ionicons name="gift" size={48} color="#fff" />
          <Text style={styles.heroTitle}>Give 50, get 50</Text>
          <Text style={styles.heroSub}>
            Share your code. When a friend signs up and completes their first booking, both of you
            get 50 points to spend on your next cut.
          </Text>
        </View>

        <View style={[styles.codeCard, shadow.card]}>
          <Text style={styles.codeLabel}>Your code</Text>
          <Text style={styles.code}>{referralCode || '—'}</Text>
          <Pressable onPress={onShare} style={styles.shareBtn}>
            <Ionicons name="share-social" size={16} color="#fff" />
            <Text style={styles.shareBtnText}>Share my code</Text>
          </Pressable>
        </View>

        <View style={[styles.statsCard, shadow.card]}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{referralCount}</Text>
            <Text style={styles.statLabel}>Friends joined</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{referralCount * 50}</Text>
            <Text style={styles.statLabel}>Points earned</Text>
          </View>
        </View>

        <Text style={styles.foot}>
          Codes can be entered at signup. You can also paste a friend's code in your Profile if you
          haven't yet.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },

  hero: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center',
  },
  heroTitle: { ...typography.display, color: '#fff', marginTop: spacing.md },
  heroSub: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 6, lineHeight: 18 },

  codeCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.md, alignItems: 'center',
  },
  codeLabel: { color: colors.textMuted, fontSize: 12 },
  code: { ...typography.display, color: colors.primary, marginTop: 4, letterSpacing: 2 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, marginTop: spacing.md,
  },
  shareBtnText: { color: '#fff', fontWeight: '800', marginLeft: 6 },

  statsCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginTop: spacing.md,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.display, color: colors.text },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  foot: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, lineHeight: 18 },
});
