import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ComingSoon from '../components/ComingSoon';
import { useFeatures } from '../state/features';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { api } from '../api/client';
import { useLoyalty } from '../state/LoyaltyContext';

const PERKS = [
  { icon: 'cut', label: '1 free haircut every month' },
  { icon: 'pricetag', label: '15% off every booking' },
  { icon: 'flash', label: 'Priority booking on busy days' },
  { icon: 'rocket', label: 'Free delivery on Marketplace orders' },
  { icon: 'medal', label: '2× points on every booking' },
];

function PlusSubscriptionScreenLive({ navigation }) {
  const { subscription, refresh } = useLoyalty();
  const [busy, setBusy] = useState(false);

  const subscribe = () => {
    Alert.alert(
      'Join Salony Plus',
      '99 EGP / month for unlimited monthly perks. (Payment is mocked in this build.)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setBusy(true);
            try {
              await api.subscribePlus();
              await refresh();
              Alert.alert('Welcome to Plus', 'Your free monthly cut is ready to use on your next booking.');
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

  const cancel = () =>
    Alert.alert('Cancel Plus?', 'You can rejoin any time.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          await api.unsubscribePlus();
          await refresh();
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Salony Plus</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.hero, shadow.card]}>
          <Ionicons name="diamond" size={36} color="#fff" />
          <Text style={styles.heroTitle}>Save with every cut.</Text>
          <Text style={styles.heroSub}>One subscription, monthly perks across every Salony salon.</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceNum}>99</Text>
            <Text style={styles.priceUnit}>EGP / month</Text>
          </View>
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>What you get</Text>
          {PERKS.map((p) => (
            <View key={p.label} style={styles.perkRow}>
              <Ionicons name={p.icon} size={18} color={colors.primary} />
              <Text style={styles.perkText}>{p.label}</Text>
            </View>
          ))}
        </View>

        {subscription?.active ? (
          <View style={[styles.activeCard, shadow.card]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.activeTitle}>You're on Plus</Text>
            <Text style={styles.activeSub}>
              Renews {subscription.until ? new Date(subscription.until).toLocaleDateString() : '—'}
            </Text>
            <Text style={styles.activeSub}>
              Free cuts available: {subscription.freeCuts}
            </Text>
            <Pressable onPress={cancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel subscription</Text>
            </Pressable>
          </View>
        ) : Platform.OS === 'ios' ? (
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.perkText}>
              Salony Plus is managed from your account on salony.app. Once you're a member,
              your perks apply here automatically.
            </Text>
          </View>
        ) : (
          <Pressable onPress={subscribe} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Subscribe — 99 EGP/mo</Text>}
          </Pressable>
        )}

        <Text style={styles.foot}>
          One free cut credit per month, automatically applied at checkout. Cancel any time.
          Payments are mocked in this build.
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

  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: spacing.md },
  heroSub: { color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.md },
  priceNum: { color: '#fff', fontSize: 48, fontWeight: '900' },
  priceUnit: { color: 'rgba(255,255,255,0.9)', marginLeft: 6 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  cardTitle: { ...typography.h2, color: colors.text, marginBottom: 6 },
  perkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  perkText: { marginLeft: 8, color: colors.text },

  cta: {
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  activeCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  activeTitle: { ...typography.h1, color: colors.text, marginTop: 8 },
  activeSub: { color: colors.textMuted, marginTop: 4 },
  cancelBtn: { marginTop: spacing.md },
  cancelText: { color: colors.danger, fontWeight: '700' },

  foot: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, lineHeight: 18 },
});

// Shown as "Coming soon" until the feature is switched on at the backend.
export default function PlusSubscriptionScreen(props) {
  const features = useFeatures();
  if (!features.subscriptions) {
    return (
      <ComingSoon
        icon="star"
        title="Salony Plus"
        message="Monthly perks and discounts on every booking. Launching soon."
        onBack={() => props.navigation.goBack()}
      />
    );
  }
  return <PlusSubscriptionScreenLive {...props} />;
}
