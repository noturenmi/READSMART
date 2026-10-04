import React, { useState } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { AuthField, AuthLink, ErrorMessage, PrimaryButton } from '../components/AuthForm';
import { useAuth } from '../auth/AuthContext';

export function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="START LEARNING"
      title="Create your account"
      description="Join as a student to begin your READSMART journey."
    >
      <ErrorMessage message={error} />
      <AuthField label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="next" />
      <AuthField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} returnKeyType="done" />
      <PrimaryButton title="Create student account" loading={loading} onPress={submit} />
      <AuthLink prompt="Already registered?" label="Sign in" onPress={() => navigation.navigate('Login')} />
    </AuthLayout>
  );
}
