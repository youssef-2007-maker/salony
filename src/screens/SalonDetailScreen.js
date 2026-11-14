import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import ServiceRow from '../components/ServiceRow';
import { useFavourites } from '../state/FavouritesContext';
import { api } from '../api/client';
import { useLocation } from '../state/LocationContext';

export default function SalonDetailScreen({ route, navigation }) {
  const { salonId } = route.params;
  const { coords } = useLocation();
  const { isFavourite, toggle } = useFavourites();
  const [salon, setSalon] = useState(null);
  const [reviews, setReviews] = useState({ summary: null, reviews: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.salon(salonId, { lat: coords?.lat, lng: coords?.lng });
        if (!cancelled) setSalon(data);
        const r = await api.salonReviews(salonId);
        if (!cancelled) setReviews(r);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load salon');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [salonId, coords?.lat, coords?.lng]);

  const joinWaitlist = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const r = await api.joinWaitlist({ salonId, preferredDate: today });
      Alert.alert('On the wait-list', r.message || "You'll be notified if a slot opens.");
    } catch (e) { Alert.alert('Failed', e.message); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (error || !salon) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.danger, marginBottom: 12 }}>
            {error || 'Salon not found.'}
          </Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const fav = isFavourite(salon.id);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Pressable onPress={() => toggle(salon.id)} hitSlop={10}>
            <Ionicons
              name={fav ? 'heart' : 'heart-outline'}
              size={24}
              color="#fff"
            />
          </Pressable>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.salonName}>{salon.name}</Text>
          <Text style={styles.salonMeta}>
            {salon.category}  ·  {salon.address}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="star" size={14} color="#FFD27A" />
              <Text style={styles.statText}>
                {salon.reviewCount ? `${Number(salon.rating || 0).toFixed(1)} (${salon.reviewCount})` : 'New'}
              </Text>
            </View>
            {salon.distanceKm != null && (
              <View style={styles.stat}>
                <Ionicons name="location-outline" size={14} color="#fff" />
                <Text style={styles.statText}>{salon.distanceKm} km</Text>
              </View>
            )}
            {!!salon.hours && (
              <View style={styles.stat}>
                <Ionicons name="time-outline" size={14} color="#fff" />
                <Text style={styles.statText} numberOfLines={1}>{salon.hours}</Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {salon.deal && (
          <View style={styles.dealBanner}>
            <Ionicons name="flame" size={18} color="#fff" />
            <Text style={styles.dealText}>{salon.deal.title} — {salon.deal.pct}% off</Text>
          </View>
        )}

        <View style={[styles.aboutCard, shadow.card]}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>{salon.about}</Text>
          {salon.handle && (
            <Text style={styles.handle}>salony.app/{salon.handle}</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Services</Text>
        {(salon.services || []).map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            onPress={() =>
              navigation.navigate('Booking', { salonId: salon.id, serviceId: service.id })
            }
          />
        ))}

        <Pressable onPress={joinWaitlist} style={styles.waitlistBtn}>
          <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
          <Text style={styles.waitlistText}>All booked? Join the wait-list</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
          Reviews {reviews.summary ? `(${reviews.summary.count})` : ''}
        </Text>
        {reviews.reviews.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No reviews yet — be the first.</Text>
        ) : (
          reviews.reviews.slice(0, 4).map((r) => (
            <View key={r.id} style={[styles.reviewCard, shadow.card]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons key={n} name={n <= r.rating ? 'star' : 'star-outline'}
                    size={14} color={colors.accent} />
                ))}
                <Text style={styles.reviewAuthor}>  {r.author}</Text>
              </View>
              {r.body && <Text style={styles.reviewBody}>{r.body}</Text>}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primary },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  salonName: { ...typography.display, color: '#fff' },
  salonMeta: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: spacing.md, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginTop: 6 },
  statText: { color: '#fff', marginLeft: 4, fontSize: 12, fontWeight: '600' },

  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sectionTitle: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  aboutText: { color: colors.textMuted, lineHeight: 20 },
  handle: { color: colors.primary, marginTop: 8, fontWeight: '700' },

  dealBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.accent, padding: spacing.md, borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  dealText: { color: '#fff', fontWeight: '800', marginLeft: 6 },

  waitlistBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: spacing.md, marginTop: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  waitlistText: { color: colors.primary, fontWeight: '700', marginLeft: 6 },

  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  reviewAuthor: { color: colors.text, fontWeight: '700' },
  reviewBody: { color: colors.textMuted, marginTop: 6, lineHeight: 18 },
});
