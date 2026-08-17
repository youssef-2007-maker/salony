import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/colors';
import { api } from '../api/client';

export default function MessagesScreen({ navigation }) {
  const [threads, setThreads] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.messages();
      setThreads(data);
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>
      <FlatList
        data={threads}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const initials = item.salonName.split(' ').slice(0, 2).map((w) => w[0]).join('');
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('SalonDetail', { salonId: item.salonId })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.body}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{item.salonName}</Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.preview} numberOfLines={1}>{item.preview}</Text>
                  {item.unread && <View style={styles.dot} />}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubble-outline" size={42} color={colors.textMuted} />
            <Text style={styles.emptyText}>No messages yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { ...typography.display, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { color: '#fff', fontWeight: '800' },
  body: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  name: { ...typography.h2, color: colors.text },
  time: { ...typography.small, color: colors.textMuted },
  preview: { ...typography.body, color: colors.textMuted, flex: 1, marginRight: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: colors.textMuted, marginTop: 12 },
});
