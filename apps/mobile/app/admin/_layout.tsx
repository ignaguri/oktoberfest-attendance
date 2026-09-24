/**
 * Admin Screens Layout
 *
 * Guards the admin stack on the client. This is presentation only -- the real
 * enforcement is the requireAdmin middleware on every /v1/admin/* endpoint, so
 * a non-admin who reaches these routes anyway gets empty screens and 403s
 * rather than data.
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth/AuthContext";
import { useAdaptedProfile } from "@/lib/database/adapted-hooks";
import { useOfflineReady } from "@/lib/database/offline-provider";
import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function AdminLayout() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const offlineReady = useOfflineReady();
  const { data: profile, loading } = useAdaptedProfile(user?.id);

  // Wait for the local profile read before deciding -- redirecting on the first
  // render would bounce admins out of a deep link before the flag is known.
  //
  // `loading` alone does not express that wait. The query behind it is
  // `enabled: isReady && !!userId`, and a disabled TanStack query reports
  // `isLoading: false`, so until the session resolves and SQLite opens this
  // reads as "done, no profile" -- which is exactly the bounce the paragraph
  // above is about, on every cold start into an admin route (restored
  // navigation, a deep link, an OTA reload). Once auth says there is nobody,
  // there is nothing to wait for and the redirect below is correct.
  if (authLoading || (user && (!offlineReady || loading))) {
    return null;
  }

  if (!profile?.is_super_admin) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: t("admin.pageTitle"),
        }}
      />
      <Stack.Screen
        name="users"
        options={{
          title: t("admin.tabs.users"),
        }}
      />
      <Stack.Screen
        name="feedback"
        options={{
          title: t("admin.tabs.feedback"),
        }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{
          title: t("admin.mobile.userDetail.title"),
        }}
      />
      <Stack.Screen
        name="groups"
        options={{
          title: t("admin.tabs.groups"),
        }}
      />
      <Stack.Screen
        name="group/[id]"
        options={{
          title: t("admin.mobile.groupDetail.title"),
        }}
      />
      <Stack.Screen
        name="festivals"
        options={{
          title: t("admin.tabs.festivals"),
        }}
      />
      <Stack.Screen
        name="festival/[id]/index"
        options={{
          title: t("admin.mobile.festivalDetail.title"),
        }}
      />
      <Stack.Screen
        name="festival/[id]/tents"
        options={{
          title: t("admin.mobile.festivalTents.title"),
        }}
      />
      <Stack.Screen
        name="tents"
        options={{
          title: t("admin.tabs.tents"),
        }}
      />
      <Stack.Screen
        name="location"
        options={{
          title: t("admin.location.title"),
        }}
      />
      <Stack.Screen
        name="analytics/index"
        options={{
          title: t("admin.analytics.title"),
        }}
      />
      <Stack.Screen name="analytics/[section]" />
      <Stack.Screen
        name="cache"
        options={{
          title: t("admin.tabs.cache"),
        }}
      />
    </Stack>
  );
}
