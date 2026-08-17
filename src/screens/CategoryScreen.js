import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/colors';
import { findCategory } from '../data/salons';
import SalonCard from '../components/SalonCard';
import { api } from '../api/client';
import { useLocation } from '../state/LocationContext';

export default function CategoryScreen({ route, navigation }) {
  const { categoryId } = route.params;
  const category = findCategory(categoryId);
  const { coords } = useLocation();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.listSalons({ lat: coords?.lat, lng: coords?.lng });
        if (!cancelled) setAll(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords?.lat, coords?.lng]);

  const list = useMemo(() => {
    if (!category) return all;
    const wanted = new Set((category.match || []).map((s) => s.toLowerCase()));
    return all.filter(
      (s) =>
        wanted.has(s.category.toLowerCase()) ||
        (s.tags || []).some((t) => wanted.has(String(t).toLowerCase()))
    );
  }, [category, all]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{category?.label ?? 'Category'}</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <SalonCard
              wide
              salon={item}
              onPress={() => navigation.navigate('SalonDetail', { salonId: item.id })}
            />
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
              No salons in this category yet.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },
});
