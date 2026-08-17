import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { useAuth } from '../state/AuthContext';

export default function SignUpScreen({ navigation }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [role, setRole] = useState('customer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Name, email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,
        role,
        referralCode: referral.trim() ? referral.trim().toUpperCase() : null,
      });
    } catch (e) {
      setError(e.message || 'Could not sign up');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={{ color: colors.text, marginLeft: 4 }}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join Salony in a few seconds.</Text>

          <View style={styles.roleRow}>
            <RoleTile
              icon="person"
              label="Customer"
              caption="Book grooming appointments"
              active={role === 'customer'}
              onPress={() => setRole('customer')}
            />
            <RoleTile
              icon="cut"
              label="Barber"
              caption="Manage your salon & clients"
              active={role === 'barber'}
              onPress={() => setRole('barber')}
            />
          </View>

          <View style={[styles.card, shadow.card]}>
            <Field icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} />
            <Field
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              icon="call-outline"
              placeholder="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Password (min 6 chars)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {role === 'customer' && (
              <Field
                icon="gift-outline"
                placeholder="Referral code (optional)"
                value={referral}
                onChangeText={setReferral}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            )}

            {error && <Text style={styles.err}>{error}</Text>}

            <Pressable onPress={onSubmit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create account</Text>}
            </Pressable>
          </View>

          <Pressable onPress={() => navigation.navigate('SignIn')} style={styles.linkRow} hitSlop={10}>
            <Text style={styles.linkLabel}>
              Already have an account? <Text style={styles.link}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ icon, ...rest }) {
  return (
    <View style={styles.fieldWrap}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <TextInput {...rest} placeholderTextColor={colors.textMuted} style={styles.input} />
    </View>
  );
}

function RoleTile({ icon, label, caption, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, active && styles.tileActive]}
    >
      <Ionicons name={icon} size={22} color={active ? '#fff' : colors.primary} />
      <Text style={[styles.tileLabel, active && { color: '#fff' }]}>{label}</Text>
      <Text style={[styles.tileCaption, active && { color: 'rgba(255,255,255,0.8)' }]}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.display, color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },

  roleRow: { flexDirection: 'row', marginBottom: spacing.lg },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'flex-start',
  },
  tileActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileLabel: { ...typography.h2, color: colors.text, marginTop: 8 },
  tileCaption: { color: colors.textMuted, marginTop: 2, fontSize: 12 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, paddingVertical: 12, marginLeft: 8, color: colors.text },
  err: { color: colors.danger, marginBottom: spacing.sm },

  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  linkRow: { marginTop: spacing.lg, alignItems: 'center' },
  linkLabel: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '700' },
});
