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

export default function SignInScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setBusy(true);
    try {
      await login({ email: email.trim(), password });
    } catch (e) {
      setError(e.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="cut" size={32} color="#fff" />
            </View>
            <Text style={styles.brandName}>Salony</Text>
            <Text style={styles.brandTag}>Grooming, booked in seconds.</Text>
          </View>

          <View style={[styles.card, shadow.card]}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

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
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error && <Text style={styles.err}>{error}</Text>}

            <Pressable onPress={onSubmit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Sign in</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('SignUp')}
              style={styles.linkRow}
              hitSlop={10}
            >
              <Text style={styles.linkLabel}>
                New here? <Text style={styles.link}>Create an account</Text>
              </Text>
            </Pressable>


          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ icon, ...rest }) {
  return (
    <View style={styles.fieldWrap}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <TextInput
        {...rest}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  brand: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  logo: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  brandName: { ...typography.display, color: colors.text, marginTop: spacing.md },
  brandTag: { color: colors.textMuted, marginTop: 4 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },

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

  demoBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  demoTitle: { fontWeight: '700', color: colors.text, marginBottom: 4 },
  demoLine: { color: colors.textMuted, fontSize: 12 },
});
