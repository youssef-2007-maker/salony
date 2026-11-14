import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ComingSoon from '../../components/ComingSoon';
import { useFeatures } from '../../state/features';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';

const BOOST_OPTIONS = [3, 7, 14];

function BarberPremiumScreenLive({ navigation }) {
  const [plans, setPlans] = useState([]);
  const [salon, setSalon] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api.plans(), api.mySalon().catch(() => null)]);
      setPlans(p);
      setSalon(s);
    } catch (e) {
      /* */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const subscribe = (plan) => {
    if (Platform.OS === 'ios') { Alert.alert('Manage on the web', 'Plans are managed from your Salony account on salony.app.'); return; }
    Alert.alert(
      'Confirm subscription',
      `Subscribe to ${plan.label} for ${plan.priceMonthly} EGP / month? (Payment is mocked in this build.)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setBusy(true);
            try {
              await api.subscribe(plan.id);
              await load();
              Alert.alert('Subscribed', `Welcome to ${plan.label}.`);
            } catch (e) {
              Alert.alert('Failed', e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const buyBoost = (days) => {
    if (Platform.OS === 'ios') { Alert.alert('Manage on the web', 'Boosts are managed from your Salony account on salony.app.'); return; }
    const amount = days * 50;
    Alert.alert(
      `Boost for ${days} days?`,
      `Cost: ${amount} EGP. Your salon will be pushed to the top of "Recommended near you" for nearby customers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Boost',
          onPress: async () => {
            setBusy(true);
            try {
              await api.boost(days);
              await load();
              Alert.alert('Boosted', `Your salon is boosted for the next ${days} days.`);
            } catch (e) {
              Alert.alert('Failed', e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  if (!plans.length) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Grow your business</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {salon && (
          <View style={[styles.statusCard, shadow.card]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>Current plan</Text>
              <Text style={styles.statusValue}>{(salon.plan || 'free').toUpperCase()}</Text>
              {salon.plan !== 'free' && salon.plan_until && (
                <Text style={styles.statusSub}>
                  Renews {new Date(salon.plan_until).toLocaleDateString()}
                </Text>
              )}
              {salon.boost_until && new Date(salon.boost_until) > new Date() && (
                <Text style={[styles.statusSub, { color: colors.success }]}>
                  Boosted until {new Date(salon.boost_until).toLocaleDateString()}
                </Text>
              )}
              {salon.featured_until && new Date(salon.featured_until) > new Date() && (
                <Text style={[styles.statusSub, { color: colors.primary }]}>
                  Featured until {new Date(salon.featured_until).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}

        <Text style={styles.section}>Plans</Text>
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={salon?.plan === p.id}
            disabled={busy}
            onPress={() => subscribe(p)}
          />
        ))}

        <Text style={styles.section}>Boost on demand</Text>
        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Get to the top of "Recommended"</Text>
          <Text style={styles.cardSub}>
            Boosted salons appear first for nearby customers. 50 EGP per day. Combines with your plan.
          </Text>
          <View style={styles.boostRow}>
            {BOOST_OPTIONS.map((d) => (
              <Pressable
                key={d}
                disabled={busy}
                onPress={() => buyBoost(d)}
                style={[styles.boostBtn, busy && { opacity: 0.5 }]}
              >
                <Ionicons name="rocket" size={16} color="#fff" />
                <Text style={styles.boostText}>{d} days</Text>
                <Text style={styles.boostPrice}>{d * 50} EGP</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.foot}>
          Payments are mocked in this build. In production this connects to Stripe / Paymob and Salony's
          commission is taken from each completed booking (8% Free, 5% Pro, 0% Premium).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({ plan, current, disabled, onPress }) {
  const isFree = plan.id === 'free';
  return (
    <View style={[styles.planCard, current && styles.planCardCurrent, shadow.card]}>
      <View style={styles.planTopRow}>
        <Text style={[styles.planName, current && { color: '#fff' }]}>{plan.label}</Text>
        <View style={styles.planPriceWrap}>
          <Text style={[styles.planPrice, current && { color: '#fff' }]}>
            {isFree ? '0' : plan.priceMonthly}
          </Text>
          <Text style={[styles.planPriceUnit, current && { color: 'rgba(255,255,255,0.85)' }]}>
            {isFree ? 'free' : 'EGP/mo'}
          </Text>
        </View>
      </View>
      <Text style={[styles.planDesc, current && { color: 'rgba(255,255,255,0.9)' }]}>
        {plan.description}
      </Text>
      <View style={styles.featList}>
        <Feature label="Standard listing" on current={current} />
        <Feature label="Verified badge" on={plan.verified} current={current} />
        <Feature label="Business analytics" on={plan.id !== 'free'} current={current} />
        <Feature label={`${plan.boostDays} days of boost / month`} on={plan.boostDays > 0} current={current} />
        <Feature label="Featured this week slot" on={plan.featured} current={current} />
      </View>
      <Pressable
        disabled={disabled || current}
        onPress={onPress}
        style={[
          styles.planBtn,
          current && { backgroundColor: 'rgba(255,255,255,0.2)' },
          disabled && { opacity: 0.6 },
        ]}
      >
        <Text style={[styles.planBtnText, current && { color: '#fff' }]}>
          {current ? 'Current plan' : isFree ? 'Switch to Free' : `Subscribe — ${plan.priceMonthly} EGP/mo`}
        </Text>
      </Pressable>
    </View>
  );
}

function Feature({ label, on, current }) {
  const tint = current ? '#fff' : on ? colors.success : colors.textMuted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
      <Ionicons name={on ? 'checkmark-circle' : 'close-circle'} size={16} color={tint} />
      <Text style={{ color: current ? '#fff' : on ? colors.text : colors.textMuted, marginLeft: 6 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },

  statusCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg,
  },
  statusLabel: { color: colors.textMuted, fontSize: 12 },
  statusValue: { ...typography.h1, color: colors.primary, marginTop: 2 },
  statusSub: { color: colors.textMuted, marginTop: 4, fontSize: 12 },

  section: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },

  planCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md,
  },
  planCardCurrent: { backgroundColor: colors.primary },
  planTopRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  planName: { ...typography.h1, color: colors.text },
  planPriceWrap: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { ...typography.h1, color: colors.text },
  planPriceUnit: { color: colors.textMuted, marginLeft: 4, fontSize: 12 },
  planDesc: { color: colors.textMuted, marginTop: 6 },
  featList: { marginTop: spacing.md },
  planBtn: {
    marginTop: spacing.md, backgroundColor: colors.primary,
    paddingVertical: 12, borderRadius: radius.md, alignItems: 'center',
  },
  planBtnText: { color: '#fff', fontWeight: '800' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.h2, color: colors.text },
  cardSub: { color: colors.textMuted, marginTop: 4 },
  boostRow: { flexDirection: 'row', marginTop: spacing.md },
  boostBtn: {
    flex: 1, alignItems: 'center', backgroundColor: colors.primary,
    paddingVertical: 12, borderRadius: radius.md, marginRight: 8,
  },
  boostText: { color: '#fff', fontWeight: '700', marginTop: 4 },
  boostPrice: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },

  foot: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, lineHeight: 16 },
});

// Shown as "Coming soon" until the feature is switched on at the backend.
export default function BarberPremiumScreen(props) {
  const features = useFeatures();
  if (!features.subscriptions) {
    return (
      <ComingSoon
        icon="rocket"
        title="Premium & Boost"
        message="Premium plans and boosts to get your salon in front of more customers are launching soon."
        onBack={() => props.navigation.goBack()}
      />
    );
  }
  return <BarberPremiumScreenLive {...props} />;
}
