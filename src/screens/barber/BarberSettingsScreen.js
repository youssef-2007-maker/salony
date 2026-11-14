import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';
import { useFeatures } from '../../state/features';

export default function BarberSettingsScreen({ navigation }) {
  const [salon, setSalon] = useState(null);
  // Deposits need in-app payments, so the option is hidden until they're live.
  const { payments: paymentsLive } = useFeatures();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSalon(await api.mySalon()); } catch { setSalon(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = (k, v) => setSalon((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.updateSettings({
        pointsRate: parseFloat(salon.points_rate),
        redeemValue: parseFloat(salon.redeem_value),
        depositRequired: !!salon.deposit_required,
        depositPct: parseFloat(salon.deposit_pct),
        offersAtHome: !!salon.offers_at_home,
        atHomeFee: parseFloat(salon.at_home_fee),
        handle: salon.handle || null,
      });
      Alert.alert('Saved', 'Settings updated.');
    } catch (e) { Alert.alert('Failed', e.message); }
    finally { setBusy(false); }
  };

  if (!salon) return (
    <SafeAreaView style={styles.root}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Salon settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Section title="Loyalty">
          <Text style={styles.lbl}>Points earned per EGP (e.g. 0.05 = 5%)</Text>
          <TextInput value={String(salon.points_rate)} onChangeText={(v) => update('points_rate', v)}
            keyboardType="decimal-pad" style={styles.input} />
          <Text style={styles.lbl}>EGP value per point when redeemed</Text>
          <TextInput value={String(salon.redeem_value)} onChangeText={(v) => update('redeem_value', v)}
            keyboardType="decimal-pad" style={styles.input} />
          <Text style={styles.hint}>
            Customers earn {Math.round(salon.points_rate * 100)}% of every booking back as points and can redeem at {salon.redeem_value} EGP per point (up to 50% of price).
          </Text>
        </Section>

        {paymentsLive ? (
        <Section title="No-show protection">
          <View style={styles.row}>
            <Text style={{ flex: 1, color: colors.text }}>Require deposit at booking</Text>
            <Switch value={!!salon.deposit_required}
              onValueChange={(v) => update('deposit_required', v ? 1 : 0)}
              trackColor={{ true: colors.primary, false: colors.disabled }} thumbColor="#fff" />
          </View>
          {salon.deposit_required ? (
            <>
              <Text style={styles.lbl}>Deposit % (e.g. 0.25 = 25%)</Text>
              <TextInput value={String(salon.deposit_pct)} onChangeText={(v) => update('deposit_pct', v)}
                keyboardType="decimal-pad" style={styles.input} />
              <Text style={styles.hint}>
                If a customer no-shows or cancels &lt; 24h, you keep the deposit. Otherwise it's refunded.
              </Text>
            </>
          ) : null}
        </Section>
        ) : null}

        <Section title="At-home service">
          <View style={styles.row}>
            <Text style={{ flex: 1, color: colors.text }}>Offer at-home service</Text>
            <Switch value={!!salon.offers_at_home}
              onValueChange={(v) => update('offers_at_home', v ? 1 : 0)}
              trackColor={{ true: colors.primary, false: colors.disabled }} thumbColor="#fff" />
          </View>
          {salon.offers_at_home ? (
            <>
              <Text style={styles.lbl}>Extra fee for at-home (EGP)</Text>
              <TextInput value={String(salon.at_home_fee)} onChangeText={(v) => update('at_home_fee', v)}
                keyboardType="numeric" style={styles.input} />
            </>
          ) : null}
        </Section>

        <Section title="Mini-site handle">
          <Text style={styles.lbl}>Your public page: salony.app/&lt;handle&gt;</Text>
          <TextInput value={salon.handle || ''} onChangeText={(v) => update('handle', v.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            placeholder="e.g. thebarbershop"
            placeholderTextColor={colors.textMuted} style={styles.input} />
          {salon.handle && (
            <Pressable onPress={() => navigation.navigate('BarberMiniSite')} style={styles.linkRow}>
              <Text style={styles.linkText}>Preview my mini-site →</Text>
            </Pressable>
          )}
        </Section>

        <Pressable onPress={save} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save settings</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={[styles.card, shadow.card]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.h1, color: colors.text },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { ...typography.h2, color: colors.text },

  lbl: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10, color: colors.text, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 16 },
  linkRow: { marginTop: 8 },
  linkText: { color: colors.primary, fontWeight: '700' },

  saveBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
