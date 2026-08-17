import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';

export default function BarberDealsScreen({ navigation }) {
  const [deals, setDeals] = useState([]);
  const [title, setTitle] = useState('');
  const [pct, setPct] = useState('15');
  const [days, setDays] = useState('3');

  const load = useCallback(async () => { try { setDeals(await api.myDeals()); } catch { /* */ } }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!title.trim() || !pct) return Alert.alert('Missing', 'Title and discount required.');
    const endsAt = new Date(Date.now() + parseInt(days, 10) * 86400 * 1000).toISOString();
    try {
      await api.addDeal({ title, pct: parseInt(pct, 10), endsAt });
      setTitle(''); setPct('15'); setDays('3');
      load();
    } catch (e) { Alert.alert('Failed', e.message); }
  };

  const end = (id) => Alert.alert('End deal?', '', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'End', style: 'destructive', onPress: async () => { await api.removeDeal(id); load(); } },
  ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Flash deals</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>New deal</Text>
          <Text style={styles.cardSub}>Fill empty chairs by discounting slow hours.</Text>
          <TextInput value={title} onChangeText={setTitle}
            placeholder='e.g. "Tue/Wed 2–5pm — 20% off cuts"'
            placeholderTextColor={colors.textMuted} style={styles.input} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lbl}>% off</Text>
              <TextInput value={pct} onChangeText={setPct} keyboardType="numeric" style={styles.input} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lbl}>Days</Text>
              <TextInput value={days} onChangeText={setDays} keyboardType="numeric" style={styles.input} />
            </View>
          </View>
          <Pressable onPress={create} style={styles.cta}>
            <Text style={styles.ctaText}>Publish deal</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Current & past deals</Text>
        {deals.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No deals yet.</Text>
        ) : deals.map((d) => {
          const live = d.active && new Date(d.ends_at) > new Date() && new Date(d.starts_at) <= new Date();
          return (
            <View key={d.id} style={[styles.deal, shadow.card]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dealTitle}>{d.title}</Text>
                <Text style={styles.dealMeta}>
                  {d.pct}% off · ends {new Date(d.ends_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: live ? colors.success : colors.textMuted }]}>
                <Text style={styles.badgeText}>{live ? 'LIVE' : 'ENDED'}</Text>
              </View>
              {live && (
                <Pressable onPress={() => end(d.id)} hitSlop={6} style={{ marginLeft: 8 }}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.h1, color: colors.text },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  cardTitle: { ...typography.h2, color: colors.text },
  cardSub: { color: colors.textMuted, marginTop: 4 },
  lbl: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10, color: colors.text, marginTop: 8 },
  cta: { backgroundColor: colors.primary, padding: 12, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  ctaText: { color: '#fff', fontWeight: '800' },

  section: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: 8 },

  deal: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.md, marginBottom: 6 },
  dealTitle: { color: colors.text, fontWeight: '700' },
  dealMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 10 },
});
