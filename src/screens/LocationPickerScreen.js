import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { PLACES } from '../data/places';
import { useLocation } from '../state/LocationContext';

export default function LocationPickerScreen({ navigation }) {
  const { setOverrideLocation, useDeviceLocation, source, status, label } = useLocation();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return PLACES;
    return PLACES.filter(
      (p) => p.name.toLowerCase().includes(t) || p.region.toLowerCase().includes(t)
    );
  }, [q]);

  const pick = async (p) => {
    await setOverrideLocation(p);
    navigation.goBack();
  };

  const onUseDevice = async () => {
    await useDeviceLocation();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Choose location</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.gpsRow, shadow.card]}>
        <View style={styles.gpsIcon}>
          <Ionicons name="locate" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.gpsTitle}>Use my device location</Text>
          <Text style={styles.gpsSub}>
            {status === 'granted' ? `Currently: ${label}` : 'Tap to enable GPS'}
          </Text>
        </View>
        <Pressable onPress={onUseDevice} style={styles.gpsBtn}>
          <Text style={styles.gpsBtnText}>
            {source === 'gps' ? 'Refresh' : 'Use'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search city or neighbourhood"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, shadow.card]} onPress={() => pick(item)}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowRegion}>{item.region}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
            No matches.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  back: { padding: 4 },
  title: { ...typography.h1, color: colors.text },

  gpsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.lg, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
  },
  gpsIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  gpsTitle: { color: colors.text, fontWeight: '700' },
  gpsSub: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  gpsBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  gpsBtnText: { color: '#fff', fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, marginHorizontal: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, marginHorizontal: 8, color: colors.text, fontSize: 14 },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowName: { color: colors.text, fontWeight: '700' },
  rowRegion: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
