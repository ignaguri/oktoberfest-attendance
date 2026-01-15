import {
  AuthHeader,
  FormInput,
  OAuthButtons,
  OrDivider,
  AuthFooterLink,
} from "@/components/auth";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth/AuthContext";
import { IconColors } from "@/lib/constants/colors";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  signUpSchema,
  type SignUpFormData,
} from "@prostcounter/shared/schemas";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signUp, signInWithGoogle, signInWithFacebook, signInWithApple } =
    useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(null);

    const { error: signUpError } = await signUp(data.email, data.password);

    if (signUpError) {
      setError(signUpError.message || t("auth.signUp.errors.generic"));
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    setIsGoogleLoading(false);

    if (error && error.message !== "Authentication was cancelled") {
      setError(t("auth.signIn.errors.providerFailed", { provider: "Google" }));
    }
  };

  const handleFacebookSignIn = async () => {
    setIsFacebookLoading(true);
    setError(null);
    const { error } = await signInWithFacebook();
    setIsFacebookLoading(false);

    if (error && error.message !== "Authentication was cancelled") {
      setError(
        t("auth.signIn.errors.providerFailed", { provider: "Facebook" }),
      );
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    setError(null);
    const { error } = await signInWithApple();
    setIsAppleLoading(false);

    if (error && error.message !== "Authentication was cancelled") {
      setError(t("auth.signIn.errors.providerFailed", { provider: "Apple" }));
    }
  };

  const isAnyLoading =
    isLoading || isGoogleLoading || isFacebookLoading || isAppleLoading;

  // Success state - show confirmation message
  if (success) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background-0 p-6">
        <AuthHeader size="sm" />

        <View className="mt-8 items-center">
          <Text className="mb-4 text-center text-2xl font-bold text-typography-900">
            {t("auth.signUp.accountCreated", {
              defaultValue: "Account created",
            })}
          </Text>
          <Text className="mb-8 px-4 text-center text-typography-500">
            {t("auth.signUp.success.checkEmail")}
          </Text>
          <Button
            action="primary"
            variant="solid"
            size="lg"
            onPress={() => router.replace("/(auth)/sign-in")}
            className="rounded-full px-8"
          >
            <ButtonText>{t("auth.resetPassword.backToSignIn")}</ButtonText>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="px-6"
        >
          {/* Header with Logo */}
          <View className="mb-6 mt-4">
            <AuthHeader size="sm" />
          </View>

          {/* Title */}
          <Text className="mb-6 text-center text-2xl font-bold text-typography-900">
            {t("auth.signUp.title")}
          </Text>

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
              label={t("auth.signUp.emailLabel")}
              placeholder={t("auth.signUp.emailPlaceholder")}
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              error={errors.email?.message}
              disabled={isAnyLoading}
            />

            <FormInput
              control={control}
              name="password"
              label={t("auth.signUp.passwordLabel")}
              placeholder={t("auth.signUp.passwordPlaceholder", {
                defaultValue: "Create a password",
              })}
              secureTextEntry
              autoComplete="password-new"
              error={errors.password?.message}
              disabled={isAnyLoading}
            />

            <FormInput
              control={control}
              name="confirmPassword"
              label={t("auth.signUp.confirmPasswordLabel")}
              placeholder={t("auth.signUp.confirmPasswordPlaceholder", {
                defaultValue: "Confirm your password",
              })}
              secureTextEntry
              autoComplete="password-new"
              error={errors.confirmPassword?.message}
              disabled={isAnyLoading}
            />

            {/* Create Account Button */}
            <Button
              action="primary"
              variant="solid"
              size="lg"
              onPress={handleSubmit(onSubmit)}
              disabled={isAnyLoading}
              className="mt-2 rounded-full"
            >
              {isLoading ? (
                <ButtonSpinner color={IconColors.white} />
              ) : (
                <ButtonText>{t("auth.signUp.submit")}</ButtonText>
              )}
            </Button>
          </View>

          {/* Or Divider */}
          <OrDivider />

          {/* OAuth Buttons */}
          <OAuthButtons
            onGooglePress={handleGoogleSignIn}
            onFacebookPress={handleFacebookSignIn}
            onApplePress={handleAppleSignIn}
            isGoogleLoading={isGoogleLoading}
            isFacebookLoading={isFacebookLoading}
            isAppleLoading={isAppleLoading}
            disabled={isAnyLoading}
          />

          {/* Sign In Link */}
          <AuthFooterLink
            prefix={t("auth.signUp.hasAccount")}
            linkText={t("auth.signUp.signInLink")}
            href="/(auth)/sign-in"
          />

          {/* Spacer */}
          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
