import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import AuthNavigator from './AuthNavigator';
import BarberNavigator from './BarberNavigator';
import SalonDetailScreen from '../screens/SalonDetailScreen';
import BookingScreen from '../screens/BookingScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import CategoryScreen from '../screens/CategoryScreen';
import SearchScreen from '../screens/SearchScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FavouritesScreen from '../screens/FavouritesScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ReferralScreen from '../screens/ReferralScreen';
import PlusSubscriptionScreen from '../screens/PlusSubscriptionScreen';
import ProductScreen from '../screens/ProductScreen';
import CartScreen from '../screens/CartScreen';
import ReviewScreen from '../screens/ReviewScreen';
import PaymentSheet from '../screens/PaymentSheet';
import { useAuth } from '../state/AuthContext';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

function Loading() {
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 }}>
      <ActivityIndicator color={colors.primary} size="large" />
      {showHint && (
        <Text style={{ color: colors.textMuted, marginTop: 16, textAlign: 'center', lineHeight: 20 }}>
          Taking a while…{'\n'}
          Make sure the backend is running: <Text style={{ fontWeight: '700' }}>npm start</Text> inside <Text style={{ fontWeight: '700' }}>backend/</Text>.
        </Text>
      )}
    </View>
  );
}

export default function RootNavigator() {
  const { user, loading, role } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) return <AuthNavigator />;
  if (role === 'barber') return <BarberNavigator />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="SalonDetail" component={SalonDetailScreen} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      <Stack.Screen name="Plus" component={PlusSubscriptionScreen} />
      <Stack.Screen name="Product" component={ProductScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen
        name="LocationPicker"
        component={LocationPickerScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentSheet}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Review"
        component={ReviewScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="BookingConfirmation"
        component={BookingConfirmationScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
