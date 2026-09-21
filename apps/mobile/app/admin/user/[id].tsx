import {
  useAdminUser,
  useAdminUserAttendances,
  useAdminUserGroups,
  useDeleteAdminAttendance,
  useDeleteAdminUser,
  useUpdateAdminUserAuth,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AdminAttendance } from "@prostcounter/shared/schemas";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Trash2, UsersRound } from "lucide-react-native";
import { useCallback, useState } from "react";

import { AdminAttendanceList } from "@/components/admin/admin-attendance-list";
import { EditAttendanceSheet } from "@/components/admin/edit-attendance-sheet";
import { UserGroupsList } from "@/components/admin/user-groups-list";
import { UserIdentityCard } from "@/components/admin/user-identity-card";
import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { IconColors } from "@/lib/constants/colors";

export default function AdminUserDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { user, isLoading, error, refetch } = useAdminUser(id);
  const { attendances, isLoading: attendancesLoading } = useAdminUserAttendances(id);
  const { groups, isLoading: groupsLoading } = useAdminUserGroups(id);

  const updateAuth = useUpdateAdminUserAuth();
  const deleteUser = useDeleteAdminUser();
  const deleteAttendance = useDeleteAdminAttendance();

  const [newPassword, setNewPassword] = useState("");

  // The row being edited, seeded on tap rather than in an effect, so a
  // background refetch of the list cannot overwrite an open draft.
  const [editing, setEditing] = useState<AdminAttendance | null>(null);

  // An admin cannot delete their own account; the server rejects it, and hiding
  // the control avoids a confusing 403.
  //
  // Granting or revoking super admin is not offered here at all. It is a
  // database-only change by deliberate policy, so the panel that every admin
  // can reach cannot mint another one.
  const isSelf = currentUser?.id === id;

  const handleSetPassword = useCallback(() => {
    showDialog(
      t("admin.mobile.userDetail.setPassword"),
      t("admin.mobile.userDetail.setPasswordConfirm"),
      "destructive",
      async () => {
        try {
          await updateAuth.mutate({ userId: id, data: { password: newPassword } });
          setNewPassword("");
          showDialog(t("common.status.success"), t("admin.mobile.userDetail.passwordChanged"));
        } catch {
          showDialog(t("common.status.error"), t("admin.mobile.userDetail.updateError"));
        }
      },
    );
  }, [id, newPassword, updateAuth, showDialog, t]);

  const handleDeleteUser = useCallback(() => {
    showDialog(
      t("admin.mobile.userDetail.deleteUser"),
      t("admin.mobile.userDetail.deleteUserConfirm"),
      "destructive",
      async () => {
        try {
          await deleteUser.mutate(id);
          router.back();
        } catch {
          showDialog(t("common.status.error"), t("admin.mobile.userDetail.deleteError"));
        }
      },
    );
  }, [id, deleteUser, router, showDialog, t]);

  const showError = useCallback(
    (message: string) => {
      showDialog(t("common.status.error"), message);
    },
    [showDialog, t],
  );

  const handleDeleteAttendance = useCallback(
    (attendanceId: string) => {
      showDialog(
        t("admin.mobile.userDetail.deleteAttendance"),
        t("admin.mobile.userDetail.deleteAttendanceConfirm"),
        "destructive",
        async () => {
          try {
            await deleteAttendance.mutate(attendanceId);
          } catch {
            showDialog(t("common.status.error"), t("admin.mobile.userDetail.deleteError"));
          }
        },
      );
    },
    [deleteAttendance, showDialog, t],
  );

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (isLoading || !user) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Text className="text-typography-500">{t("admin.mobile.userDetail.loading")}</Text>
      </View>
    );
  }

  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;

  return (
    <>
      <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
        <VStack space="md">
          {/* Identity */}
          <UserIdentityCard user={user} onError={showError} />

          {/* Password reset */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <Text className="text-typography-900">
                {t("admin.mobile.userDetail.setPassword")}
              </Text>
              <Input isInvalid={passwordTooShort}>
                <InputField
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t("admin.mobile.userDetail.newPasswordPlaceholder")}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel={t("admin.mobile.userDetail.newPasswordPlaceholder")}
                />
              </Input>
              {passwordTooShort && (
                <Text className="text-sm text-error-600">
                  {t("admin.mobile.userDetail.passwordTooShort")}
                </Text>
              )}
              <Button
                variant="outline"
                isDisabled={newPassword.length < 8 || updateAuth.loading}
                onPress={handleSetPassword}
                accessibilityLabel={t("admin.mobile.userDetail.setPassword")}
                accessibilityHint={t("admin.mobile.userDetail.setPasswordHint")}
              >
                {updateAuth.loading && <ButtonSpinner />}
                <ButtonText>{t("admin.mobile.userDetail.setPassword")}</ButtonText>
              </Button>
            </VStack>
          </Card>

          {/* Attendances */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <HStack space="sm" className="items-center">
                <CalendarDays size={18} color={IconColors.primary} />
                <Text className="text-typography-900">
                  {t("admin.mobile.userDetail.attendances")}
                </Text>
              </HStack>

              <AdminAttendanceList
                attendances={attendances}
                isLoading={attendancesLoading}
                onEdit={setEditing}
                onDelete={handleDeleteAttendance}
              />
            </VStack>
          </Card>

          {/* Groups */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <HStack space="sm" className="items-center">
                <UsersRound size={18} color={IconColors.primary} />
                <Text className="text-typography-900">{t("admin.mobile.userDetail.groups")}</Text>
              </HStack>

              <UserGroupsList
                groups={groups}
                isLoading={groupsLoading}
                onOpen={(groupId) => router.push(`/admin/group/${groupId}`)}
              />
            </VStack>
          </Card>

          {/* Delete account */}
          {!isSelf && (
            <Card size="md" variant="outline" className="border-error-300">
              <VStack space="sm">
                <Text className="text-error-700">{t("admin.mobile.userDetail.dangerZone")}</Text>
                <Button
                  variant="outline"
                  action="negative"
                  isDisabled={deleteUser.loading}
                  onPress={handleDeleteUser}
                  accessibilityLabel={t("admin.mobile.userDetail.deleteUser")}
                  accessibilityHint={t("admin.mobile.userDetail.deleteUserHint")}
                >
                  {deleteUser.loading ? (
                    <ButtonSpinner />
                  ) : (
                    <Trash2 size={16} color={IconColors.error} />
                  )}
                  <ButtonText>{t("admin.mobile.userDetail.deleteUser")}</ButtonText>
                </Button>
              </VStack>
            </Card>
          )}

          <View className="h-4" />
        </VStack>
      </ScrollView>

      {editing && (
        <EditAttendanceSheet
          key={editing.id}
          attendance={editing}
          onClose={() => setEditing(null)}
          onError={showError}
        />
      )}

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
