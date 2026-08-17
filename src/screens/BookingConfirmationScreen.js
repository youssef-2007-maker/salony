import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import PrimaryButton from '../components/PrimaryButton';
import { formatBookingDate } from '../data/dates';

export default function BookingConfirmationScreen({ route, navigation }) {
  const { salonName, serviceTitle, barberName, date, time, price } = route.params;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, alignItems: 'center' }}>
        <View style={styles.tick}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <Text style={styles.title}>Booking Confirmed</Text>
        <Text style={styles.subtitle}>
          Your appointment at {salonName} is locked in. We'll send a reminder before it starts.
        </Text>

        <View style={[styles.card, shadow.card]}>
          <Row label="Salon" value={salonName} />
          <Row label="Service" value={serviceTitle} />
          <Row label="With" value={barberName} />
          <Row label="When" value={`${formatBookingDate(date)}  •  ${time}`} />
          <Row label="Total" value={`${price} EGP`} bold />
        </View>

        <PrimaryButton
          title="View my bookings"
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Tabs', state: { routes: [{ name: 'Bookings' }] } }],
            })
          }
          style={{ alignSelf: 'stretch', marginTop: spacing.xl }}
        />
        <PrimaryButton
          title="Back to home"
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })
          }
          style={{
            alignSelf: 'stretch',
            marginTop: spacing.md,
            backgroundColor: colors.surfaceMuted,
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '800', color: colors.primary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tick: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  title: { ...typography.display, color: colors.text, marginTop: spacing.lg },
  subtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textMuted },
  rowValue: { color: colors.text, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
});
