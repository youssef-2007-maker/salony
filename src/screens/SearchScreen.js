import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/colors';
import { categories } from '../data/salons';
import SalonCard from '../components/SalonCard';
import { api } from '../api/client';
import { useLocation } from '../state/LocationContext';

export default function SearchScreen({ navigation }) {
  const { coords } = useLocation();
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await api.listSalons({ q, lat: coords?.lat, lng: coords?.lng });
        if (!cancelled) setAll(data);
      } catch {
        if (!cancelled) setAll([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, coords?.lat, coords?.lng]);

  const results = useMemo(() => {
    if (!activeCat) return all;
    const wanted = new Set((activeCat.match || []).map((s) => s.toLowerCase()));
    return all.filter(
      (s) =>
        wanted.has(s.category.toLowerCase()) ||
        (s.tags || []).some((t) => wanted.has(String(t).toLowerCase()))
    );
  }, [all, activeCat]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search salons, services…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
      >
        <CatChip label="All" active={!activeCat} onPress={() => setActiveCat(null)} />
        {categories.map((c) => (
          <CatChip
            key={c.id}
            label={c.label}
            icon={c.icon}
            active={activeCat?.id === c.id}
            onPress={() => setActiveCat(activeCat?.id === c.id ? null : c)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <Text style={styles.summary}>
            {results.length} {results.length === 1 ? 'result' : 'results'}
            {activeCat ? ` · ${activeCat.label}` : ''}
          </Text>
          <FlatList
            data={results}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
            renderItem={({ item }) => (
              <SalonCard
                wide
                salon={item}
                onPress={() => navigation.navigate('SalonDetail', { salonId: item.id })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search" size={36} color={colors.textMuted} />
                <Text style={styles.emptyText}>
                  {q ? `No salons match "${q}"` : 'No salons in this filter.'}
                </Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

function CatChip({ label, icon, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {icon && (
        <Ionicons name={icon} size={12} color={active ? '#fff' : colors.textMuted} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  back: { padding: 4, marginRight: spacing.sm },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, marginHorizontal: 8, color: colors.text, fontSize: 14 },

  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill, marginRight: 6,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  summary: { paddingHorizontal: spacing.lg, color: colors.textMuted, ...typography.small },
  empty: { alignItems: 'center', marginTop: 64 },
  emptyText: { color: colors.textMuted, marginTop: 12 },
});
