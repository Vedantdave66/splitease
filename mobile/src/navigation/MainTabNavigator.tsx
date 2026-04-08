import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CustomTabBar from '../components/CustomTabBar';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                // Ensures the screens draw behind the absolute positioned transparent tab bar
                lazy: true,
            }}
        >
            <Tab.Screen name="Home" component={DashboardScreen} />
            <Tab.Screen name="Payments" component={PaymentsScreen} />
            <Tab.Screen name="Friends" component={FriendsScreen} />
            <Tab.Screen name="Activity" component={NotificationsScreen} />
        </Tab.Navigator>
    );
}
