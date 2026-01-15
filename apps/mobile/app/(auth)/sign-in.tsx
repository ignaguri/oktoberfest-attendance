import {
  AuthHeader,
  FormInput,
  OAuthButtons,
  OrDivider,
  AuthFooterLink,
  BiometricPrompt,
  BiometricEnablePrompt,
} from "@/components/auth";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useBiometrics } from "@/hooks/useBiometrics";
import { useAuth } from "@/lib/auth/AuthContext";
import { getStoredUserEmail } from "@/lib/auth/secure-storage";
import { IconColors } from "@/lib/constants/colors";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  signInSchema,
  type SignInFormData,
} from "@prostcounter/shared/schemas";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithFacebook, signInWithApple } =
    useAuth();

  const {
    isAvailable: isBiometricAvailable,
    biometricType,
    isEnabled: isBiometricEnabled,
    authenticate: authenticateBiometric,
    enableBiometrics,
  } = useBiometrics();

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Biometric prompt states
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showBiometricEnablePrompt, setShowBiometricEnablePrompt] =
    useState(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] =
    useState(false);
  const [storedEmail, setStoredEmail] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Check for stored email and biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const email = await getStoredUserEmail();
      setStoredEmail(email);

      // Show biometric prompt if available, enabled, and user has signed in before
      if (isBiometricAvailable && isBiometricEnabled && email) {
        setShowBiometricPrompt(true);
      }
    };

    checkBiometric();
  }, [isBiometricAvailable, isBiometricEnabled]);

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await signIn(data.email, data.password);

    if (signInError) {
      setError(t("auth.signIn.errors.invalidCredentials"));
      setIsLoading(false);
      return;
    }

    // Show biometric enable prompt if available but not enabled
    if (isBiometricAvailable && !isBiometricEnabled) {
      setShowBiometricEnablePrompt(true);
      setIsLoading(false);
      return;
    }

    // Navigate to main app
    router.replace("/(tabs)");
  };

  const handleBiometricAuth = async () => {
    setIsBiometricAuthenticating(true);
    const { success, error } = await authenticateBiometric();
    setIsBiometricAuthenticating(false);

    if (success && storedEmail) {
      // For biometric auth, we need the stored session
      // The session should already be restored from secure storage
      setShowBiometricPrompt(false);
      router.replace("/(tabs)");
    } else if (error) {
      setShowBiometricPrompt(false);
      setError(error);
    }
  };

  const handleUsePasword = () => {
    setShowBiometricPrompt(false);
    if (storedEmail) {
      setValue("email", storedEmail);
    }
  };

  const handleEnableBiometric = async () => {
    await enableBiometrics();
    setShowBiometricEnablePrompt(false);
    router.replace("/(tabs)");
  };

  const handleSkipBiometric = () => {
    setShowBiometricEnablePrompt(false);
    router.replace("/(tabs)");
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
          <View className="mb-8 mt-4">
            <AuthHeader size="lg" tagline={t("auth.signIn.tagline")} />
          </View>

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
              label={t("auth.signIn.emailLabel")}
              placeholder={t("auth.signIn.emailPlaceholder")}
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              error={errors.email?.message}
              disabled={isAnyLoading}
            />

            <FormInput
              control={control}
              name="password"
              label={t("auth.signIn.passwordLabel")}
              placeholder={t("auth.signIn.passwordPlaceholder")}
              secureTextEntry
              autoComplete="password"
              error={errors.password?.message}
              disabled={isAnyLoading}
            />

            {/* Sign In Button */}
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
                <ButtonText>{t("auth.signIn.submit")}</ButtonText>
              )}
            </Button>

            {/* Forgot Password Link */}
            <Pressable
              onPress={() => router.push("/(auth)/forgot-password")}
              className="mt-4 py-2"
            >
              <Text className="text-center font-medium text-primary-600">
                {t("auth.signIn.forgotPassword")}
              </Text>
            </Pressable>
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

          {/* Sign Up Link */}
          <AuthFooterLink
            prefix={t("auth.signIn.noAccount")}
            linkText={t("auth.signIn.signUpLink")}
            href="/(auth)/sign-up"
          />

          {/* Spacer */}
          <View className="h-8" />
        </ScrollView>

        {/* Biometric Prompt Modal */}
        <BiometricPrompt
          isOpen={showBiometricPrompt}
          onClose={() => setShowBiometricPrompt(false)}
          onAuthenticate={handleBiometricAuth}
          onUsePassword={handleUsePasword}
          biometricType={biometricType}
          isAuthenticating={isBiometricAuthenticating}
        />

        {/* Biometric Enable Prompt Modal */}
        <BiometricEnablePrompt
          isOpen={showBiometricEnablePrompt}
          onClose={handleSkipBiometric}
          onEnable={handleEnableBiometric}
          onSkip={handleSkipBiometric}
          biometricType={biometricType}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
