import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';
import { useLocation } from '../../state/LocationContext';
import { api } from '../../api/client';

export default function BarberProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { label, refresh: refreshLoc } = useLocation();
  const [salon, setSalon] = useState(undefined);

  const load = useCallback(async () => {
    try { setSalon(await api.mySalon()); } catch { setSalon(null); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const initial = (user?.name || 'B').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>BARBER</Text></View>
        </View>

        {salon === undefined ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : salon === null ? (
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.cardTitle}>No salon yet</Text>
            <Text style={styles.cardSub}>Create your salon to start receiving bookings.</Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('BarberSalonEdit', { mode: 'create' })}
            >
              <Text style={styles.primaryBtnText}>Create my salon</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.card, shadow.card]}>
              <View style={styles.row}><Ionicons name="storefront" size={18} color={colors.primary} /><Text style={styles.rowText}>{salon.name}</Text></View>
              <View style={styles.row}><Ionicons name="pricetag" size={18} color={colors.primary} /><Text style={styles.rowText}>{salon.category}</Text></View>
              <View style={styles.row}><Ionicons name="location" size={18} color={colors.primary} /><Text style={styles.rowText}>{salon.address}</Text></View>
              <View style={styles.row}><Ionicons name="time" size={18} color={colors.primary} /><Text style={styles.rowText}>{salon.hours || '—'}</Text></View>

              <Pressable
                onPress={() => navigation.navigate('BarberSalonEdit', { mode: 'edit' })}
                style={[styles.primaryBtn, { marginTop: spacing.md }]}
              >
                <Text style={styles.primaryBtnText}>Edit salon details</Text>
              </Pressable>
            </View>

            <View style={[styles.card, shadow.card]}>
              <Text style={styles.cardTitle}>Services</Text>
              {(salon.services || []).length === 0 ? (
                <Text style={styles.cardSub}>No services yet. Add some from the editor.</Text>
              ) : (
                (salon.services || []).map((s) => (
                  <View key={s.id} style={styles.svcRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.svcTitle}>{s.title}</Text>
                      <Text style={styles.svcMeta}>{s.duration} · {s.details}</Text>
                    </View>
                    <Text style={styles.svcPrice}>{s.price} EGP</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Quick links</Text>
          <QuickLink icon="people" label="My customers (CRM)" onPress={() => navigation.navigate('BarberCRM')} />
          <QuickLink icon="flame" label="Flash deals" onPress={() => navigation.navigate('BarberDeals')} />
          <QuickLink icon="bag" label="Products" onPress={() => navigation.navigate('BarberProducts')} />
          <QuickLink icon="sparkles" label="AI marketing assistant" onPress={() => navigation.navigate('BarberAIMarketing')} />
          <QuickLink icon="document-text" label="Tax / income" onPress={() => navigation.navigate('BarberTax')} />
          <QuickLink icon="people-circle" label="Staff" onPress={() => navigation.navigate('BarberStaff')} />
          <QuickLink icon="globe" label="My mini-site" onPress={() => navigation.navigate('BarberMiniSite')} />
          <QuickLink icon="settings" label="Salon settings (loyalty, deposits, at-home)" onPress={() => navigation.navigate('BarberSettings')} />
          <QuickLink icon="diamond" label="Grow / Premium / Boost" onPress={() => navigation.navigate('BarberPremium')} />
        </View>

        <Pressable style={styles.locBtn} onPress={refreshLoc}>
          <Ionicons name="locate" size={16} color={colors.primary} />
          <Text style={styles.locBtnText}>Device location: {label}</Text>
        </Pressable>

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

function QuickLink({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={qlStyles.row}>
      <View style={qlStyles.iconBubble}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={qlStyles.label} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const qlStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  label: { color: colors.text, fontWeight: '600', flex: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', padding: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { ...typography.h1, color: colors.text },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  roleBadge: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.primary, borderRadius: radius.pill,
  },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  cardTitle: { ...typography.h2, color: colors.text },
  cardSub: { color: colors.textMuted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rowText: { marginLeft: 8, color: colors.text },

  svcRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  svcTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  svcMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  svcPrice: { color: colors.primary, fontWeight: '800' },

  primaryBtn: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  locBtnText: { color: colors.primary, fontWeight: '700', marginLeft: 6 },

  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginTop: spacing.md },
  signOutText: { color: colors.danger, marginLeft: 6, fontWeight: '700' },
});
