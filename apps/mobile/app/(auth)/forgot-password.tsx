import { useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@prostcounter/shared/schemas';

import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AuthHeader, FormInput } from '@/components/auth';
import { useAuth } from '@/lib/auth/AuthContext';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    const { error: resetError } = await resetPassword(data.email);

    if (resetError) {
      setError(
        resetError.message ||
          t('auth.forgotPassword.errors.generic', {
            defaultValue: 'Failed to send reset email',
          })
      );
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="px-6"
        >
          {/* Header with Logo */}
          <View className="mt-4 mb-6">
            <AuthHeader size="sm" />
          </View>

          {/* Title */}
          <Text className="text-2xl font-bold text-typography-900 text-center mb-2">
            {t('auth.resetPassword.title')}
          </Text>

          {/* Description */}
          <Text className="text-typography-500 text-center mb-8 px-4">
            {t('auth.resetPassword.description', {
              defaultValue:
                "Enter your email address and we'll send you instructions to reset your password.",
            })}
          </Text>

          {/* Success State */}
          {success ? (
            <View className="items-center">
              <View className="bg-success-50 p-4 rounded-lg mb-6 w-full">
                <Text className="text-success-700 text-center">
                  {t('auth.resetPassword.success')}
                </Text>
              </View>

              <Button
                action="primary"
                variant="solid"
                size="lg"
                onPress={() => router.replace('/(auth)/sign-in')}
                className="rounded-full px-8"
              >
                <ButtonText>{t('auth.resetPassword.backToSignIn')}</ButtonText>
              </Button>
            </View>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <View className="mb-4 rounded-lg bg-error-50 p-3">
                  <Text className="text-center text-error-600">{error}</Text>
                </View>
              )}

              {/* Form */}
              <View className="w-full">
                <FormInput
                  control={control}
                  name="email"
                  label={t('auth.resetPassword.emailLabel')}
                  placeholder={t('auth.resetPassword.emailPlaceholder')}
                  keyboardType="email-address"
                  autoComplete="email"
                  autoFocus
                  error={errors.email?.message}
                  disabled={isLoading}
                />

                {/* Send Instructions Button */}
                <Button
                  action="primary"
                  variant="solid"
                  size="lg"
                  onPress={handleSubmit(onSubmit)}
                  disabled={isLoading}
                  className="mt-2 rounded-full"
                >
                  {isLoading ? (
                    <ButtonSpinner color="#FFFFFF" />
                  ) : (
                    <ButtonText>{t('auth.resetPassword.submit')}</ButtonText>
                  )}
                </Button>
              </View>
            </>
          )}

          {/* Back to Sign In Link */}
          <View className="mt-8 items-center">
            <Pressable onPress={() => router.push('/(auth)/sign-in')}>
              <Text className="text-primary-600 font-semibold">
                {t('auth.resetPassword.backToSignIn')}
              </Text>
            </Pressable>
          </View>

          {/* Spacer */}
          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
