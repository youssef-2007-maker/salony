import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { api } from '../api/client';

// MOCKUP BYPASS — set mockupLocal on any style to skip the API and show a
// local image instead. Useful for demos/recordings without burning API credits.
// To activate: save your reference photo to assets/buzz-cut-ref.jpg
const BUZZ_CUT_MOCKUP = require('../../assets/buzz-cut-ref.jpg');

const HAIRSTYLES = [
  { id: 'fade-low',  title: 'Low Fade',    hint: 'Clean and modern, good for round faces.' },
  { id: 'fade-mid',  title: 'Mid Fade',    hint: 'Versatile, suits most face shapes.' },
  { id: 'fade-high', title: 'High Fade',   hint: 'Bold; emphasises strong jawlines.' },
  { id: 'crop',      title: 'French Crop', hint: 'Easy maintenance, textured top.' },
  { id: 'pompadour', title: 'Pompadour',   hint: 'Classic, needs styling product.' },
  {
    id: 'buzz',
    title: 'Buzz Cut',
    hint: 'Minimal upkeep, athletic look.',
    mockupLocal: BUZZ_CUT_MOCKUP, // ← bypasses API for this style
  },
  { id: 'quiff',  title: 'Quiff',  hint: 'Volume on top, fades on sides.' },
  { id: 'caesar', title: 'Caesar', hint: 'Short, fringe forward.' },
];

async function preparePhoto(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return result;
}

