import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';

export default function BarberStaffScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [pct, setPct] = useState('50');

  const load = useCallback(async () => { try { setList(await api.staff()); } catch { /* */ } }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return Alert.alert('Missing', 'Name required.');
    try {
      await api.addStaff({ name, role, commissionPct: parseFloat(pct) || 50 });
      setName(''); setRole(''); setPct('50');
      load();
    } catch (e) { Alert.alert('Failed', e.message); }
  };

  const remove = (id) => Alert.alert('Remove staff?', '', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { await api.removeStaff(id); load(); } },
  ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Staff</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Add team member</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Name"
            placeholderTextColor={colors.textMuted} style={styles.input} />
          <TextInput value={role} onChangeText={setRole} placeholder="Role (e.g. Senior barber)"
            placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.lbl}>Commission %</Text>
          <TextInput value={pct} onChangeText={setPct} keyboardType="numeric" style={styles.input} />
          <Pressable onPress={add} style={styles.cta}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.ctaText}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Team</Text>
        {list.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No team members yet.</Text>
        ) : list.map((s) => (
          <View key={s.id} style={[styles.staff, shadow.card]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{s.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.staffName}>{s.name} {!s.active && '(inactive)'}</Text>
              <Text style={styles.staffMeta}>{s.role || '—'} · {s.commission_pct}% commission</Text>
            </View>
            {s.active === 1 && (
              <Pressable onPress={() => remove(s.id)} hitSlop={6}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.h1, color: colors.text },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { ...typography.h2, color: colors.text },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10, color: colors.text, marginTop: 8 },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, padding: 10, borderRadius: radius.md, marginTop: spacing.md },
  ctaText: { color: '#fff', fontWeight: '800', marginLeft: 4 },

  section: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: 8 },

  staff: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.md, marginBottom: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  staffName: { color: colors.text, fontWeight: '700' },
  staffMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
