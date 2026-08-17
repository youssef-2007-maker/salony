import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import BarberDashboardScreen from '../screens/barber/BarberDashboardScreen';
import BarberBookingsScreen from '../screens/barber/BarberBookingsScreen';
import BarberAnalyticsScreen from '../screens/barber/BarberAnalyticsScreen';
import BarberProfileScreen from '../screens/barber/BarberProfileScreen';
import BarberSalonEditScreen from '../screens/barber/BarberSalonEditScreen';
import BarberPremiumScreen from '../screens/barber/BarberPremiumScreen';
import BarberCRMScreen from '../screens/barber/BarberCRMScreen';
import BarberCustomerScreen from '../screens/barber/BarberCustomerScreen';
import BarberDealsScreen from '../screens/barber/BarberDealsScreen';
import BarberSettingsScreen from '../screens/barber/BarberSettingsScreen';
import BarberAIMarketingScreen from '../screens/barber/BarberAIMarketingScreen';
import BarberTaxScreen from '../screens/barber/BarberTaxScreen';
import BarberStaffScreen from '../screens/barber/BarberStaffScreen';
import BarberMiniSiteScreen from '../screens/barber/BarberMiniSiteScreen';
import BarberProductsScreen from '../screens/barber/BarberProductsScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONS = {
  Dashboard: 'speedometer',
  Bookings: 'calendar',
  Insights: 'stats-chart',
  Grow: 'rocket',
  Profile: 'person',
};

function BarberTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={BarberDashboardScreen} />
      <Tab.Screen name="Bookings" component={BarberBookingsScreen} />
      <Tab.Screen name="Insights" component={BarberAnalyticsScreen} />
      <Tab.Screen name="Grow" component={BarberPremiumScreen} />
      <Tab.Screen name="Profile" component={BarberProfileScreen} />
    </Tab.Navigator>
  );
}

export default function BarberNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BarberTabs" component={BarberTabs} />
      <Stack.Screen name="BarberSalonEdit" component={BarberSalonEditScreen} />
      <Stack.Screen name="BarberPremium" component={BarberPremiumScreen} />
      <Stack.Screen name="BarberCRM" component={BarberCRMScreen} />
      <Stack.Screen name="BarberCustomer" component={BarberCustomerScreen} />
      <Stack.Screen name="BarberDeals" component={BarberDealsScreen} />
      <Stack.Screen name="BarberSettings" component={BarberSettingsScreen} />
      <Stack.Screen name="BarberAIMarketing" component={BarberAIMarketingScreen} />
      <Stack.Screen name="BarberTax" component={BarberTaxScreen} />
      <Stack.Screen name="BarberStaff" component={BarberStaffScreen} />
      <Stack.Screen name="BarberMiniSite" component={BarberMiniSiteScreen} />
      <Stack.Screen name="BarberProducts" component={BarberProductsScreen} />
      <Stack.Screen
        name="LocationPicker"
        component={LocationPickerScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
