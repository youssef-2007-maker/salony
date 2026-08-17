import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { useLoyalty } from '../state/LoyaltyContext';

export default function RewardsScreen({ navigation }) {
  const { points, tier, nextTier, lifetimeSpent, subscription, history, refresh } = useLoyalty();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => { refresh(); }, [refresh]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const progress = nextTier
    ? Math.min(1, (lifetimeSpent || 0) / nextTier.min)
    : 1;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.heroCard, { backgroundColor: tier?.color || colors.primary }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>YOUR POINTS</Text>
              <Text style={styles.heroValue}>{points}</Text>
              <Text style={styles.heroSub}>≈ {points} EGP off your next cut</Text>
            </View>
            <View style={styles.tierBadge}>
              <Ionicons name="medal" size={20} color="#fff" />
              <Text style={styles.tierLabel}>{tier?.label?.toUpperCase() || 'BRONZE'}</Text>
            </View>
          </View>
          {nextTier && (
            <>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.heroFoot}>
                Spend {nextTier.deficit} EGP more to reach {nextTier.label} ({nextTier.multiplier}× points)
              </Text>
            </>
          )}
        </View>

        <View style={styles.actionsRow}>
          <ActionBtn
            icon="gift"
            label="Refer a friend"
            sub="+50 pts each"
            onPress={() => navigation.navigate('Referral')}
          />
          <ActionBtn
            icon="diamond"
            label={subscription?.active ? 'Salony Plus' : 'Join Plus'}
            sub={subscription?.active ? 'Active' : '99 EGP/mo'}
            onPress={() => navigation.navigate('Plus')}
          />
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>How points work</Text>
          <Bullet icon="cash" text={`Earn ${(tier?.multiplier || 1) * 5}% of every booking back as points (your ${tier?.label} multiplier).`} />
          <Bullet icon="star" text="Earn 25 points for every review you post." />
          <Bullet icon="ticket" text="Redeem at booking — 1 point = 1 EGP off (up to 50% of the price)." />
          <Bullet icon="people" text="Refer a friend with your code — both get 50 points on their first booking." />
        </View>

        <Text style={styles.section}>Recent activity</Text>
        {history.length === 0 ? (
          <Text style={styles.empty}>No activity yet.</Text>
        ) : history.map((h) => (
          <View key={h.id} style={[styles.histRow, shadow.card]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.histTitle}>{h.note || h.reason}</Text>
              <Text style={styles.histSub}>{new Date(h.created_at).toLocaleString()}</Text>
            </View>
            <Text style={[styles.histDelta, { color: h.delta >= 0 ? colors.success : colors.danger }]}>
              {h.delta >= 0 ? '+' : ''}{h.delta}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ icon, text }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
      <Ionicons name={icon} size={16} color={colors.primary} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, marginLeft: 8, color: colors.text, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, sub, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.action, shadow.card]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  heroCard: {
    margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: '#fff', fontSize: 48, fontWeight: '900', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill,
  },
  tierLabel: { color: '#fff', fontWeight: '800', marginLeft: 4, fontSize: 12 },
  bar: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginTop: spacing.md, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  heroFoot: { color: 'rgba(255,255,255,0.95)', marginTop: 8, fontSize: 12 },

  actionsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  action: {
    flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md,
    marginRight: spacing.sm,
  },
  actionLabel: { color: colors.text, fontWeight: '800', marginTop: 6 },
  actionSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  cardTitle: { ...typography.h2, color: colors.text },

  section: { ...typography.h2, color: colors.text, paddingHorizontal: spacing.lg, marginBottom: 8 },
  empty: { color: colors.textMuted, paddingHorizontal: spacing.lg },
  histRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.md, marginHorizontal: spacing.lg, marginBottom: 6,
  },
  histTitle: { color: colors.text, fontWeight: '700' },
  histSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  histDelta: { fontWeight: '800' },
});
