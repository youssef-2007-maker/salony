// Payment sheet.
//
// Two modes:
//  • REAL  — when the screen is opened with { refType, refId } and the backend
//            has Paymob configured, we create a payment intention and open
//            Paymob's hosted checkout (no card data ever touches this app —
//            PCI-safe and store-compliant). We then poll for confirmation.
//  • MOCK  — otherwise, a simulated card form for local development. No charge.

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { api } from '../api/client';

export default function PaymentSheet({ route, navigation }) {
  const { amount = 0, onSuccess, refType, refId } = route.params || {};
  const canUseReal = !!refType && refId != null;

  const [card, setCard] = useState('4242 4242 4242 4242');
  const [exp, setExp] = useState('12/27');
  const [cvc, setCvc] = useState('123');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | redirected | checking

  const finish = useCallback(
    (method) => {
      if (typeof onSuccess === 'function') onSuccess(method);
      navigation.goBack();
    },
    [onSuccess, navigation]
  );

  // MOCK pay (dev only / when Paymob not configured)
  const payMock = async (method) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    Alert.alert('Payment authorized', `${amount} EGP via ${method.toUpperCase()} (test mode).`);
    finish(method);
  };

  // REAL pay — open Paymob hosted checkout
  const payReal = async () => {
    setBusy(true);
    try {
      const res = await api.paymentIntention({ refType, refId });
      if (!res.enabled) {
        // Backend has no Paymob keys — fall back to the mock form.
        setBusy(false);
        return payMock('card');
      }
      setReference(res.reference);
      setPhase('redirected');
      await Linking.openURL(res.checkoutUrl);
    } catch (e) {
      Alert.alert('Payment error', e.message || 'Could not start checkout.');
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    if (!reference) return;
    setPhase('checking');
    try {
      const { status } = await api.paymentStatus(reference);
      if (status === 'paid') {
        Alert.alert('Payment confirmed', `${amount} EGP paid.`);
        return finish('card');
      }
      if (status === 'failed') {
        Alert.alert('Payment failed', 'The payment was not completed. Please try again.');
        setPhase('idle');
        setReference(null);
        return;
      }
      Alert.alert('Still pending', 'We haven’t received confirmation yet. If you completed payment, wait a moment and check again.');
    } catch (e) {
      Alert.alert('Could not check status', e.message || 'Try again.');
    } finally {
      setPhase('redirected');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Pay {amount} EGP</Text>
        <View style={{ width: 22 }} />
      </View>

      {canUseReal ? (
        <View style={{ padding: spacing.lg }}>
          {phase === 'redirected' || phase === 'checking' ? (
            <>
              <Text style={styles.lead}>
                Complete your payment in the secure checkout that just opened, then come back and confirm.
              </Text>
              <Pressable onPress={checkStatus} disabled={phase === 'checking'} style={[styles.cta, phase === 'checking' && { opacity: 0.6 }]}>
                {phase === 'checking' ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.ctaText}>I’ve completed payment</Text>
                )}
              </Pressable>
              <Pressable onPress={payReal} disabled={busy} style={styles.secondary}>
                <Text style={styles.secondaryText}>Reopen checkout</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.card, shadow.card]}>
                <Ionicons name="lock-closed" size={20} color={colors.primary} />
                <Text style={styles.secureTitle}>Secure checkout</Text>
                <Text style={styles.secureBody}>
                  You’ll pay {amount} EGP through our certified payment partner. Your card details are entered
                  on their secure page — never stored by Salony.
                </Text>
              </View>
              <Pressable onPress={payReal} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="card" size={16} color="#fff" />
                    <Text style={styles.ctaText}>Continue to payment</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <View style={{ padding: spacing.lg }}>
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.lbl}>Card number</Text>
            <TextInput value={card} onChangeText={setCard} keyboardType="numeric" style={styles.input} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>Expiry</Text>
                <TextInput value={exp} onChangeText={setExp} placeholder="MM/YY"
                  placeholderTextColor={colors.textMuted} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>CVC</Text>
                <TextInput value={cvc} onChangeText={setCvc} keyboardType="numeric" style={styles.input} />
              </View>
            </View>
            <Text style={styles.lbl}>Name on card</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Full name"
              placeholderTextColor={colors.textMuted} style={styles.input} />

            <Pressable onPress={() => payMock('card')} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="lock-closed" size={14} color="#fff" />
                  <Text style={styles.ctaText}>Pay {amount} EGP</Text>
                </>
              )}
            </Pressable>
          </View>
          <Text style={styles.foot}>
            Test mode — no card is charged. Configure Paymob keys on the backend to take real payments.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.h1, color: colors.text },

  lead: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  secureTitle: { ...typography.h2, color: colors.text, marginTop: 8 },
  secureBody: { color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 12, color: colors.text, marginTop: 4 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, padding: 14, borderRadius: radius.md, marginTop: spacing.md },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 6 },
  secondary: { alignItems: 'center', padding: 14, marginTop: 8 },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  foot: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, lineHeight: 16, textAlign: 'center' },
});
