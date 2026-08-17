import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api, API_URL } from '../../api/client';
import { loadToken } from '../../api/client';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BarberTaxScreen({ navigation }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api.tax(year)); } catch { setData(null); }
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const download = async () => {
    const token = await loadToken();
    const url = `${API_URL}/ops/me/tax.csv?year=${year}`;
    Alert.alert(
      'Download statement',
      'On a real device this opens the CSV. From the simulator it copies the URL to the clipboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            // Pass token via header isn't possible from Linking. The CSV endpoint requires auth;
            // in production we'd open a web view with an Authorization header proxy. For now,
            // suggest downloading via curl.
            Alert.alert('URL', `Run:\n\ncurl -H "Authorization: Bearer ${token}" "${url}" -o tax.csv`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Tax & income</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.yearRow}>
          {[year - 1, year, year + 1].map((y) => (
            <Pressable key={y} onPress={() => setYear(y)} style={[styles.yearPill, year === y && styles.yearPillActive]}>
              <Text style={[styles.yearText, year === y && { color: '#fff' }]}>{y}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Bookings income</Text>
          {data?.bookings?.length ? data.bookings.map((m) => (
            <Row key={m.month} label={`${MONTHS[parseInt(m.month.split('-')[1],10)-1]} ${m.month.split('-')[0]}`}
              left={`${m.bookings} bookings`} right={`${m.total} EGP`} />
          )) : <Text style={{ color: colors.textMuted, marginTop: 8 }}>No bookings recorded for {year}.</Text>}
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.cardTitle}>Marketplace orders</Text>
          {data?.products?.length ? data.products.map((m) => (
            <Row key={m.month} label={`${MONTHS[parseInt(m.month.split('-')[1],10)-1]} ${m.month.split('-')[0]}`}
              left={`${m.orders} orders`} right={`${m.gross - m.commission} EGP after fees`} />
          )) : <Text style={{ color: colors.textMuted, marginTop: 8 }}>No product orders for {year}.</Text>}
        </View>

        <Pressable onPress={download} style={styles.dl}>
          <Ionicons name="download" size={16} color="#fff" />
          <Text style={styles.dlText}>Download CSV</Text>
        </Pressable>
        <Text style={styles.foot}>
          Detailed line-by-line statement, ready to hand to your accountant or the Egyptian Tax
          Authority. Real PDF invoices land after wiring an invoicing API.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, left, right }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{left}</Text>
      <Text style={{ color: colors.primary, fontWeight: '800' }}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.h1, color: colors.text },

  yearRow: { flexDirection: 'row', marginBottom: spacing.md },
  yearPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted, marginRight: 6 },
  yearPillActive: { backgroundColor: colors.primary },
  yearText: { color: colors.textMuted, fontWeight: '700' },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { ...typography.h2, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },

  dl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, padding: 12, borderRadius: radius.md },
  dlText: { color: '#fff', fontWeight: '800', marginLeft: 6 },
  foot: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, lineHeight: 16 },
});
