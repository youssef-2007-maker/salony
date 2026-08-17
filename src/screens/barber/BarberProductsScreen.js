import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';

export default function BarberProductsScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', price: '', stock: '10', category: 'Hair' });

  const load = useCallback(async () => { try { setList(await api.myProducts()); } catch { /* */ } }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.title.trim() || !form.price) return Alert.alert('Missing', 'Title and price required.');
    const id = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now();
    try {
      await api.addProduct({
        id, title: form.title, description: form.description, category: form.category,
        price: parseFloat(form.price), stock: parseInt(form.stock || '0', 10),
      });
      setForm({ title: '', description: '', price: '', stock: '10', category: 'Hair' });
      load();
    } catch (e) { Alert.alert('Failed', e.message); }
  };

  const remove = (id) => Alert.alert('Delete product?', '', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.removeProduct(id); load(); } },
  ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>My products</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Add product</Text>
          <Text style={styles.cardSub}>Salony takes 15% commission per sale.</Text>
          <TextInput value={form.title} onChangeText={(v) => setForm({ ...form, title: v })}
            placeholder="Title" placeholderTextColor={colors.textMuted} style={styles.input} />
          <TextInput value={form.description} onChangeText={(v) => setForm({ ...form, description: v })}
            placeholder="Description" placeholderTextColor={colors.textMuted} multiline style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lbl}>Price (EGP)</Text>
              <TextInput value={form.price} onChangeText={(v) => setForm({ ...form, price: v })}
                keyboardType="numeric" style={styles.input} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lbl}>Stock</Text>
              <TextInput value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v })}
                keyboardType="numeric" style={styles.input} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lbl}>Category</Text>
              <TextInput value={form.category} onChangeText={(v) => setForm({ ...form, category: v })}
                style={styles.input} />
            </View>
          </View>
          <Pressable onPress={add} style={styles.cta}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.ctaText}>Add product</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Listings</Text>
        {list.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No products yet.</Text>
        ) : list.map((p) => (
          <View key={p.id} style={[styles.product, shadow.card]}>
            <View style={styles.thumb}><Ionicons name="bag" size={20} color={colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.prodTitle}>{p.title}</Text>
              <Text style={styles.prodMeta}>{p.stock} in stock · {p.category}</Text>
            </View>
            <Text style={styles.prodPrice}>{p.price} EGP</Text>
            <Pressable onPress={() => remove(p.id)} hitSlop={6} style={{ marginLeft: 8 }}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
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
  cardSub: { color: colors.textMuted, marginTop: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10, color: colors.text, marginTop: 8 },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, padding: 10, borderRadius: radius.md, marginTop: spacing.md },
  ctaText: { color: '#fff', fontWeight: '800', marginLeft: 4 },

  section: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: 8 },

  product: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.md, marginBottom: 6 },
  thumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center' },
  prodTitle: { color: colors.text, fontWeight: '700' },
  prodMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  prodPrice: { color: colors.primary, fontWeight: '800' },
});
