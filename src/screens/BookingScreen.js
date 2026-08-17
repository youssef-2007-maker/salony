import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { getUpcomingDates, getDailySlots } from '../data/dates';
import BarberAvatar from '../components/BarberAvatar';
import DateChip from '../components/DateChip';
import Pill from '../components/Pill';
import PrimaryButton from '../components/PrimaryButton';
import { useBookings } from '../state/BookingsContext';
import { useLoyalty } from '../state/LoyaltyContext';
import { api } from '../api/client';

const TIP_PRESETS = [0, 10, 20, 30];

export default function BookingScreen({ route, navigation }) {
  const { salonId, serviceId } = route.params;
  const dates = useMemo(() => getUpcomingDates(14), []);
  const slots = useMemo(() => getDailySlots(), []);
  const { addBooking } = useBookings();
  const { points, refresh: refreshLoyalty, subscription } = useLoyalty();

  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [barber, setBarber] = useState(null);
  const [date, setDate] = useState(dates[1]?.iso ?? dates[0].iso);
  const [time, setTime] = useState('11:00 AM');

  const [redeemPoints, setRedeemPoints] = useState(0);
  const [tip, setTip] = useState(0);
  const [isAtHome, setIsAtHome] = useState(false);
  const [atHomeAddress, setAtHomeAddress] = useState('');
  const [groupSize, setGroupSize] = useState(1);
  const [payMethod, setPayMethod] = useState('cash');

  const [quote, setQuote] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.salon(salonId);
        if (cancelled) return;
        setSalon(data);
        const firstBarber = (data.barbers || []).find((b) => !b.isAny) || (data.barbers || [])[0];
        if (firstBarber) setBarber(firstBarber.id);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [salonId]);

  const service = (salon?.services || []).find((s) => s.id === serviceId) || salon?.services?.[0];

  const baseGross = useMemo(() => {
    if (!service) return 0;
    let p = service.price * groupSize;
    if (isAtHome && salon?.atHomeFee) p += salon.atHomeFee;
    return p;
  }, [service, groupSize, isAtHome, salon?.atHomeFee]);

  // Re-fetch quote when redeemPoints changes
  useEffect(() => {
    if (!service || !salon) return;
    if (redeemPoints <= 0) { setQuote(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const q = await api.redeemQuote({ salonId: salon.id, basePrice: baseGross, points: redeemPoints });
        if (!cancelled) setQuote(q);
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, [redeemPoints, baseGross, salon, service]);

  if (loading || !salon) {
    return <SafeAreaView style={styles.root}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></SafeAreaView>;
  }
  if (!service) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ padding: 24 }}><Text style={{ color: colors.danger }}>This salon has no services yet.</Text></View>
      </SafeAreaView>
    );
  }

  const dealDiscount = salon.deal ? Math.round(baseGross * (salon.deal.pct / 100)) : 0;
  const plusActive = subscription?.active && (subscription?.freeCuts > 0 || true);
  const plusDiscount = subscription?.active
    ? (subscription.freeCuts > 0 && groupSize === 1 ? service.price : Math.round((baseGross - dealDiscount) * 0.15))
    : 0;
  const pointsDiscount = quote?.discount || 0;
  const finalPrice = Math.max(0, baseGross - dealDiscount - plusDiscount - pointsDiscount);
  const depositAmount = salon.depositRequired ? Math.round(finalPrice * (salon.depositPct || 0.25)) : 0;

  const placeBooking = async (paidMethod) => {
    const chosenBarber = (salon.barbers || []).find((b) => b.id === barber);
    setBusy(true);
    try {
      const created = await addBooking({
        salonId: salon.id,
        serviceId: service.id,
        barberId: chosenBarber?.isAny ? null : chosenBarber?.id,
        date, time,
        redeemPoints: redeemPoints || 0,
        tip,
        isAtHome,
        atHomeAddress: isAtHome ? atHomeAddress : null,
        groupSize,
        payMethod: paidMethod || payMethod,
      });
      refreshLoyalty();
      navigation.replace('BookingConfirmation', {
        salonName: salon.name,
        serviceTitle: service.title,
        barberName: chosenBarber?.name ?? 'Any',
        date, time, price: created.price,
        depositPaid: created.depositPaid,
        pointsEarned: created.pointsEarned,
        pointsRedeemed: created.pointsRedeemed,
      });
    } catch (e) {
      Alert.alert('Could not book', e.message || 'Please try again.');
    } finally { setBusy(false); }
  };

  const onConfirm = () => {
    if (isAtHome && !atHomeAddress.trim()) {
      Alert.alert('Address required', 'Add your address for at-home service.');
      return;
    }
    const owed = (payMethod === 'card')
      ? (finalPrice + tip)
      : (salon.depositRequired ? Math.round(finalPrice * (salon.depositPct || 0.25)) : 0);
    if (payMethod === 'card' || owed > 0) {
      navigation.navigate('Payment', {
        amount: owed,
        onSuccess: (method) => placeBooking(method),
      });
    } else {
      placeBooking('cash');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerBack}>Back</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <Text style={styles.salonName}>{salon.name}</Text>
          <Text style={styles.salonMeta}>{salon.category}  ·  {salon.address}</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}>
        <View style={[styles.serviceCard, shadow.card]}>
          <View style={styles.serviceIcon}><Ionicons name="cut" size={22} color="#fff" /></View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.serviceTitle}>{service.title}</Text>
            <Text style={styles.serviceMeta}>{service.duration} · {service.details}</Text>
          </View>
          <Text style={styles.servicePrice}>{service.price} EGP</Text>
        </View>

        {salon.deal && (
          <View style={styles.dealBanner}>
            <Ionicons name="flame" size={18} color="#fff" />
            <Text style={styles.dealText}>{salon.deal.pct}% off · {salon.deal.title}</Text>
          </View>
        )}

        <Text style={styles.label}>Choose Barber</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          {(salon.barbers || []).map((b) => (
            <BarberAvatar key={b.id} barber={b} active={barber === b.id} onPress={() => setBarber(b.id)} />
          ))}
        </ScrollView>

        <Text style={styles.label}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          {dates.map((d) => (
            <DateChip key={d.iso} day={d.day} label={d.label} active={date === d.iso} onPress={() => setDate(d.iso)} />
          ))}
        </ScrollView>

        <Text style={styles.label}>Select Time</Text>
        <View style={styles.slotGrid}>
          {slots.map((s) => (
            <Pill key={s.label} label={s.label} active={time === s.label} disabled={!s.available}
              onPress={() => setTime(s.label)} style={styles.slot} />
          ))}
        </View>

        {/* Group booking */}
        <View style={[styles.optCard, shadow.card]}>
          <View style={styles.optRow}>
            <Ionicons name="people" size={18} color={colors.primary} />
            <Text style={styles.optTitle}>Group booking</Text>
            <View style={styles.qtyCtrl}>
              <Pressable onPress={() => setGroupSize(Math.max(1, groupSize - 1))} hitSlop={6}>
                <Ionicons name="remove-circle-outline" size={22} color={colors.text} />
              </Pressable>
              <Text style={styles.qtyText}>{groupSize}</Text>
              <Pressable onPress={() => setGroupSize(Math.min(10, groupSize + 1))} hitSlop={6}>
                <Ionicons name="add-circle-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.optHint}>Book multiple chairs at once for events.</Text>
        </View>

        {/* At-home */}
        {salon.offersAtHome && (
          <View style={[styles.optCard, shadow.card]}>
            <View style={styles.optRow}>
              <Ionicons name="home" size={18} color={colors.primary} />
              <Text style={styles.optTitle}>At-home service</Text>
              <Switch value={isAtHome} onValueChange={setIsAtHome}
                trackColor={{ true: colors.primary, false: colors.disabled }} thumbColor="#fff" />
            </View>
            <Text style={styles.optHint}>
              Barber comes to you. Extra fee: {salon.atHomeFee} EGP.
            </Text>
            {isAtHome && (
              <TextInput value={atHomeAddress} onChangeText={setAtHomeAddress}
                placeholder="Your address (street, building, floor)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            )}
          </View>
        )}

        {/* Points redemption */}
        {points > 0 && (
          <View style={[styles.optCard, shadow.card]}>
            <View style={styles.optRow}>
              <Ionicons name="medal" size={18} color={colors.primary} />
              <Text style={styles.optTitle}>Use points</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>You have {points}</Text>
            </View>
            <View style={styles.ptsRow}>
              {[0, 50, 100, Math.min(points, 200)].filter((n, i, a) => a.indexOf(n) === i).map((n) => (
                <Pressable key={n} onPress={() => setRedeemPoints(n)}
                  style={[styles.ptsBtn, redeemPoints === n && styles.ptsBtnActive]}>
                  <Text style={[styles.ptsBtnText, redeemPoints === n && { color: '#fff' }]}>
                    {n === 0 ? 'None' : `${n} pts`}
                  </Text>
                </Pressable>
              ))}
            </View>
            {pointsDiscount > 0 && (
              <Text style={{ color: colors.success, marginTop: 6 }}>−{pointsDiscount} EGP discount</Text>
            )}
          </View>
        )}

        {/* Tip */}
        <View style={[styles.optCard, shadow.card]}>
          <View style={styles.optRow}>
            <Ionicons name="heart" size={18} color={colors.primary} />
            <Text style={styles.optTitle}>Add tip</Text>
          </View>
          <View style={styles.ptsRow}>
            {TIP_PRESETS.map((n) => (
              <Pressable key={n} onPress={() => setTip(n)}
                style={[styles.ptsBtn, tip === n && styles.ptsBtnActive]}>
                <Text style={[styles.ptsBtnText, tip === n && { color: '#fff' }]}>
                  {n === 0 ? 'None' : `${n} EGP`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Payment */}
        <View style={[styles.optCard, shadow.card]}>
          <View style={styles.optRow}>
            <Ionicons name="card" size={18} color={colors.primary} />
            <Text style={styles.optTitle}>Payment</Text>
          </View>
          <View style={styles.ptsRow}>
            <Pressable onPress={() => setPayMethod('cash')} style={[styles.ptsBtn, payMethod === 'cash' && styles.ptsBtnActive]}>
              <Text style={[styles.ptsBtnText, payMethod === 'cash' && { color: '#fff' }]}>Cash at salon</Text>
            </Pressable>
            <Pressable onPress={() => setPayMethod('card')} style={[styles.ptsBtn, payMethod === 'card' && styles.ptsBtnActive]}>
              <Text style={[styles.ptsBtnText, payMethod === 'card' && { color: '#fff' }]}>Pay in app</Text>
            </Pressable>
          </View>
        </View>

        {/* Breakdown */}
        <View style={[styles.summary, shadow.card]}>
          <Row label={`Service × ${groupSize}`} value={`${service.price * groupSize} EGP`} />
          {isAtHome && <Row label="At-home fee" value={`+${salon.atHomeFee} EGP`} />}
          {dealDiscount > 0 && <Row label={`Deal (${salon.deal.pct}% off)`} value={`−${dealDiscount} EGP`} good />}
          {plusDiscount > 0 && (
            <Row label={subscription?.freeCuts > 0 && groupSize === 1 ? 'Plus free cut' : 'Plus 15% off'}
                 value={`−${plusDiscount} EGP`} good />
          )}
          {pointsDiscount > 0 && <Row label={`Points (${redeemPoints})`} value={`−${pointsDiscount} EGP`} good />}
          {tip > 0 && <Row label="Tip" value={`+${tip} EGP`} />}
          <View style={styles.divider} />
          <Row label="Total" value={`${finalPrice + tip} EGP`} bold />
          {depositAmount > 0 && (
            <Text style={styles.depositHint}>Deposit of {depositAmount} EGP charged now (refundable if cancelled 24h+ in advance)</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>{finalPrice + tip} EGP</Text>
        </View>
        <PrimaryButton title={busy ? 'Booking…' : 'Confirm booking'} onPress={onConfirm}
          disabled={busy} style={{ flex: 1, marginLeft: spacing.md }} />
      </View>
    </View>
  );
}

function Row({ label, value, bold, good }) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, bold && { fontWeight: '800', color: colors.text }]}>{label}</Text>
      <Text style={[
        styles.sumValue,
        bold && { fontWeight: '800', color: colors.primary },
        good && { color: colors.success },
      ]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primary },
  headerInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  headerBack: { color: '#fff', marginLeft: 4, fontWeight: '600' },
  salonName: { ...typography.h1, color: '#fff', marginTop: spacing.sm },
  salonMeta: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  serviceCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', marginTop: -spacing.xl,
  },
  serviceIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { ...typography.h2, color: colors.text },
  serviceMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  servicePrice: { ...typography.h2, color: colors.primary },

  dealBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, marginTop: spacing.md,
  },
  dealText: { color: '#fff', fontWeight: '800', marginLeft: 6 },

  label: { ...typography.h2, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '31%', marginRight: '3.5%', marginBottom: 10 },

  optCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md,
  },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optTitle: { ...typography.h2, color: colors.text, marginLeft: 6, flex: 1 },
  optHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  qtyCtrl: { flexDirection: 'row', alignItems: 'center' },
  qtyText: { marginHorizontal: 12, color: colors.text, fontWeight: '800' },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10, color: colors.text, marginTop: 8 },

  ptsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  ptsBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted, marginRight: 6, marginBottom: 6,
  },
  ptsBtnActive: { backgroundColor: colors.primary },
  ptsBtnText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },

  summary: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { color: colors.textMuted },
  sumValue: { color: colors.text, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  depositHint: { color: colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.lg, paddingBottom: spacing.xl, flexDirection: 'row', alignItems: 'center',
  },
  totalLabel: { color: colors.textMuted, fontSize: 12 },
  totalPrice: { ...typography.h1, color: colors.text },
});
