"use client";

// Use standardSchemaResolver instead of zodResolver to avoid Turbopack build failures
// caused by @hookform/resolvers v5.x importing "zod/v4/core" which Turbopack cannot resolve.
// See: https://github.com/colinhacks/zod/issues/4879
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { Tables } from "@prostcounter/db";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useAdminUserAttendances, useDeleteAdminAttendance } from "@prostcounter/shared/hooks";
import type { AdminAttendance, AdminUserUpdateForm } from "@prostcounter/shared/schemas";
import { AdminUserUpdateFormSchema } from "@prostcounter/shared/schemas";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "date-fns/format";
import { parseISO } from "date-fns/parseISO";
import { Beer, GlassWater, Tent, Trash } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "next-view-transitions";
import { toast } from "sonner";

import { UserSearch } from "@/components/admin/search/UserSearch";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { DataTable } from "@/components/Table/DataTable";
import { DataTableColumnHeader } from "@/components/Table/DataTableColumnHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchKeys } from "@/lib/data/search-query-keys";
import { translateError } from "@/lib/i18n/client";
import { logger } from "@/lib/logger";

import { deleteUser, updateUserAuth, updateUserProfile } from "../actions";
import { AttendanceDrinks } from "./AttendanceDrinks";

const UserEditForm = ({
  user,
  onSubmit,
}: {
  user: CombinedUser;
  onSubmit: (data: AdminUserUpdateForm) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminUserUpdateForm>({
    resolver: standardSchemaResolver(AdminUserUpdateFormSchema),
    defaultValues: {
      password: "",
      full_name: user.profile?.full_name || "",
      username: user.profile?.username || "",
    },
  });

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email display (read-only) */}
        <div>
          <Label htmlFor="email" className="block">
            {t("common.form.email")}
          </Label>
          <Input
            type="email"
            id="email"
            className="input bg-muted"
            value={user.email}
            disabled
            readOnly
          />
          <p className="text-muted-foreground mt-1 text-sm">{t("admin.users.form.emailNote")}</p>
        </div>

        <div>
          <Label htmlFor="password" className="block">
            {t("admin.users.form.newPassword")}
          </Label>
          <Input
            type="password"
            id="password"
            className="input"
            errorMsg={errors.password?.message}
            {...register("password")}
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </div>
        <div>
          <Label htmlFor="full_name" className="block">
            {t("admin.users.form.fullName")}
          </Label>
          <Input
            type="text"
            id="full_name"
            className="input"
            errorMsg={errors.full_name?.message}
            {...register("full_name")}
          />
          {errors.full_name && <span className="error">{errors.full_name.message}</span>}
        </div>
        <div>
          <Label htmlFor="username" className="block">
            {t("admin.users.form.username")}
          </Label>
          <Input
            type="text"
            id="username"
            className="input"
            errorMsg={errors.username?.message}
            {...register("username")}
          />
          {errors.username && <span className="error">{errors.username.message}</span>}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {t("admin.users.form.updateUser")}
        </Button>
      </form>

      <div className="mt-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="attendances">
            <AccordionTrigger className="text-left">
              {t("admin.users.attendances.heading")}
            </AccordionTrigger>
            <AccordionContent>
              <AttendanceTable userId={user.id} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
};

