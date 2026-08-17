import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { useBookings } from '../../state/BookingsContext';
import { formatBookingDate } from '../../data/dates';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
];

export default function BarberBookingsScreen() {
  const { upcoming, past, updateStatus, refresh, loading } = useBookings();
  const [tab, setTab] = useState('upcoming');
  const data = tab === 'upcoming' ? upcoming : past;

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
            <Text style={styles.emptyText}>No bookings here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, shadow.card]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.serviceTitle}</Text>
              <Text style={styles.cardPrice}>{item.price} EGP</Text>
            </View>
            <Text style={styles.cardSalon}>
              {item.customerName || 'Customer'} · {formatBookingDate(item.date)} · {item.time}
            </Text>
            {item.status === 'upcoming' && (
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.action, { borderColor: colors.success }]}
                  onPress={() =>
                    Alert.alert('Mark complete', 'Mark this booking as done?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Done', onPress: () => updateStatus(item.id, 'past') },
                    ])
                  }
                >
                  <Text style={[styles.actionText, { color: colors.success }]}>Mark done</Text>
                </Pressable>
                <Pressable
                  style={[styles.action, { borderColor: colors.danger }]}
                  onPress={() =>
                    Alert.alert('Decline booking', 'This will notify the customer.', [
                      { text: 'Keep', style: 'cancel' },
                      { text: 'Decline', style: 'destructive', onPress: () => updateStatus(item.id, 'declined') },
                    ])
                  }
                >
                  <Text style={[styles.actionText, { color: colors.danger }]}>Decline</Text>
                </Pressable>
              </View>
            )}
            {item.status === 'declined' && <Text style={styles.cancelled}>Declined</Text>}
            {item.status === 'cancelled' && <Text style={styles.cancelled}>Cancelled by customer</Text>}
          </View>
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
  actionRow: { flexDirection: 'row', marginTop: spacing.md },
  action: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', marginRight: 8 },
  actionText: { fontWeight: '700' },
  cancelled: { color: colors.danger, marginTop: 8, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 64 },
  emptyText: { color: colors.textMuted, marginTop: 12 },
});
