import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { api } from '../api/client';
import { useCart } from '../state/CartContext';

export default function ProductScreen({ route, navigation }) {
  const { productId } = route.params;
  const { add, salonId } = useCart();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    (async () => {
      try { setProduct(await api.product(productId)); } catch { /* */ }
    })();
  }, [productId]);

  if (!product) {
    return <SafeAreaView style={styles.root}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></SafeAreaView>;
  }

  const conflict = salonId && salonId !== product.salon_id;

  const onAdd = () => {
    if (conflict) {
      Alert.alert(
        'Different salon',
        'Your cart has products from another salon. Empty your cart first or check out separately.',
      );
      return;
    }
    add(product, 1);
    Alert.alert('Added to cart', `${product.title} added.`, [
      { text: 'Keep shopping', style: 'cancel' },
      { text: 'View cart', onPress: () => navigation.navigate('Cart') },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.thumb}>
          <Ionicons name="bag" size={72} color={colors.primary} />
        </View>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.name}>{product.title}</Text>
          <Text style={styles.from}>Sold by {product.salon_name}</Text>
          <Text style={styles.price}>{product.price} EGP</Text>
          <Text style={styles.section}>About</Text>
          <Text style={styles.body}>{product.description || 'No description.'}</Text>
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.cardTitle}>Pickup or delivery</Text>
            <Text style={styles.cardSub}>
              Order is fulfilled by the salon. They'll either deliver locally or hand it to you at your
              next booking — your choice on the order screen.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footPrice}>{product.price} EGP</Text>
          <Text style={styles.footSub}>{product.stock} in stock</Text>
        </View>
        <Pressable onPress={onAdd} style={[styles.cta, conflict && { backgroundColor: colors.textMuted }]}>
          <Ionicons name="cart" size={16} color="#fff" />
          <Text style={styles.ctaText}>{conflict ? 'Cart from another salon' : 'Add to cart'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  thumb: { height: 220, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.h1, color: colors.text },
  from: { color: colors.textMuted, marginTop: 2 },
  price: { ...typography.display, color: colors.primary, marginTop: spacing.sm },
  section: { ...typography.h2, color: colors.text, marginTop: spacing.lg },
  body: { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  card: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 18 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footPrice: { ...typography.h1, color: colors.text },
  footSub: { color: colors.textMuted, fontSize: 12 },
  cta: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.md,
  },
  ctaText: { color: '#fff', fontWeight: '800', marginLeft: 6 },
});
