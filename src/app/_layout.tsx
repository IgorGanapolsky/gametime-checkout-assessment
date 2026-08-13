import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { EnvironmentProvider } from '../context/EnvironmentContext';
import { CheckoutProvider } from '../context/CheckoutContext';

export default function RootLayout() {
  return (
    <EnvironmentProvider>
      <CheckoutProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0F172A',
            },
            headerTintColor: '#F8FAFC',
            headerTitleStyle: {
              fontWeight: '800',
            },
            contentStyle: {
              backgroundColor: '#090D16',
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'Gametime Checkout',
            }}
          />
        </Stack>
      </CheckoutProvider>
    </EnvironmentProvider>
  );
}
