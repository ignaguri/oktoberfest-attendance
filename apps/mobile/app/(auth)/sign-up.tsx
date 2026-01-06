import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/lib/auth/AuthContext";

const signUpSchema = z
  .object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
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

  if (success) {
    return (
      <View className="flex-1 bg-white justify-center items-center p-6">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
          {t("auth.signUp.accountCreated")}
        </Text>
        <Text className="text-gray-600 text-center mb-6">
          {t("auth.signUp.success.checkEmail")}
        </Text>
        <TouchableOpacity
          className="bg-yellow-500 rounded-full py-4 px-8"
          onPress={() => router.replace("/(auth)/sign-in")}
        >
          <Text className="font-bold text-black">
            {t("auth.resetPassword.backToSignIn")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <View className="bg-yellow-500 -mx-6 px-6 py-6 pt-16">
          <Text className="text-center text-xl font-bold text-black">
            {t("auth.signUp.title")}
          </Text>
        </View>

        {/* Form */}
        <View className="mt-8">
          <Text className="text-2xl font-bold text-gray-900 text-center mb-8">
            {t("auth.signUp.subtitle")}
          </Text>

          {error && (
            <View className="bg-red-50 p-3 rounded-lg mb-4">
              <Text className="text-red-600 text-center">{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  {t("auth.signUp.emailLabel")}
                </Text>
                <TextInput
                  className={`border rounded-xl px-4 py-3 text-base ${
                    errors.email
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 bg-white"
                  }`}
                  placeholder={t("auth.signUp.emailPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                {errors.email && (
                  <Text className="text-red-500 text-sm mt-1">
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
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  {t("auth.signUp.passwordLabel")}
                </Text>
                <TextInput
                  className={`border rounded-xl px-4 py-3 text-base ${
                    errors.password
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 bg-white"
                  }`}
                  placeholder={t("auth.signUp.passwordPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                {errors.password && (
                  <Text className="text-red-500 text-sm mt-1">
                    {errors.password.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* Confirm Password Input */}
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View className="mb-6">
                <Text className="text-gray-700 font-medium mb-2">
                  {t("auth.signUp.confirmPasswordLabel")}
                </Text>
                <TextInput
                  className={`border rounded-xl px-4 py-3 text-base ${
                    errors.confirmPassword
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 bg-white"
                  }`}
                  placeholder={t("auth.signUp.confirmPasswordPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                {errors.confirmPassword && (
                  <Text className="text-red-500 text-sm mt-1">
                    {errors.confirmPassword.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* Submit Button */}
          <TouchableOpacity
            className={`rounded-full py-4 ${
              isLoading ? "bg-yellow-300" : "bg-yellow-500 active:bg-yellow-600"
            }`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-center font-bold text-black text-base">
                {t("auth.signUp.submit")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center items-center mt-8 pb-8">
          <Text className="text-gray-600">{t("auth.signUp.hasAccount")} </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text className="text-yellow-600 font-semibold">
                {t("auth.signUp.signInLink")}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
