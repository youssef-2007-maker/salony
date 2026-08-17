import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api, API_URL } from '../../api/client';

export default function BarberMiniSiteScreen({ navigation }) {
  const [salon, setSalon] = useState(null);

  useEffect(() => { (async () => { try { setSalon(await api.mySalon()); } catch { /* */ } })(); }, []);

  const url = salon ? `${API_URL}/ops/site/${salon.handle}` : '';
  const shareLink = () => {
    if (!salon?.handle) return Alert.alert('Set a handle', 'Add a handle in Settings first.');
    Share.share({ message: `Book me on Salony: ${url}` });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>My mini-site</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {!salon ? null : (
          <>
            <View style={[styles.preview, shadow.card]}>
              <View style={styles.previewHero}>
                <Text style={styles.previewTitle}>{salon.name}</Text>
                <Text style={styles.previewSub}>{salon.category} · {salon.address}</Text>
              </View>
              <View style={{ padding: spacing.md }}>
                <Text style={styles.section}>About</Text>
                <Text style={styles.body}>{salon.about || '—'}</Text>
                <Text style={styles.section}>Services</Text>
                {(salon.services || []).map((s) => (
                  <View key={s.id} style={styles.svc}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{s.title}</Text>
                    <Text style={{ color: colors.primary, fontWeight: '800' }}>{s.price} EGP</Text>
                  </View>
                ))}
                <View style={styles.fauxCta}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Book on Salony</Text>
                </View>
              </View>
            </View>

            <View style={[styles.urlCard, shadow.card]}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Public link</Text>
              <Text style={styles.url}>{salon.handle ? url : 'Set a handle in Settings to publish'}</Text>
              <Pressable onPress={shareLink} style={styles.shareBtn}>
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.shareText}>Share my link</Text>
              </Pressable>
            </View>

            <Text style={styles.foot}>
              Put this URL in your Instagram bio and WhatsApp Business catalogue. Customers can book
              you straight from the link.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.h1, color: colors.text },

  preview: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  previewHero: { backgroundColor: colors.primary, padding: spacing.lg, alignItems: 'center' },
  previewTitle: { ...typography.display, color: '#fff' },
  previewSub: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  section: { ...typography.h2, color: colors.text, marginTop: spacing.md, marginBottom: 6 },
  body: { color: colors.textMuted, lineHeight: 18 },
  svc: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  fauxCta: { backgroundColor: colors.primary, alignItems: 'center', padding: 14, borderRadius: radius.md, marginTop: spacing.md },

  urlCard: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md },
  url: { color: colors.primary, fontWeight: '700', marginTop: 4 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, padding: 12, borderRadius: radius.md, marginTop: spacing.md },
  shareText: { color: '#fff', fontWeight: '800', marginLeft: 6 },

  foot: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, lineHeight: 16 },
});
