import { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
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
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
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
      setError(t("auth.signUp.errors.failed"));
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
            {t("auth.signUp.accountCreated")}
          </Text>
          <Text variant="bodyLarge" style={styles.successText}>
            {t("auth.signUp.success.checkEmail")}
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
          <Text variant="headlineMedium" style={styles.title}>
            {t("auth.signUp.subtitle")}
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
                  label={t("auth.signUp.emailLabel")}
                  placeholder={t("auth.signUp.emailPlaceholder")}
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

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label={t("auth.signUp.passwordLabel")}
                  placeholder={t("auth.signUp.passwordPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  mode="outlined"
                  error={!!errors.password}
                />
                {errors.password && (
                  <HelperText type="error" visible={!!errors.password}>
                    {errors.password.message}
                  </HelperText>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <TextInput
                  label={t("auth.signUp.confirmPasswordLabel")}
                  placeholder={t("auth.signUp.confirmPasswordPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  mode="outlined"
                  error={!!errors.confirmPassword}
                />
                {errors.confirmPassword && (
                  <HelperText type="error" visible={!!errors.confirmPassword}>
                    {errors.confirmPassword.message}
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
            {t("auth.signUp.submit")}
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            {t("auth.signUp.hasAccount")}{" "}
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Button mode="text" compact>
              {t("auth.signUp.signInLink")}
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
  title: {
    textAlign: "center",
    fontWeight: "bold",
    color: "#1F2937",
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
    marginBottom: 16,
  },
  successText: {
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    color: "#6B7280",
  },
});