const AttendanceTable = ({ userId }: { userId: string }) => {
  const { t } = useTranslation();
  const { attendances, isLoading, error } = useAdminUserAttendances(userId);
  const deleteAttendance = useDeleteAdminAttendance();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [drinksAttendance, setDrinksAttendance] = useState<AdminAttendance | null>(null);

  const handleDelete = useCallback((attendanceId: string) => {
    setSelectedAttendanceId(attendanceId);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedAttendanceId) {
      return;
    }
    try {
      await deleteAttendance.mutate(selectedAttendanceId);
      toast.success(t("notifications.success.attendanceDeleted"));
    } catch (error) {
      logger.error(
        "Error deleting attendance",
        logger.clientComponent("UserList", {
          action: "deleteAttendance",
          attendanceId: selectedAttendanceId,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.attendanceDeleteAdminFailed"));
    }
    setIsDeleteDialogOpen(false);
    setSelectedAttendanceId(null);
  }, [deleteAttendance, selectedAttendanceId, t]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "date",
        header: ({ column }: any) => (
          <DataTableColumnHeader
            column={column}
            title={t("admin.users.attendances.headers.date")}
          />
        ),
        cell: ({ row }: any) => formatDate(parseISO(row.original.date), "dd/MM/yyyy"),
      },
      {
        accessorKey: "beer_count",
        header: ({ column }: any) => (
          <DataTableColumnHeader
            column={column}
            title={t("admin.users.attendances.headers.beers")}
          />
        ),
        cell: ({ row }: any) => (
          <div className="flex items-center justify-center gap-1">
            <span>{row.original.beer_count}</span>
            <Beer size={16} />
          </div>
        ),
      },
      {
        accessorKey: "tent_ids",
        header: ({ column }: any) => (
          <DataTableColumnHeader
            column={column}
            title={t("admin.users.attendances.headers.tents")}
          />
        ),
        cell: ({ row }: any) => (
          <div className="flex items-center justify-center gap-1">
            <span>{row.original.tent_ids?.length || 0}</span>
            <Tent size={16} />
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }: any) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrinksAttendance(row.original)}
              className="h-8 w-8 p-0"
              aria-label={t("admin.users.attendances.drinks.title")}
            >
              <GlassWater size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(row.original.id)}
              className="h-8 w-8 p-0"
              aria-label={t("admin.users.attendances.buttons.delete")}
            >
              <Trash size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete, t],
  );

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-4 text-center">
        {t("admin.users.attendances.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-muted-foreground py-4 text-center">
        {t("notifications.error.userLoadFailed")}
      </div>
    );
  }

  if (attendances.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center">
        {t("admin.users.attendances.empty")}
      </div>
    );
  }

  return (
    <>
      <DataTable columns={columns} data={attendances} />

      <ResponsiveDialog
        open={drinksAttendance !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDrinksAttendance(null);
          }
        }}
        title={t("admin.users.attendances.drinks.title")}
        description={
          drinksAttendance ? formatDate(parseISO(drinksAttendance.date), "dd/MM/yyyy") : ""
        }
      >
        {drinksAttendance && <AttendanceDrinks attendanceId={drinksAttendance.id} />}
      </ResponsiveDialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.attendances.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.attendances.deleteConfirm")} {t("common.actions.cannotUndo")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                {t("admin.users.attendances.buttons.cancel")}
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("admin.users.attendances.buttons.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

type CombinedUser = User & { profile: Tables<"profiles"> };

const UserList = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<CombinedUser | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  const handleRefresh = () => {
    // Invalidate all user search queries to trigger a refresh
    queryClient.invalidateQueries({
      queryKey: searchKeys.users(),
    });
  };

  async function handleUserSelect(user: CombinedUser) {
    setSelectedUser(user);
    setIsUserDialogOpen(true); // Open the dialog for user editing
  }

  async function handleUpdateUser(data: AdminUserUpdateForm) {
    try {
      const authData: { password?: string } = {};
      if (data.password && data.password.trim() !== "") {
        authData.password = data.password;
      }

      const profileData = {
        full_name: data.full_name,
        username: data.username,
      };

      if (Object.keys(authData).length > 0) {
        await updateUserAuth(selectedUser!.id, authData);
      }
      if (Object.keys(profileData).length > 0) {
        const { error } = await updateUserProfile(selectedUser!.id, profileData);

        // Usernames are unique across accounts. The dialog stays open on a
        // conflict so the name can be changed rather than retyped.
        if (error) {
          toast.error(translateError(t, error));
          return;
        }
      }
      setSelectedUser(null);
      toast.success(t("notifications.success.userUpdated"));
      setIsUserDialogOpen(false);
      handleRefresh();
    } catch (error) {
      logger.error(
        "Error updating user",
        logger.clientComponent("UserList", {
          action: "updateUser",
          userId: selectedUser?.id,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.userUpdateFailed"));
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      await deleteUser(userId);
      toast.success(t("notifications.success.userDeleted"));
      handleRefresh();
    } catch (error) {
      logger.error(
        "Error deleting user",
        logger.clientComponent("UserList", { action: "deleteUser", userId }),
        error as Error,
      );
      toast.error(t("notifications.error.userDeleteFailed"));
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t("admin.users.title")}</h2>

      {/* New Search System */}
      <UserSearch
        onUserEdit={handleUserSelect}
        onUserDelete={handleDeleteUser}
        onRefresh={handleRefresh}
        showFilters={true}
        showSorting={true}
        showRefresh={true}
      />

      {/* User Edit Dialog */}
      <ResponsiveDialog
        open={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
        title={t("admin.users.editUser")}
        description={t("admin.users.editUserDescription")}
      >
        {selectedUser && (
          <div className="flex flex-col gap-4">
            <Link href={`/admin/users/${selectedUser.id}`} className="text-sm underline">
              {t("admin.analytics.timeline.open")}
            </Link>
            <UserEditForm user={selectedUser} onSubmit={handleUpdateUser} />
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default UserList;
