import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';

export default function BarberCustomerScreen({ route, navigation }) {
  const { customerId } = route.params;
  const [data, setData] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.crmCustomer(customerId)); } catch { /* */ }
  }, [customerId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api.addCrmNote({ customerId, note: note.trim() });
      setNote('');
      load();
    } catch (e) { Alert.alert('Failed', e.message); }
    finally { setBusy(false); }
  };

  const del = (id) =>
    Alert.alert('Delete note?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.removeCrmNote(id); load(); } },
    ]);

  if (!data) return (
    <SafeAreaView style={styles.root}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{data.customer.name}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={[styles.card, shadow.card]}>
          <Row icon="mail" label={data.customer.email} />
          {data.customer.phone && <Row icon="call" label={data.customer.phone} />}
        </View>

        <Text style={styles.section}>Visit history</Text>
        {data.bookings.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No visits.</Text>
        ) : data.bookings.map((b) => (
          <View key={b.id} style={[styles.bk, shadow.card]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bkTitle}>{b.service_title}</Text>
              <Text style={styles.bkMeta}>{b.date} · {b.time} · {b.barber_name}</Text>
            </View>
            <Text style={styles.bkPrice}>{b.price} EGP</Text>
          </View>
        ))}

        <Text style={styles.section}>Notes</Text>
        <View style={[styles.card, shadow.card]}>
          <TextInput
            value={note} onChangeText={setNote}
            placeholder='e.g. "Prefers fade 2 sides, 3 top. Hates trimmer on neck."'
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
          />
          <Pressable onPress={add} disabled={busy || !note.trim()} style={[styles.addBtn, (!note.trim() || busy) && { opacity: 0.5 }]}>
            <Text style={styles.addBtnText}>Save note</Text>
          </Pressable>
        </View>
        {data.notes.map((n) => (
          <View key={n.id} style={[styles.note, shadow.card]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.noteText}>{n.note}</Text>
              <Text style={styles.noteDate}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            <Pressable onPress={() => del(n.id)} hitSlop={6}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={{ marginLeft: 8, color: colors.text }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.h1, color: colors.text },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  section: { ...typography.h2, color: colors.text, marginTop: spacing.md, marginBottom: 8 },

  bk: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.md, marginBottom: 6 },
  bkTitle: { color: colors.text, fontWeight: '700' },
  bkMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bkPrice: { color: colors.primary, fontWeight: '800' },

  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10, color: colors.text, minHeight: 80, textAlignVertical: 'top' },
  addBtn: { backgroundColor: colors.primary, padding: 10, borderRadius: radius.sm, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#fff', fontWeight: '800' },
  note: { flexDirection: 'row', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, marginBottom: 6 },
  noteText: { color: colors.text },
  noteDate: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