export default function AIHairstyleScreen({ navigation }) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [pickedStyle, setPickedStyle] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.hairstyles().then((data) => {
      setAiEnabled(Array.isArray(data) ? false : Boolean(data.aiEnabled));
    }).catch(() => {});
  }, []);

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a selfie.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const prepared = await preparePhoto(res.assets[0].uri);
    setPhoto({ uri: prepared.uri, base64: prepared.base64 });
    setPickerOpen(false);
    setResult(null);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a selfie.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      cameraType: ImagePicker.CameraType.front,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const prepared = await preparePhoto(res.assets[0].uri);
    setPhoto({ uri: prepared.uri, base64: prepared.base64 });
    setPickerOpen(false);
    setResult(null);
  };

  const generate = async () => {
    if (!photo) {
      Alert.alert('Add a selfie first', 'Take a selfie or pick one from your library.');
      return;
    }
    if (!pickedStyle) {
      Alert.alert('Pick a style', 'Tap one of the styles below first.');
      return;
    }

    // MOCKUP BYPASS — show local image instantly, no API call.
    if (pickedStyle.mockupLocal) {
      setResult({ style: pickedStyle, localImage: pickedStyle.mockupLocal });
      return;
    }

    setGenerating(true);
    setResult(null);
    try {
      const out = await api.hairstyleTryOn({
        styleId: pickedStyle.id,
        selfieB64: photo.base64,
      });
      setResult({ url: out.url, b64: out.b64, provider: out.provider, style: pickedStyle });
    } catch (e) {
      if (e.status === 503) {
        setResult({ style: pickedStyle, demo: true });
      } else {
        Alert.alert('Generation failed', e.message || 'Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>AI Hairstyle Studio</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={[styles.hero, shadow.card]}>
          <Ionicons name="sparkles" size={32} color="#fff" />
          <Text style={styles.heroTitle}>Try a new look first</Text>
          <Text style={styles.heroSub}>
            Upload a selfie, pick a style, see the result. Then book a barber.
          </Text>
        </View>

        {/* Step 1: selfie */}
        <View style={[styles.card, shadow.card]}>
          <Text style={styles.stepLabel}>1. YOUR SELFIE</Text>
          {photo ? (
            <View style={styles.selfieRow}>
              <Image source={{ uri: photo.uri }} style={styles.selfieImg} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.selfieName}>Your photo</Text>
                <Pressable onPress={() => setPickerOpen(true)}>
                  <Text style={styles.linkText}>Change photo</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setPickerOpen(true)} style={styles.uploadBtn}>
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.uploadText}>Add a selfie</Text>
            </Pressable>
          )}
        </View>

        {/* Step 2: style */}
        <Text style={styles.stepHdr}>2. Pick a style</Text>
        <View style={styles.grid}>
          {HAIRSTYLES.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => { setPickedStyle(s); setResult(null); }}
              style={[styles.styleCard, pickedStyle?.id === s.id && styles.stylePicked]}
            >
              <View style={styles.styleThumb}>
                <Ionicons name="cut" size={28} color={colors.primary} />
              </View>
              <Text style={styles.styleTitle}>{s.title}</Text>
              <Text style={styles.styleHint} numberOfLines={2}>{s.hint}</Text>
              {pickedStyle?.id === s.id && (
                <View style={styles.tick}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Step 3: generate */}
        <Pressable
          onPress={generate}
          disabled={generating}
          style={[styles.generateBtn, generating && { opacity: 0.6 }]}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.generateText}>Generating your look…</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.generateText}>Generate preview</Text>
            </>
          )}
        </Pressable>

        {/* Result */}
        {result && (
          <View style={[styles.resultCard, shadow.card]}>
            <Text style={styles.resultTitle}>"{result.style.title}" on you</Text>
            <View style={styles.beforeAfter}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Image source={{ uri: photo.uri }} style={styles.realPreview} />
                <Text style={styles.beforeAfterLabel}>BEFORE</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                {result.localImage ? (
                  <Image source={result.localImage} style={styles.realPreview} />
                ) : result.url || result.b64 ? (
                  <Image
                    source={{ uri: result.url || `data:image/png;base64,${result.b64}` }}
                    style={styles.realPreview}
                  />
                ) : (
                  <View style={[styles.realPreview, { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="cut" size={36} color={colors.primary} />
                  </View>
                )}
                <Text style={[styles.beforeAfterLabel, { color: colors.primary }]}>AFTER</Text>
              </View>
            </View>
            <Text style={styles.resultHint}>{result.style.hint}</Text>
            {result.provider && (
              <Text style={styles.providerTag}>Rendered with {result.provider}</Text>
            )}
            <Pressable style={styles.cta} onPress={() => navigation.navigate('Search')}>
              <Ionicons name="search" size={16} color="#fff" />
              <Text style={styles.ctaText}>Find barbers good at this</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Selfie picker modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={styles.root}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>Add a selfie</Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <View style={styles.pickerRow}>
              <Pressable style={[styles.bigBtn, { backgroundColor: colors.primary }]} onPress={takePhoto}>
                <Ionicons name="camera" size={22} color="#fff" />
                <Text style={styles.bigBtnText}>Take photo</Text>
              </Pressable>
              <Pressable style={[styles.bigBtn, { backgroundColor: colors.surface }]} onPress={pickFromLibrary}>
                <Ionicons name="images" size={22} color={colors.primary} />
                <Text style={[styles.bigBtnText, { color: colors.primary }]}>Choose from library</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

  hero: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: spacing.sm },
  heroSub: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 4 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  stepLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  stepHdr: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },

  selfieRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  selfieImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceMuted },
  selfieName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  linkText: { color: colors.primary, fontWeight: '700', marginTop: 4 },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: 12, borderRadius: radius.md, marginTop: spacing.sm,
  },
  uploadText: { color: '#fff', fontWeight: '800', marginLeft: 6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  styleCard: {
    width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 2, borderColor: 'transparent', position: 'relative',
  },
  stylePicked: { borderColor: colors.primary },
  styleThumb: {
    aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  styleThumbImg: { width: '100%', height: '100%', borderRadius: radius.sm },
  styleTitle: { color: colors.text, fontWeight: '700' },
  styleHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  tick: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 10 },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, marginTop: spacing.sm,
  },
  generateText: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },

  resultCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  resultTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  beforeAfter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  realPreview: { width: 130, height: 130, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  beforeAfterLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 8, letterSpacing: 1 },
  resultHint: { color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  providerTag: { color: colors.textMuted, textAlign: 'center', fontSize: 10, marginTop: 4 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: 12, borderRadius: radius.md, marginTop: spacing.md,
  },
  ctaText: { color: '#fff', fontWeight: '800', marginLeft: 6 },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  bigBtn: {
    flex: 1, paddingVertical: 18, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  bigBtnText: { color: '#fff', fontWeight: '800', marginTop: 6 },
});
