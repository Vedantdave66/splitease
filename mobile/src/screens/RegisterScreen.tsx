import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../services/api';
import { Wallet, ArrowLeft } from 'lucide-react-native';

export default function RegisterScreen({ navigation }: any) {
    const { login } = useAuth();
    const { colors, isDark } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async () => {
        if (!name || !email || !password) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await authApi.register(name.trim(), email.trim(), password);
            await login(res.access_token);
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    <ArrowLeft size={20} color={colors.secondaryText} />
                </TouchableOpacity>

                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={[styles.logoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Wallet size={32} color={colors.accent} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
                        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Join Tandem today</Text>
                    </View>

                    {error ? (
                        <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(220, 38, 38, 0.05)', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.2)' }]}>
                            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                            placeholder="John Doe"
                            placeholderTextColor={colors.secondaryText}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />

                        <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                            placeholder="you@example.com"
                            placeholderTextColor={colors.secondaryText}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        <Text style={[styles.label, { color: colors.text }]}>Password</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                            placeholder="••••••••"
                            placeholderTextColor={colors.secondaryText}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.accent }, loading && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={isDark ? "#064E3B" : "white"} />
                            ) : (
                                <Text style={[styles.buttonText, { color: isDark ? "#064E3B" : "white" }]}>Sign Up</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: colors.secondaryText }]}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={[styles.footerLink, { color: colors.accent }]}>Sign in</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    backButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        zIndex: 10,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
    },
    form: {
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 20,
    },
    button: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorBox: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    footerText: {
        fontSize: 14,
    },
    footerLink: {
        fontSize: 14,
        fontWeight: 'bold',
    },
});
