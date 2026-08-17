import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { useLocation } from '../state/LocationContext';
import { useLoyalty } from '../state/LoyaltyContext';
import { api } from '../api/client';

const extra = Constants?.expoConfig?.extra || {};

async function openUrl(url, fallbackLabel) {
  if (!url) return Alert.alert(fallbackLabel || 'Not available', 'This link is not configured yet.');
  const supported = await Linking.canOpenURL(url);
  if (supported) Linking.openURL(url);
  else Alert.alert('Cannot open link', url);
}

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { label, source } = useLocation();
  const { points, tier, subscription } = useLoyalty();
  const [notifications, setNotifications] = React.useState(true);
  const [reminders, setReminders] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);

  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your Salony account, bookings, points, and saved data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              await api.deleteAccount();
              await signOut();
            } catch (e) {
              setDeleting(false);
              Alert.alert('Could not delete account', e.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const NAV = [
    { id: 'rewards', icon: 'star-outline', label: `Rewards · ${points} pts`, go: () => navigation.navigate('Tabs', { screen: 'Rewards' }) },
    { id: 'plus', icon: 'diamond-outline', label: subscription?.active ? 'Salony Plus · Active' : 'Join Salony Plus', go: () => navigation.navigate('Plus') },
    { id: 'referral', icon: 'gift-outline', label: 'Refer a friend (+50 pts)', go: () => navigation.navigate('Referral') },
    { id: 'fav', icon: 'heart-outline', label: 'Favourites', go: () => navigation.navigate('Favourites') },
    { id: 'msg', icon: 'chatbubble-outline', label: 'Messages', go: () => navigation.navigate('Messages') },
  ];

  const MENU = [
    { id: 'edit', icon: 'person-outline', label: 'Edit profile', go: () => navigation.navigate('EditProfile') },
    { id: 'location', icon: 'location-outline', label: `Location · ${label}`, go: () => navigation.navigate('LocationPicker') },
    { id: 'support', icon: 'help-circle-outline', label: 'Help & Support',
      go: () => openUrl(extra.supportUrl, 'Help & Support') },
    { id: 'terms', icon: 'document-text-outline', label: 'Terms & Privacy',
      go: () => openUrl(extra.privacyPolicyUrl, 'Terms & Privacy') },
    { id: 'about', icon: 'information-circle-outline',
      label: `Salony v${Constants?.expoConfig?.version || '1.0.0'}`,
      go: () => Alert.alert(
        'About Salony',
        `Version ${Constants?.expoConfig?.version || '1.0.0'}\nEnvironment: ${extra.env || 'development'}\nAPI: ${extra.apiUrl || 'http://localhost:4000'}`,
      ),
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'You'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {tier && (
            <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
              <Ionicons name="medal" size={12} color="#fff" />
              <Text style={styles.tierText}>{tier.label.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={[styles.card, shadow.card]}>
          {NAV.map((m, i) => (
            <SettingRow
              key={m.id}
              icon={m.icon}
              label={m.label}
              divider={i < NAV.length - 1}
              right={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
              onPress={m.go}
            />
          ))}
        </View>

        <View style={[styles.card, shadow.card]}>
          <SettingRow
            icon="notifications-outline" label="Push notifications"
            right={<Switch value={notifications} onValueChange={setNotifications}
              trackColor={{ true: colors.primary, false: colors.disabled }} thumbColor="#fff" />}
          />
          <SettingRow
            icon="alarm-outline" label="Appointment reminders" divider={false}
            right={<Switch value={reminders} onValueChange={setReminders}
              trackColor={{ true: colors.primary, false: colors.disabled }} thumbColor="#fff" />}
          />
        </View>

        <View style={[styles.card, shadow.card]}>
          {MENU.map((m, i) => (
            <SettingRow
              key={m.id}
              icon={m.icon}
              label={m.label}
              divider={i < MENU.length - 1}
              right={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
              onPress={m.go}
            />
          ))}
        </View>

        <Pressable
          style={styles.signOut}
          onPress={() => Alert.alert('Sign out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: signOut },
          ])}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Pressable
          style={styles.deleteAccount}
          disabled={deleting}
          onPress={confirmDeleteAccount}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          <Text style={styles.deleteAccountText}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </Text>
        </Pressable>

        <Text style={styles.version}>Salony v{Constants?.expoConfig?.version || '1.0.0'} · {source.toUpperCase()} location</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ icon, label, right, divider = true, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.settingRow, divider && styles.divider]}>
      <View style={styles.iconBubble}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.settingLabel} numberOfLines={1}>{label}</Text>
      <View style={{ marginLeft: 'auto' }}>{right}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', padding: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { ...typography.h1, color: colors.text },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, marginTop: 8,
  },
  tierText: { color: '#fff', fontWeight: '800', fontSize: 11, marginLeft: 4, letterSpacing: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingHorizontal: spacing.md,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBubble: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  settingLabel: { color: colors.text, fontWeight: '600', flexShrink: 1, flex: 1 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginTop: spacing.md },
  signOutText: { color: colors.danger, marginLeft: 6, fontWeight: '700' },
  deleteAccount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  deleteAccountText: { color: colors.textMuted, marginLeft: 6, fontWeight: '600', fontSize: 13 },
  version: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.md, fontSize: 11 },
});
