import { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/lib/auth/AuthContext";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email"),
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            {t("auth.signIn.subtitle")}
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
                  label={t("auth.signIn.emailLabel")}
                  placeholder={t("auth.signIn.emailPlaceholder")}
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
                  label={t("auth.signIn.passwordLabel")}
                  placeholder={t("auth.signIn.passwordPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
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

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={isLoading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t("auth.signIn.submit")}
          </Button>

          <Link href="/(auth)/forgot-password" asChild>
            <Button mode="text" style={styles.linkButton}>
              {t("auth.signIn.forgotPassword")}
            </Button>
          </Link>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            {t("auth.signIn.noAccount")}{" "}
          </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Button mode="text" compact>
              {t("auth.signIn.signUpLink")}
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
  linkButton: {
    marginTop: 8,
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
