import React, { useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions,
  FlatList,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, Receipt, TrendingUp, Send, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'hero',
    title: 'Split expenses.\nSettle instantly.',
    subtitle: 'Say goodbye to awkward money conversations. Track shared expenses, simplify group balances, and settle up securely.',
    icon: Wallet,
    color: '#16A34A',
    bg: 'rgba(22, 163, 74, 0.1)',
  },
  {
    id: 'log',
    title: 'Log Expenses',
    subtitle: 'Who paid for what? Add expenses quickly and choose how to split them: equally or by exact amounts.',
    icon: Receipt,
    color: '#FBBF24',
    bg: 'rgba(251, 191, 36, 0.1)',
  },
  {
    id: 'balances',
    title: 'Smart Balances',
    subtitle: 'Tandem calculates debts automatically. We show you the minimum transactions needed to settle up.',
    icon: TrendingUp,
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.1)',
  },
  {
    id: 'settle',
    title: 'Pay Through App',
    subtitle: 'Pay your friends directly within Tandem and instantly mark balances as settled. Secure and fast.',
    icon: Send,
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.1)',
  }
];

export default function LandingScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      navigation.navigate('Register');
    }
  };

  const renderItem = ({ item, index }: any) => {
    const Icon = item.icon;
    return (
      <View style={[styles.slide, { width }]}>
        <View style={[styles.iconCircle, { backgroundColor: item.bg, borderColor: item.bg.replace('0.1', '0.2') }]}>
          <Icon size={48} color={item.color} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {item.id === 'hero' ? (
            <>Split expenses.{'\n'}<Text style={{ color: colors.accent }}>Settle instantly.</Text></>
          ) : item.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
          {item.subtitle}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.nav}>
        <View style={styles.logoRow}>
          <LinearGradient colors={['#16A34A', '#10B981']} style={styles.logoIcon}>
            <Wallet size={20} color="white" />
          </LinearGradient>
          <Text style={[styles.logoText, { color: colors.text }]}>Tandem</Text>
        </View>
        <ThemeToggle />
      </View>

      <FlatList
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={32}
        ref={slidesRef}
      />

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity, backgroundColor: colors.accent }
                ]}
              />
            );
          })}
        </View>

        <View style={styles.buttonRow}>
          {currentIndex === SLIDES.length - 1 ? (
            <>
              <TouchableOpacity 
                style={[styles.loginBtn, { borderColor: colors.border }]} 
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={[styles.loginText, { color: colors.text }]}>Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.registerBtn} onPress={() => navigation.navigate('Register')}>
                <LinearGradient colors={['#4ADE80', '#10B981']} style={styles.gradientBtn}>
                  <Text style={styles.registerText}>Sign Up</Text>
                  <ChevronRight size={20} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.nextBtn} onPress={scrollToNext}>
               <Text style={[styles.nextText, { color: colors.text }]}>Next</Text>
               <ChevronRight size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    borderWidth: 1,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    height: 60,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  nextText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  loginText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerBtn: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  registerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
