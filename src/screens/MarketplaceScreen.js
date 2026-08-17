import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { api } from '../api/client';
import { useCart } from '../state/CartContext';

const CATEGORIES = ['All', 'Hair', 'Beard', 'Eyes', 'Skin', 'Tools'];

export default function MarketplaceScreen({ navigation }) {
  const { count } = useCart();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.products({ q, category: cat === 'All' ? '' : cat });
      setProducts(data);
    } catch { setProducts([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [q, cat]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.subtitle}>Salon-quality products, delivered</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Cart')} hitSlop={10} style={styles.cartBtn}>
          <Ionicons name="cart" size={22} color={colors.primary} />
          {count > 0 && (
            <View style={styles.cartDot}>
              <Text style={styles.cartDotText}>{count}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pomade, beard oil, lash serum…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>

      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
              <Text numberOfLines={1} style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, shadow.card]}
              onPress={() => navigation.navigate('Product', { productId: item.id })}
            >
              <View style={styles.thumb}>
                <Ionicons name="bag" size={32} color={colors.primary} />
              </View>
              <Text numberOfLines={2} style={styles.name}>{item.title}</Text>
              <Text style={styles.from}>from {item.salon_name}</Text>
              <Text style={styles.price}>{item.price} EGP</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
              No products match that.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  title: { ...typography.display, color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 2 },
  cartBtn: { padding: 10 },
  cartDot: {
    position: 'absolute', top: 2, right: 2, backgroundColor: colors.primary,
    borderRadius: 10, paddingHorizontal: 6, minWidth: 18, alignItems: 'center',
  },
  cartDotText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 },

  chipsRow: { marginTop: spacing.sm },
  chipsContent: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16, height: 36, justifyContent: 'center', borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted, marginRight: 8, flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  card: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md, marginTop: 4,
  },
  thumb: {
    aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  name: { color: colors.text, fontWeight: '700', minHeight: 36 },
  from: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  price: { color: colors.primary, fontWeight: '800', marginTop: 6 },
});
