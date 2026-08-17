import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, shadow } from '../theme/colors';
import { categories } from '../data/salons';
import SalonCard from '../components/SalonCard';
import CategoryCard from '../components/CategoryCard';
import SectionHeader from '../components/SectionHeader';
import { api } from '../api/client';
import { useLocation } from '../state/LocationContext';
import { useAuth } from '../state/AuthContext';
import { useLoyalty } from '../state/LoyaltyContext';

export default function HomeScreen({ navigation }) {
  const { coords, label, source, refresh: refreshLocation } = useLocation();
  const { user } = useAuth();
  const { points, tier } = useLoyalty();
  const [recommended, setRecommended] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [rec, feat, dl] = await Promise.all([
        api.recommendedSalons({ lat: coords?.lat, lng: coords?.lng, limit: 8 }),
        api.featuredSalons({ lat: coords?.lat, lng: coords?.lng, limit: 6 }),
        api.liveDeals(),
      ]);
      setRecommended(rec);
      setFeatured(feat);
      setDeals(dl);
    } catch (e) {
      setError(e.message || 'Could not load salons.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coords?.lat, coords?.lng]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLocation();
    await load();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => navigation.navigate('LocationPicker')}
            hitSlop={6}
            style={{ flex: 1 }}
          >
            <Text style={styles.locLabel}>Location</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location" size={16} color="#fff" />
              <Text style={styles.locName} numberOfLines={1}>  {label}</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.locHint}>
              {source === 'override' ? 'Tap to change' : source === 'gps' ? 'GPS' : 'Tap to set'}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })} hitSlop={10}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        <Pressable
          style={[styles.searchBar, shadow.card]}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search salons, services…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            editable={false}
            pointerEvents="none"
          />
        </Pressable>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {user ? `Hi ${user.name.split(' ')[0]},\nlet's get groomed` : 'Grooming\nmade simple'}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Search')}
              style={styles.heroBtn}
            >
              <Text style={styles.heroBtnText}>Browse salons</Text>
            </Pressable>
          </View>
          <View style={styles.heroImg}>
            <Ionicons name="cut" size={48} color="#fff" />
          </View>
        </View>

        <View style={styles.quickRow}>
          <Pressable style={[styles.quick, shadow.card]} onPress={() => navigation.navigate('Tabs', { screen: 'Shop' })}>
            <Ionicons name="bag" size={20} color={colors.primary} />
            <Text style={styles.quickLabel}>Marketplace</Text>
          </Pressable>
          <Pressable style={[styles.quick, shadow.card]} onPress={() => navigation.navigate('Tabs', { screen: 'Rewards' })}>
            <Ionicons name="star" size={20} color={colors.primary} />
            <Text style={styles.quickLabel}>{points} pts</Text>
          </Pressable>
          <Pressable style={[styles.quick, shadow.card]} onPress={() => navigation.navigate('Plus')}>
            <Ionicons name="diamond" size={20} color={colors.primary} />
            <Text style={styles.quickLabel}>Salony Plus</Text>
          </Pressable>
        </View>

        {deals.length > 0 && (
          <>
            <SectionHeader title="Today's flash deals" />
            <FlatList
              data={deals}
              keyExtractor={(d) => String(d.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.dealCard, shadow.card]}
                  onPress={() => navigation.navigate('SalonDetail', { salonId: item.salon_id })}
                >
                  <View style={styles.dealPct}>
                    <Text style={styles.dealPctText}>{item.pct}%</Text>
                    <Text style={styles.dealPctSub}>OFF</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.dealSalon} numberOfLines={1}>{item.salon_name}</Text>
                    <Text style={styles.dealTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.dealEnds}>Ends {new Date(item.ends_at).toLocaleDateString()}</Text>
                  </View>
                </Pressable>
              )}
            />
          </>
        )}

        {featured.length > 0 && (
          <>
            <SectionHeader title="Featured this week" />
            <FlatList
              data={featured}
              keyExtractor={(s) => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
              renderItem={({ item }) => (
                <SalonCard
                  salon={item}
                  onPress={() => navigation.navigate('SalonDetail', { salonId: item.id })}
                />
              )}
            />
          </>
        )}

        <SectionHeader
          title={source !== 'fallback' ? 'Recommended near you' : 'Recommended'}
          actionLabel="See all"
          onPress={() => navigation.navigate('Search')}
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
        ) : error ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>
            <Pressable onPress={load}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={recommended}
            keyExtractor={(s) => s.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            renderItem={({ item }) => (
              <SalonCard
                salon={item}
                onPress={() => navigation.navigate('SalonDetail', { salonId: item.id })}
              />
            )}
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.lg }}>No salons yet.</Text>
            }
          />
        )}

        <SectionHeader title="Categories" />
        <View style={styles.catGrid}>
          {categories.map((c) => (
            <CategoryCard
              key={c.id}
              category={c}
              onPress={() => navigation.navigate('Category', { categoryId: c.id })}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primary },
  headerInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  locName: { color: '#fff', fontWeight: '700', fontSize: 14, flexShrink: 1 },
  locHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },

  quickRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: 4,
  },
  quick: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.surface, borderRadius: radius.md, marginRight: spacing.sm,
  },
  quickLabel: { color: colors.text, fontWeight: '700', fontSize: 11, marginTop: 4 },

  dealCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, width: 260, marginRight: spacing.md,
  },
  dealPct: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  dealPctText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  dealPctSub: { color: '#fff', fontSize: 9, fontWeight: '800' },
  dealSalon: { color: colors.text, fontWeight: '800' },
  dealTitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  dealEnds: { color: colors.primary, fontSize: 11, marginTop: 4, fontWeight: '700' },

  searchBar: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: { flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 },

  hero: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 160,
  },
  heroTitle: { ...typography.display, color: '#fff', marginBottom: 16 },
  heroBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  heroBtnText: { color: colors.primary, fontWeight: '800' },
  heroImg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },

  catGrid: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
