import { zodResolver } from "@hookform/resolvers/zod";
import {
  type UpdatePasswordFormData,
  updatePasswordSchema,
} from "@prostcounter/shared/schemas";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Info } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { updatePassword } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: UpdatePasswordFormData) => {
    setIsLoading(true);

    try {
      const { error } = await updatePassword(data.password);

      if (error) {
        Alert.alert(
          t("common.status.error"),
          error.message || t("profile.changePassword.error"),
        );
        setIsLoading(false);
        return;
      }

      Alert.alert(
        t("common.status.success"),
        t("profile.changePassword.success"),
        [
          {
            text: t("common.buttons.gotIt"),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      Alert.alert(t("common.status.error"), t("profile.changePassword.error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-4">
          {/* Info */}
          <View className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <View className="flex-row items-start gap-3">
              <Info size={24} color={Colors.primary[600]} />
              <Text className="flex-1 text-sm text-yellow-800">
                {t("profile.changePassword.info")}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View className="rounded-2xl bg-white p-4 shadow-sm">
            {/* New Password */}
            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-typography-700">
                {t("profile.changePassword.newPassword")}
              </Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    variant="outline"
                    size="md"
                    isInvalid={!!errors.password}
                  >
                    <InputField
                      placeholder={t(
                        "profile.changePassword.newPasswordPlaceholder",
                      )}
                      secureTextEntry={!showNewPassword}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="none"
                    />
                    <InputSlot
                      className="pr-3"
                      onPress={() => setShowNewPassword(!showNewPassword)}
                    >
                      <InputIcon
                        as={() =>
                          showNewPassword ? (
                            <EyeOff size={20} color={IconColors.default} />
                          ) : (
                            <Eye size={20} color={IconColors.default} />
                          )
                        }
                      />
                    </InputSlot>
                  </Input>
                )}
              />
              {errors.password && (
                <Text className="mt-1 text-sm text-error-600">
                  {errors.password.message}
                </Text>
              )}
            </View>

            {/* Confirm Password */}
            <View className="mb-6">
              <Text className="mb-1 text-sm font-medium text-typography-700">
                {t("profile.changePassword.confirmPassword")}
              </Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    variant="outline"
                    size="md"
                    isInvalid={!!errors.confirmPassword}
                  >
                    <InputField
                      placeholder={t(
                        "profile.changePassword.confirmPasswordPlaceholder",
                      )}
                      secureTextEntry={!showConfirmPassword}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="none"
                    />
                    <InputSlot
                      className="pr-3"
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      <InputIcon
                        as={() =>
                          showConfirmPassword ? (
                            <EyeOff size={20} color={IconColors.default} />
                          ) : (
                            <Eye size={20} color={IconColors.default} />
                          )
                        }
                      />
                    </InputSlot>
                  </Input>
                )}
              />
              {errors.confirmPassword && (
                <Text className="mt-1 text-sm text-error-600">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>

            {/* Submit Button */}
            <Button
              action="primary"
              size="lg"
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
              className="rounded-full"
            >
              {isLoading ? (
                <ButtonSpinner color={IconColors.white} />
              ) : (
                <ButtonText>{t("profile.changePassword.submit")}</ButtonText>
              )}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
