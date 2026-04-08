import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.8, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    toggleTheme();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {isDark ? (
          <Sun size={20} color={colors.accent} />
        ) : (
          <Moon size={20} color={colors.accent} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});
