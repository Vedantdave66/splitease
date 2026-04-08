import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import MainTabNavigator from './MainTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import LandingScreen from '../screens/LandingScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    const { user, loading } = useAuth();
    const { theme, colors, isDark } = useTheme();

    if (loading) {
        return null; // Or a splash screen
    }

    const navigationTheme = {
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            notification: colors.accent,
        },
    };

    return (
        <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator 
                screenOptions={{ 
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background }
                }}
            >
                {!user ? (
                    // Unauthenticated Stack
                    <Stack.Group>
                        <Stack.Screen name="Landing" component={LandingScreen} />
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                    </Stack.Group>
                ) : (
                    // Authenticated Stack
                    <Stack.Group>
                        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                        <Stack.Screen name="Group" component={GroupDetailScreen} />
                    </Stack.Group>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
