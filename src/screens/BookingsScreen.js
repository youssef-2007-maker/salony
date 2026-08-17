import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { useBookings } from '../state/BookingsContext';
import { formatBookingDate } from '../data/dates';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
];

export default function BookingsScreen({ navigation }) {
  const { upcoming, past, cancelBooking, refresh, loading } = useBookings();
  const [tab, setTab] = useState('upcoming');

  const data = tab === 'upcoming' ? upcoming : past;

  const onCancel = (b) =>
    Alert.alert(
      'Cancel booking?',
      `${b.serviceTitle} at ${b.salonName} on ${formatBookingDate(b.date)}.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel booking', style: 'destructive', onPress: () => cancelBooking(b.id) },
      ]
    );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.title}>My Bookings</Text>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {tab === 'upcoming' ? 'No upcoming bookings yet.' : 'No past bookings.'}
            </Text>
            {tab === 'upcoming' && (
              <Pressable onPress={() => navigation.navigate('Home')} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Book a salon</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, shadow.card]}
            onPress={() => navigation.navigate('SalonDetail', { salonId: item.salonId })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.serviceTitle}</Text>
              <Text style={styles.cardPrice}>{item.price} EGP</Text>
            </View>
            <Text style={styles.cardSalon}>
              {item.salonName} · {item.address}
            </Text>
            <View style={styles.cardMetaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="person" size={12} color={colors.primary} />
                <Text style={styles.metaPillText}>{item.barberName}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="calendar" size={12} color={colors.primary} />
                <Text style={styles.metaPillText}>{formatBookingDate(item.date)}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="time" size={12} color={colors.primary} />
                <Text style={styles.metaPillText}>{item.time}</Text>
              </View>
            </View>
            {item.status === 'upcoming' && (
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.action, { borderColor: colors.danger }]}
                  onPress={() => onCancel(item)}
                >
                  <Text style={[styles.actionText, { color: colors.danger }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.action, { borderColor: colors.primary }]}
                  onPress={() => navigation.navigate('SalonDetail', { salonId: item.salonId })}
                >
                  <Text style={[styles.actionText, { color: colors.primary }]}>View salon</Text>
                </Pressable>
              </View>
            )}
            {item.status === 'cancelled' && <Text style={styles.cancelled}>Cancelled</Text>}
            {item.status === 'declined' && <Text style={styles.cancelled}>Declined by salon</Text>}
            {item.status === 'past' && (
              <Pressable
                style={[styles.action, { borderColor: colors.accent, marginTop: spacing.md, marginRight: 0 }]}
                onPress={() => navigation.navigate('Review', { bookingId: item.id, salonName: item.salonName })}
              >
                <Text style={[styles.actionText, { color: colors.accent }]}>Leave review (+25 pts)</Text>
              </Pressable>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { ...typography.display, color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...typography.h2, color: colors.text, flex: 1 },
  cardPrice: { ...typography.h2, color: colors.primary },
  cardSalon: { color: colors.textMuted, marginTop: 4 },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6,
  },
  metaPillText: { marginLeft: 4, color: colors.text, fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', marginTop: spacing.md },
  action: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', marginRight: 8 },
  actionText: { fontWeight: '700' },
  cancelled: { color: colors.danger, marginTop: 8, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 64 },
  emptyText: { color: colors.textMuted, marginTop: 12 },
  emptyBtn: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.md },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
