import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/colors';
import { useFavourites } from '../state/FavouritesContext';
import SalonCard from '../components/SalonCard';

export default function FavouritesScreen({ navigation }) {
  const { list, refresh } = useFavourites();
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.title}>Favourites</Text>
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <SalonCard wide salon={item} onPress={() => navigation.navigate('SalonDetail', { salonId: item.id })} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              No favourites yet. Tap the heart on a salon to save it here.
            </Text>
            <Pressable onPress={() => navigation.navigate('Home')} style={styles.btn}>
              <Text style={styles.btnText}>Browse salons</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { ...typography.display, color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  empty: { alignItems: 'center', marginTop: 64, paddingHorizontal: 24 },
  emptyText: { color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  btn: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
});
