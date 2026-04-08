import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Send, Users, Bell } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { colors, isDark } = useTheme();

    return (
        <View style={styles.tabBarContainer}>
            <View 
                style={[styles.blurStyle, { 
                    backgroundColor: isDark ? 'rgba(17, 19, 24, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }]}
            >
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name, route.params);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    let IconComponent = Home;
                    if (route.name === 'Home') IconComponent = Home;
                    else if (route.name === 'Payments') IconComponent = Send;
                    else if (route.name === 'Friends') IconComponent = Users;
                    else if (route.name === 'Activity') IconComponent = Bell;

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={(options as any).tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={styles.tabItem}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.iconWrapper, 
                                isFocused && { 
                                    backgroundColor: colors.accent + '20', // 20% opacity of accent
                                }
                            ]}>
                                <IconComponent 
                                    size={24} 
                                    color={isFocused ? colors.accent : colors.secondaryText} 
                                    strokeWidth={isFocused ? 2.5 : 2}
                                />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 20,
        left: 20,
        right: 20,
        height: 65,
        borderRadius: 35,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            }
        }),
    },
    blurStyle: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        borderWidth: 1,
        borderRadius: 35,
        overflow: 'hidden',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
