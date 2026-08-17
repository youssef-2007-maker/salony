import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';

const RANGES = [
  { id: 'month',   label: '30 days' },
  { id: 'quarter', label: '90 days' },
  { id: 'year',    label: '12 mo'   },
];

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BarberAnalyticsScreen({ navigation }) {
  const [range, setRange] = useState('month');
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.analytics(range);
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  if (!data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const { period, trends, upcoming, months, topServices, insights, plan, commissionPct } = data;
  const maxRev = months.reduce((m, x) => Math.max(m, x.revenue), 0) || 1;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.subtitle}>
              {plan === 'free'
                ? 'Free plan — basic view. Upgrade to unlock charts and insights.'
                : `${plan.toUpperCase()} plan · ${Math.round(commissionPct * 100)}% commission`}
            </Text>
          </View>
          <Pressable onPress={() => navigation.navigate('BarberPremium')} style={styles.upgradeBtn}>
            <Ionicons name="diamond" size={14} color="#fff" />
            <Text style={styles.upgradeText}>{plan === 'free' ? 'Upgrade' : 'Manage'}</Text>
          </Pressable>
        </View>

        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setRange(r.id)}
              style={[styles.rangePill, range === r.id && styles.rangePillActive]}
            >
              <Text style={[styles.rangeText, range === r.id && styles.rangeTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.kpiRow}>
          <Kpi label="Revenue" value={`${period.revenue} EGP`} trend={trends.revenuePct} icon="cash" />
          <Kpi label="Bookings" value={period.bookings} trend={trends.bookingsPct} icon="calendar" />
        </View>
        <View style={styles.kpiRow}>
          <Kpi label="Clients" value={period.clients} trend={trends.clientsPct} icon="people" />
          <Kpi label="Retention" value={`${period.retentionPct}%`} icon="repeat" muted />
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Net profit (after commission)</Text>
          <Text style={styles.bigNumber}>{period.netProfit} EGP</Text>
          <Text style={styles.subtle}>
            Gross {period.revenue} EGP − commission {period.commission} EGP
          </Text>
          <View style={styles.divider} />
          <View style={styles.miniRow}>
            <Mini label="Upcoming bookings" value={upcoming.bookings} />
            <Mini label="Pipeline (EGP)" value={upcoming.revenue} />
            <Mini label="Repeat clients" value={period.repeatClients} />
          </View>
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Revenue by month</Text>
          {months.length === 0 ? (
            <Text style={styles.subtle}>No completed bookings yet.</Text>
          ) : (
            <View style={{ marginTop: 12 }}>
              {months.map((m) => {
                const mm = parseInt(m.month.split('-')[1], 10) - 1;
                const label = MONTH_LABELS[mm] || m.month;
                const width = Math.max(2, Math.round((m.revenue / maxRev) * 100));
                return (
                  <View key={m.month} style={styles.barRow}>
                    <Text style={styles.barLabel}>{label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${width}%` }]} />
                    </View>
                    <Text style={styles.barValue}>{m.revenue}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Top services</Text>
          {topServices.length === 0 ? (
            <Text style={styles.subtle}>No services booked in this period.</Text>
          ) : (
            topServices.map((s) => (
              <View key={s.title} style={styles.svcRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.svcTitle}>{s.title}</Text>
                  <Text style={styles.svcMeta}>{s.bookings} bookings</Text>
                </View>
                <Text style={styles.svcRev}>{s.revenue} EGP</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Insights for you</Text>
          {insights.map((line, i) => (
            <View key={i} style={styles.insight}>
              <Ionicons name="bulb" size={16} color={colors.accent} />
              <Text style={styles.insightText}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value, trend, icon, muted }) {
  const trendColor = trend == null ? colors.textMuted : trend >= 0 ? colors.success : colors.danger;
  const trendIcon = trend == null ? null : trend >= 0 ? 'trending-up' : 'trending-down';
  return (
    <View style={[styles.kpi, shadow.card]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.kpiValue}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.kpiLabel}>{label}</Text>
        {trendIcon && !muted && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
            <Ionicons name={trendIcon} size={12} color={trendColor} />
            <Text style={{ color: trendColor, fontSize: 11, marginLeft: 2, fontWeight: '700' }}>
              {trend > 0 ? `+${trend}%` : `${trend}%`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Mini({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  title: { ...typography.display, color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
  },
  upgradeText: { color: '#fff', fontWeight: '700', marginLeft: 4, fontSize: 12 },

  rangeRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  rangePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted, marginRight: 8,
  },
  rangePillActive: { backgroundColor: colors.primary },
  rangeText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  rangeTextActive: { color: '#fff' },

  kpiRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  kpi: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginRight: spacing.sm,
  },
  kpiValue: { ...typography.h1, color: colors.text, marginTop: 6 },
  kpiLabel: { color: colors.textMuted, fontSize: 12 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
  },
  cardTitle: { ...typography.h2, color: colors.text },
  bigNumber: { ...typography.display, color: colors.primary, marginTop: 6 },
  subtle: { color: colors.textMuted, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  miniRow: { flexDirection: 'row' },
  miniValue: { ...typography.h2, color: colors.text },
  miniLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  barLabel: { width: 36, color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  barTrack: {
    flex: 1, height: 10, backgroundColor: colors.surfaceMuted,
    borderRadius: 5, marginHorizontal: 8, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  barValue: { width: 60, textAlign: 'right', color: colors.text, fontWeight: '700', fontSize: 12 },

  svcRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  svcTitle: { color: colors.text, fontWeight: '700' },
  svcMeta: { color: colors.textMuted, fontSize: 12 },
  svcRev: { color: colors.primary, fontWeight: '800' },

  insight: { flexDirection: 'row', marginTop: 8 },
  insightText: { color: colors.text, marginLeft: 8, flex: 1, lineHeight: 18 },
});
