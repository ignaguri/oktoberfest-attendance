import { Stack } from "expo-router";
import { useTranslation } from "@prostcounter/shared/i18n";

export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#F59E0B", // yellow-500
        },
        headerTintColor: "#000000",
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShadowVisible: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{
          title: t("auth.signIn.title"),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          title: t("auth.signUp.title"),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: t("auth.resetPassword.title"),
          headerShown: true,
        }}
      />
    </Stack>
  );
}
