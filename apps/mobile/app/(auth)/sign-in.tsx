import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Button, ButtonText, ButtonSpinner } from "@prostcounter/ui";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { z } from "zod";

import { useAuth } from "@/lib/auth/AuthContext";

const signInSchema = z.object({
  email: z.email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignInFormData = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await signIn(data.email, data.password);

    if (signInError) {
      setError(t("auth.signIn.errors.invalidCredentials"));
      setIsLoading(false);
      return;
    }

    // Navigation handled by auth guard
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="px-6"
      >
        {/* Header */}
        <View className="-mx-6 bg-yellow-500 px-6 py-6 pt-16">
          <Text className="text-center text-xl font-bold text-black">
            {t("auth.signIn.title")}
          </Text>
        </View>

        {/* Form */}
        <View className="mt-8">
          <Text className="mb-8 text-center text-2xl font-bold text-gray-900">
            {t("auth.signIn.subtitle")}
          </Text>

          {error && (
            <View className="mb-4 rounded-lg bg-red-50 p-3">
              <Text className="text-center text-red-600">{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View className="mb-4">
                <Text className="mb-2 font-medium text-gray-700">
                  {t("auth.signIn.emailLabel")}
                </Text>
                <TextInput
                  className={`rounded-xl border px-4 py-3 text-base ${
                    errors.email
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 bg-white"
                  }`}
                  placeholder={t("auth.signIn.emailPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                {errors.email && (
                  <Text className="mt-1 text-sm text-red-500">
                    {errors.email.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* Password Input */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View className="mb-6">
                <Text className="mb-2 font-medium text-gray-700">
                  {t("auth.signIn.passwordLabel")}
                </Text>
                <TextInput
                  className={`rounded-xl border px-4 py-3 text-base ${
                    errors.password
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 bg-white"
                  }`}
                  placeholder={t("auth.signIn.passwordPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                />
                {errors.password && (
                  <Text className="mt-1 text-sm text-red-500">
                    {errors.password.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* Submit Button */}
          <Button
            action="primary"
            size="lg"
            onPress={handleSubmit(onSubmit)}
            isDisabled={isLoading}
            className="rounded-full"
          >
            {isLoading ? (
              <ButtonSpinner />
            ) : (
              <ButtonText>{t("auth.signIn.submit")}</ButtonText>
            )}
          </Button>
          <Button
            action="secondary"
            size="md"
            onPress={() => console.log("Test")}
            isDisabled={isLoading}
            className="mt-2"
          >
            <ButtonText className="text-white">Test</ButtonText>
          </Button>

          {/* Forgot Password */}
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity className="mt-4 py-2">
              <Text className="text-center font-medium text-yellow-600">
                {t("auth.signIn.forgotPassword")}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Footer */}
        <View className="mt-8 flex-row items-center justify-center pb-8">
          <Text className="text-gray-600">{t("auth.signIn.noAccount")} </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text className="font-semibold text-yellow-600">
                {t("auth.signIn.signUpLink")}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
