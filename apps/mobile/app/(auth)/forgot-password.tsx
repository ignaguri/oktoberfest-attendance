import { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { Link, useRouter } from "expo-router";
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
  const router = useRouter();
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
      setError(t("auth.resetPassword.errors.failed"));
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text variant="headlineMedium" style={styles.successTitle}>
            {t("auth.resetPassword.success")}
          </Text>
          <Button
            mode="contained"
            onPress={() => router.replace("/(auth)/sign-in")}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t("auth.resetPassword.backToSignIn")}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t("auth.resetPassword.subtitle")}
          </Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label={t("auth.resetPassword.emailLabel")}
                  placeholder={t("auth.resetPassword.emailPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  mode="outlined"
                  error={!!errors.email}
                />
                {errors.email && (
                  <HelperText type="error" visible={!!errors.email}>
                    {errors.email.message}
                  </HelperText>
                )}
              </View>
            )}
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={isLoading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t("auth.resetPassword.submit")}
          </Button>

          <Link href="/(auth)/sign-in" asChild>
            <Button mode="text" style={styles.linkButton}>
              {t("auth.resetPassword.backToSignIn")}
            </Button>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginTop: 24,
    marginBottom: 32,
  },
  subtitle: {
    textAlign: "center",
    color: "#6B7280",
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: "#DC2626",
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#F59E0B",
  },
  buttonContent: {
    paddingVertical: 8,
  },
  linkButton: {
    marginTop: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successTitle: {
    textAlign: "center",
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 24,
  },
});
