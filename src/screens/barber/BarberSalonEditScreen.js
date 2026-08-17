import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../theme/colors';
import { api } from '../../api/client';
import { useLocation } from '../../state/LocationContext';

export default function BarberSalonEditScreen({ route, navigation }) {
  const mode = route?.params?.mode || 'edit';
  const { coords, label, refresh: refreshLoc } = useLocation();
  const [loading, setLoading] = useState(mode === 'edit');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: '',
    name: '',
    category: 'Hair Salon',
    address: '',
    hours: '',
    about: '',
    lat: null,
    lng: null,
  });
  const [services, setServices] = useState([]);
  const [newSvc, setNewSvc] = useState({ title: '', duration: '30 min', price: '', details: '' });

  useEffect(() => {
    if (mode !== 'edit') return;
    (async () => {
      try {
        const data = await api.mySalon();
        if (data) {
          setForm({
            id: data.id,
            name: data.name,
            category: data.category,
            address: data.address,
            hours: data.hours || '',
            about: data.about || '',
            lat: data.lat,
            lng: data.lng,
          });
          setServices(data.services || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [mode]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const useMyLocation = async () => {
    await refreshLoc();
    if (coords) {
      update('lat', coords.lat);
      update('lng', coords.lng);
      Alert.alert('Set', `Salon pin set to your device location (${label}).`);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.category.trim()) {
      Alert.alert('Missing info', 'Name, category and address are required.');
      return;
    }
    if (form.lat == null || form.lng == null) {
      Alert.alert('Location required', 'Tap "Use my current location" so customers can find you.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'create') {
        const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Date.now();
        await api.createSalon({ ...form, id });
      } else {
        await api.updateSalon(form);
      }
      Alert.alert('Saved', 'Your salon details are up to date.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const addService = async () => {
    if (!newSvc.title.trim() || !newSvc.price) {
      Alert.alert('Missing info', 'Title and price are required.');
      return;
    }
    try {
      const id = newSvc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now();
      await api.addService({
        id,
        title: newSvc.title.trim(),
        duration: newSvc.duration.trim() || '30 min',
        details: newSvc.details.trim(),
        price: parseFloat(newSvc.price),
      });
      const data = await api.mySalon();
      setServices(data.services || []);
      setNewSvc({ title: '', duration: '30 min', price: '', details: '' });
    } catch (e) {
      Alert.alert('Could not add', e.message);
    }
  };

  const removeService = (id) =>
    Alert.alert('Delete service?', 'Customers will no longer see it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.removeService(id);
          const data = await api.mySalon();
          setServices(data.services || []);
        },
      },
    ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{mode === 'create' ? 'Create salon' : 'Edit salon'}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          <Field label="Salon name" value={form.name} onChangeText={(v) => update('name', v)} />
          <Field label="Category" value={form.category} onChangeText={(v) => update('category', v)}
            helper="e.g. Hair Salon, Nails, Eyebrows & Lashes" />
          <Field label="Address" value={form.address} onChangeText={(v) => update('address', v)} />
          <Field label="Opening hours" value={form.hours} onChangeText={(v) => update('hours', v)}
            helper="e.g. Open today 10:00 AM – 10:00 PM" />
          <Field label="About" value={form.about} onChangeText={(v) => update('about', v)} multiline />

          <View style={[styles.card, shadow.card]}>
            <Text style={styles.cardTitle}>Location pin</Text>
            <Text style={styles.cardSub}>
              {form.lat != null
                ? `Saved: ${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`
                : 'No location set yet.'}
            </Text>
            <Pressable onPress={useMyLocation} style={styles.locBtn}>
              <Ionicons name="locate" size={16} color="#fff" />
              <Text style={styles.locBtnText}>Use my current location</Text>
            </Pressable>
          </View>

          {mode === 'edit' && (
            <View style={[styles.card, shadow.card]}>
              <Text style={styles.cardTitle}>Services</Text>
              {services.length === 0 ? (
                <Text style={styles.cardSub}>No services yet.</Text>
              ) : (
                services.map((s) => (
                  <View key={s.id} style={styles.svcRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.svcTitle}>{s.title}</Text>
                      <Text style={styles.svcMeta}>{s.duration} · {s.details}</Text>
                    </View>
                    <Text style={styles.svcPrice}>{s.price} EGP</Text>
                    <Pressable onPress={() => removeService(s.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                ))
              )}
              <Text style={[styles.cardTitle, { marginTop: spacing.md, fontSize: 14 }]}>Add a service</Text>
              <Field placeholder="Title" value={newSvc.title} onChangeText={(v) => setNewSvc({ ...newSvc, title: v })} />
              <Field placeholder="Duration (e.g. 45 min)" value={newSvc.duration}
                onChangeText={(v) => setNewSvc({ ...newSvc, duration: v })} />
              <Field placeholder="Details" value={newSvc.details}
                onChangeText={(v) => setNewSvc({ ...newSvc, details: v })} />
              <Field placeholder="Price (EGP)" value={newSvc.price}
                onChangeText={(v) => setNewSvc({ ...newSvc, price: v })} keyboardType="numeric" />
              <Pressable onPress={addService} style={[styles.locBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.locBtnText}>Add service</Text>
              </Pressable>
            </View>
          )}

          <Pressable onPress={save} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, helper, ...rest }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, rest.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        {...rest}
      />
      {helper && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },
  label: { color: colors.text, fontWeight: '700', marginBottom: 6 },
  helper: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border, color: colors.text,
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.h2, color: colors.text },
  cardSub: { color: colors.textMuted, marginTop: 4 },

  locBtn: {
    marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight, paddingVertical: 10, borderRadius: radius.md,
  },
  locBtnText: { color: '#fff', marginLeft: 6, fontWeight: '700' },

  svcRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  svcTitle: { color: colors.text, fontWeight: '700' },
  svcMeta: { color: colors.textMuted, fontSize: 12 },
  svcPrice: { color: colors.primary, fontWeight: '800' },

  saveBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
