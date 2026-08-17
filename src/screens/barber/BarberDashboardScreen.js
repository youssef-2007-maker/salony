import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';
import { useBookings } from '../../state/BookingsContext';
import { useLocation } from '../../state/LocationContext';
import { api } from '../../api/client';

export default function BarberDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { upcoming, past, bookings, updateStatus, refresh, loading } = useBookings();
  const { coords, label, refresh: refreshLoc } = useLocation();
  const [salon, setSalon] = useState(undefined); // undefined = loading
  const [refreshing, setRefreshing] = useState(false);

  const loadSalon = useCallback(async () => {
    try {
      const data = await api.mySalon();
      setSalon(data);
    } catch {
      setSalon(null);
    }
  }, []);

  useEffect(() => { loadSalon(); }, [loadSalon]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSalon(), refresh()]);
    setRefreshing(false);
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const todays = useMemo(
    () => upcoming.filter((b) => b.date === todayIso),
    [upcoming, todayIso]
  );

  const revenueToday = todays.reduce((sum, b) => sum + (b.price || 0), 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hi {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.subhello}>Here's your day at a glance.</Text>
          </View>
        </View>

        {salon === undefined ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : salon === null ? (
          <View style={[styles.card, shadow.card, { marginHorizontal: spacing.lg }]}>
            <Text style={styles.cardTitle}>You don't have a salon yet</Text>
            <Text style={styles.cardSub}>Add your salon so customers can book you.</Text>
            <Pressable
              onPress={() => navigation.navigate('BarberSalonEdit', { mode: 'create' })}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Create my salon</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Stat label="Today" value={todays.length} icon="calendar" />
              <Stat label="Upcoming" value={upcoming.length} icon="time" />
              <Stat label="EGP today" value={revenueToday} icon="cash" />
            </View>

            <View style={styles.toolGrid}>
              <Tool icon="people" label="My customers" onPress={() => navigation.navigate('BarberCRM')} />
              <Tool icon="flame" label="Flash deals" onPress={() => navigation.navigate('BarberDeals')} />
              <Tool icon="sparkles" label="AI marketing" onPress={() => navigation.navigate('BarberAIMarketing')} />
              <Tool icon="globe" label="Mini-site" onPress={() => navigation.navigate('BarberMiniSite')} />
              <Tool icon="bag" label="Products" onPress={() => navigation.navigate('BarberProducts')} />
              <Tool icon="people-circle" label="Staff" onPress={() => navigation.navigate('BarberStaff')} />
              <Tool icon="document-text" label="Tax / income" onPress={() => navigation.navigate('BarberTax')} />
              <Tool icon="settings" label="Settings" onPress={() => navigation.navigate('BarberSettings')} />
            </View>

            <View style={[styles.promoCard, shadow.card]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>
                  {salon.plan === 'premium' || salon.plan === 'pro'
                    ? `You're on ${salon.plan.toUpperCase()}`
                    : 'Grow faster with Premium'}
                </Text>
                <Text style={styles.promoSub}>
                  {salon.boost_until && new Date(salon.boost_until) > new Date()
                    ? `Boosted until ${new Date(salon.boost_until).toLocaleDateString()}`
                    : 'Boost your salon to the top of "Recommended near you" from 150 EGP.'}
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('BarberPremium')}
                style={styles.promoBtn}
              >
                <Ionicons name="diamond" size={14} color="#fff" />
                <Text style={styles.promoBtnText}>
                  {salon.plan === 'premium' ? 'Boost' : 'Upgrade'}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.card, shadow.card]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{salon.name}</Text>
                  <Text style={styles.cardSub}>{salon.category} · {salon.address}</Text>
                </View>
                <Pressable onPress={() => navigation.navigate('BarberSalonEdit', { mode: 'edit' })}>
                  <Ionicons name="create-outline" size={22} color={colors.primary} />
                </Pressable>
              </View>
              <Pressable
                onPress={() => navigation.navigate('LocationPicker')}
                style={styles.locRow}
              >
                <Ionicons name="location" size={14} color={colors.primary} />
                <Text style={styles.locText}>
                  Picked location: {label} (tap to change)
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    await api.updateSalon({ lat: coords.lat, lng: coords.lng });
                    Alert.alert('Updated', 'Salon location set to your current device location.');
                    loadSalon();
                  } catch (e) {
                    Alert.alert('Failed', e.message);
                  }
                }}
                style={styles.linkBtn}
              >
                <Text style={styles.linkBtnText}>Use my current location as the salon's pin</Text>
              </Pressable>
            </View>

            <Text style={styles.section}>Today's bookings</Text>
            {todays.length === 0 ? (
              <Text style={styles.emptyText}>Nothing on the calendar today.</Text>
            ) : (
              todays.map((b) => (
                <BookingItem key={b.id} b={b} updateStatus={updateStatus} />
              ))
            )}

            <Text style={styles.section}>Next up</Text>
            {upcoming.filter((b) => b.date !== todayIso).slice(0, 5).map((b) => (
              <BookingItem key={b.id} b={b} updateStatus={updateStatus} />
            ))}
            {upcoming.filter((b) => b.date !== todayIso).length === 0 && (
              <Text style={styles.emptyText}>No future bookings yet.</Text>
            )}
          </>
        )}

        <Pressable
          style={styles.signOut}
          onPress={() => Alert.alert('Sign out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: signOut },
          ])}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tool({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tool, shadow.card]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.toolLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, icon }) {
  return (
    <View style={[styles.stat, shadow.card]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BookingItem({ b, updateStatus }) {
  return (
    <View style={[styles.bk, shadow.card]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.bkTitle}>{b.serviceTitle}</Text>
        <Text style={styles.bkSub}>
          {b.customerName || 'Customer'} · {b.date} at {b.time}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.bkPrice}>{b.price} EGP</Text>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <Pressable
            onPress={() =>
              Alert.alert('Mark complete', 'Mark this booking as done?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Done', onPress: () => updateStatus(b.id, 'past') },
              ])
            }
            style={[styles.actionBtn, { borderColor: colors.success }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Done</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert('Decline?', 'Notify the customer this slot is unavailable?', [
                { text: 'Keep', style: 'cancel' },
                { text: 'Decline', style: 'destructive', onPress: () => updateStatus(b.id, 'declined') },
              ])
            }
            style={[styles.actionBtn, { borderColor: colors.danger, marginLeft: 6 }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.danger }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  hello: { ...typography.display, color: colors.text },
  subhello: { color: colors.textMuted, marginTop: 4 },

  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  stat: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginRight: spacing.sm, alignItems: 'flex-start',
  },
  statValue: { ...typography.h1, color: colors.text, marginTop: 4 },
  statLabel: { color: colors.textMuted, fontSize: 12 },

  toolGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  tool: {
    width: '23%', aspectRatio: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginRight: '2.5%', marginBottom: spacing.sm,
    padding: 6,
  },
  toolLabel: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { ...typography.h1, color: colors.text },
  cardSub: { color: colors.textMuted, marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  locText: { color: colors.textMuted, marginLeft: 6, fontSize: 12 },
  linkBtn: { marginTop: spacing.sm },
  linkBtnText: { color: colors.primary, fontWeight: '700' },

  primaryBtn: {
    marginTop: spacing.md, backgroundColor: colors.primary,
    paddingVertical: 12, borderRadius: radius.md, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  promoCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  promoTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  promoSub: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 12 },
  promoBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.pill, marginLeft: spacing.md,
  },
  promoBtnText: { color: '#fff', fontWeight: '800', marginLeft: 4 },

  section: { ...typography.h2, color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: 8 },
  emptyText: { color: colors.textMuted, paddingHorizontal: spacing.lg },

  bk: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: 8, alignItems: 'center',
  },
  bkTitle: { ...typography.h2, color: colors.text },
  bkSub: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  bkPrice: { ...typography.h2, color: colors.primary },
  actionBtn: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  actionBtnText: { fontWeight: '700', fontSize: 12 },

  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginTop: spacing.md },
  signOutText: { color: colors.danger, marginLeft: 6, fontWeight: '700' },
});
