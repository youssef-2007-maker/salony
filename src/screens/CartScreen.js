import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { useCart } from '../state/CartContext';
import { api } from '../api/client';

export default function CartScreen({ navigation }) {
  const { items, total, count, update, remove, clear } = useCart();
  const [busy, setBusy] = useState(false);

  const checkout = async () => {
    setBusy(true);
    try {
      const payload = items.map((it) => ({ productId: it.product.id, qty: it.qty }));
      const res = await api.placeOrder(payload);
      clear();
      Alert.alert('Order placed', `Order #${res.orderId} for ${res.total} EGP. The salon will confirm shortly.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Cart ({count})</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.product.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Your cart is empty.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, shadow.card]}>
            <View style={styles.thumb}>
              <Ionicons name="bag" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.name}>{item.product.title}</Text>
              <Text style={styles.from}>{item.product.salon_name}</Text>
              <Text style={styles.price}>{item.product.price} EGP</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={styles.qty}>
                <Pressable onPress={() => update(item.product.id, item.qty - 1)} hitSlop={6}>
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <Pressable onPress={() => update(item.product.id, item.qty + 1)} hitSlop={6}>
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
              </View>
              <Pressable onPress={() => remove(item.product.id)} hitSlop={6} style={{ marginTop: 6 }}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={styles.footer}>
          <View>
            <Text style={styles.footLabel}>Total</Text>
            <Text style={styles.footTotal}>{total} EGP</Text>
          </View>
          <Pressable onPress={checkout} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Pay & order</Text>}
          </Pressable>
        </View>
      )}
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

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontWeight: '700' },
  from: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.primary, fontWeight: '800', marginTop: 6 },

  qty: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  qtyText: { marginHorizontal: 8, color: colors.text, fontWeight: '800' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footLabel: { color: colors.textMuted, fontSize: 12 },
  footTotal: { ...typography.h1, color: colors.text },
  cta: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: radius.md },
  ctaText: { color: '#fff', fontWeight: '800' },
});
