import './src/lib/webAlert';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/state/AuthContext';
import { LocationProvider } from './src/state/LocationContext';
import { LoyaltyProvider } from './src/state/LoyaltyContext';
import { CartProvider } from './src/state/CartContext';
import { FavouritesProvider } from './src/state/FavouritesContext';
import { BookingsProvider } from './src/state/BookingsContext';
import { navTheme } from './src/theme/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
      <AuthProvider>
        <LocationProvider>
          <LoyaltyProvider>
            <CartProvider>
              <FavouritesProvider>
                <BookingsProvider>
                  <NavigationContainer theme={navTheme}>
                    <StatusBar style="light" />
                    <RootNavigator />
                  </NavigationContainer>
                </BookingsProvider>
              </FavouritesProvider>
            </CartProvider>
          </LoyaltyProvider>
        </LocationProvider>
      </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
