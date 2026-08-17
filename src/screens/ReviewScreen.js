import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { api } from '../api/client';
import { useLoyalty } from '../state/LoyaltyContext';
import { useBookings } from '../state/BookingsContext';

export default function ReviewScreen({ route, navigation }) {
  const { bookingId, salonName } = route.params;
  const { refresh } = useLoyalty();
  const { refresh: refreshBookings } = useBookings();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.postReview({ bookingId, rating, body: body.trim() || null });
      refresh();
      refreshBookings();
      Alert.alert('Thanks!', 'You earned 25 points for reviewing.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not post', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Leave a review</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.subtitle}>How was your visit to {salonName}?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={n <= rating ? colors.accent : colors.textMuted}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Tell other customers about your experience (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
          </View>

          <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.ctaText}>Post review</Text>
                <Text style={styles.ctaPts}>+25 points</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  subtitle: { color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    padding: 12, color: colors.text, minHeight: 100, textAlignVertical: 'top',
  },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
  cta: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.md, marginTop: spacing.md, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  ctaPts: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
});
