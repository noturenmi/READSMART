import React, { useState } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { AuthField, AuthLink, ErrorMessage, PrimaryButton } from '../components/AuthForm';
import { useAuth } from '../auth/AuthContext';

export function LoginScreen({ navigation, initialError }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title="Sign in"
      description="Continue your reading and writing practice."
    >
      <ErrorMessage message={error} />
      <AuthField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" onSubmitEditing={submit} returnKeyType="done" />
      <PrimaryButton title="Sign in" loading={loading} onPress={submit} />
      <AuthLink prompt="New to READSMART?" label="Create student account" onPress={() => navigation.navigate('Register')} />
    </AuthLayout>
  );
}
