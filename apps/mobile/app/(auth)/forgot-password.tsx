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
import { Link } from "expo-router";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/lib/auth/AuthContext";

const resetSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

type ResetFormData = z.infer<typeof resetSchema>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    setError(null);

    const { error: resetError } = await resetPassword(data.email);

    if (resetError) {
      setError(resetError.message || t("auth.forgotPassword.errors.generic"));
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
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
        <View className="bg-yellow-500 -mx-6 px-6 py-6 pt-16">
          <Text className="text-center text-xl font-bold text-black">
            {t("auth.forgotPassword.title")}
          </Text>
        </View>

        {/* Form */}
        <View className="mt-8">
          <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
            {t("auth.forgotPassword.subtitle")}
          </Text>

          <Text className="text-gray-600 text-center mb-8">
            {t("auth.forgotPassword.description")}
          </Text>

          {success ? (
            <View className="bg-green-50 p-4 rounded-lg mb-4">
              <Text className="text-green-700 text-center">
                {t("auth.forgotPassword.success")}
              </Text>
            </View>
          ) : (
            <>
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
                  <View className="mb-6">
                    <Text className="text-gray-700 font-medium mb-2">
                      {t("auth.forgotPassword.emailLabel")}
                    </Text>
                    <TextInput
                      className={`border rounded-xl px-4 py-3 text-base ${
                        errors.email
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300 bg-white"
                      }`}
                      placeholder={t("auth.forgotPassword.emailPlaceholder")}
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

              {/* Submit Button */}
              <TouchableOpacity
                className={`rounded-full py-4 ${
                  isLoading
                    ? "bg-yellow-300"
                    : "bg-yellow-500 active:bg-yellow-600"
                }`}
                onPress={handleSubmit(onSubmit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text className="text-center font-bold text-black text-base">
                    {t("auth.forgotPassword.submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Footer */}
        <View className="flex-row justify-center items-center mt-8 pb-8">
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text className="text-yellow-600 font-semibold">
                {t("auth.forgotPassword.backToSignIn")}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
