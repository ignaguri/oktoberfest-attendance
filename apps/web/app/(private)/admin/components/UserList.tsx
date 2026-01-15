"use client";

import { UserSearch } from "@/components/admin/search/UserSearch";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { DataTable } from "@/components/Table/DataTable";
import { DataTableColumnHeader } from "@/components/Table/DataTableColumnHeader";
import TentSelector from "@/components/TentSelector";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDateForDatabase } from "@/lib/date-utils";
import { useTranslation } from "@/lib/i18n/client";
import { logger } from "@/lib/logger";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AdminUserUpdateFormSchema,
  AdminAttendanceFormSchema,
} from "@prostcounter/shared/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "date-fns/format";
import { Beer, Tent, Trash } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";

import type { Tables } from "@prostcounter/db";
import type {
  AdminUserUpdateForm,
  AdminAttendanceForm,
} from "@prostcounter/shared/schemas";
import type { User } from "@supabase/supabase-js";

import {
  deleteAttendance,
  deleteUser,
  getUserAttendances,
  updateAttendance,
  updateUserAuth,
  updateUserProfile,
} from "../actions";

const UserEditForm = ({
  user,
  onSubmit,
  attendances,
  onDeleteAttendance,
  onFetchAttendances,
  isFetchingAttendances,
}: {
  user: CombinedUser;
  onSubmit: (data: AdminUserUpdateForm) => Promise<void>;
  attendances?: AttendanceWithTents[];
  onDeleteAttendance?: (attendanceId: string) => void;
  onFetchAttendances?: () => void;
  isFetchingAttendances?: boolean;
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AdminUserUpdateForm>({
    resolver: zodResolver(AdminUserUpdateFormSchema),
    defaultValues: {
      password: "",
      full_name: user.profile?.full_name || "",
      username: user.profile?.username || "",
      is_super_admin: user.profile?.is_super_admin || false,
    },
  });

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email display (read-only) */}
        <div>
          <Label htmlFor="email" className="block">
            Email
          </Label>
          <Input
            type="email"
            id="email"
            className="input bg-muted"
            value={user.email}
            disabled
            readOnly
          />
          <p className="text-muted-foreground mt-1 text-sm">
            Email cannot be changed
          </p>
        </div>

        <div>
          <Label htmlFor="password" className="block">
            New Password (leave blank to keep unchanged)
          </Label>
          <Input
            type="password"
            id="password"
            className="input"
            errorMsg={errors.password?.message}
            {...register("password")}
          />
          {errors.password && (
            <span className="error">{errors.password.message}</span>
          )}
        </div>
        <div>
          <Label htmlFor="full_name" className="block">
            Full Name
          </Label>
          <Input
            type="text"
            id="full_name"
            className="input"
            errorMsg={errors.full_name?.message}
            {...register("full_name")}
          />
          {errors.full_name && (
            <span className="error">{errors.full_name.message}</span>
          )}
        </div>
        <div>
          <Label htmlFor="username" className="block">
            Username
          </Label>
          <Input
            type="text"
            id="username"
            className="input"
            errorMsg={errors.username?.message}
            {...register("username")}
          />
          {errors.username && (
            <span className="error">{errors.username.message}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Controller
            name="is_super_admin"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="is_super_admin"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label
            htmlFor="is_super_admin"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Is Super Admin
          </Label>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          Update User
        </Button>
      </form>

      <div className="mt-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="attendances">
            <AccordionTrigger
              onClick={onFetchAttendances}
              className="text-left"
            >
              User Attendances ({attendances?.length || "Not loaded yet"})
            </AccordionTrigger>
            <AccordionContent>
              {isFetchingAttendances ? (
                <div className="text-muted-foreground py-4 text-center">
                  Loading attendances...
                </div>
              ) : attendances && onDeleteAttendance ? (
                <AttendanceTable
                  attendances={attendances}
                  onDeleteAttendance={onDeleteAttendance}
                />
              ) : (
                <div className="text-muted-foreground py-4 text-center">
                  Click to load attendances
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
};

const AttendanceEditForm = ({
  attendance,
  onSubmit,
}: {
  attendance: AttendanceWithTents;
  onSubmit: (data: AdminAttendanceForm) => Promise<void>;
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdminAttendanceForm>({
    resolver: zodResolver(AdminAttendanceFormSchema),
    defaultValues: {
      date: new Date(attendance.date),
      beer_count: attendance.beer_count,
      tent_ids: attendance.tent_ids || [],
    },
  });

  const watchedTentIds = watch("tent_ids");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="date" className="block">
          Date
        </Label>
        <Input
          type="date"
          id="date"
          className="border p-1"
          errorMsg={errors.date?.message}
          {...register("date", {
            valueAsDate: true,
            setValueAs: (value: string) => new Date(value),
          })}
        />
        {errors.date && (
          <div className="text-red-500">{errors.date.message}</div>
        )}
      </div>
      <div>
        <Label htmlFor="beer_count" className="block">
          Beer Count
        </Label>
        <Input
          type="number"
          id="beer_count"
          className="border p-1"
          errorMsg={errors.beer_count?.message}
          {...register("beer_count", { valueAsNumber: true })}
        />
        {errors.beer_count && (
          <div className="text-red-500">{errors.beer_count.message}</div>
        )}
      </div>
      <div>
        <Label htmlFor="tents" className="block">
          Tents
        </Label>
        <TentSelector
          selectedTents={watchedTentIds}
          onTentsChange={(tents) => setValue("tent_ids", tents)}
        />
        {errors.tent_ids && (
          <div className="text-red-500">{errors.tent_ids.message}</div>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Update Attendance
      </Button>
    </form>
  );
};

const AttendanceTable = ({
  attendances,
  onDeleteAttendance,
}: {
  attendances: AttendanceWithTents[];
  onDeleteAttendance: (attendanceId: string) => void;
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<
    string | null
  >(null);

  const handleDelete = useCallback((attendanceId: string) => {
    setSelectedAttendanceId(attendanceId);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (selectedAttendanceId) {
      await onDeleteAttendance(selectedAttendanceId);
      setIsDeleteDialogOpen(false);
      setSelectedAttendanceId(null);
    }
  }, [selectedAttendanceId, onDeleteAttendance]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "date",
        header: ({ column }: any) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }: any) =>
          formatDate(new Date(row.original.date), "dd/MM/yyyy"),
      },
      {
        accessorKey: "beer_count",
        header: ({ column }: any) => (
          <DataTableColumnHeader column={column} title="Beers" />
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
          <DataTableColumnHeader column={column} title="Tents" />
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
            className="h-8 w-8 p-0"
          >
            <Trash size={14} />
          </Button>
        ),
      },
    ],
    [handleDelete],
  );

  if (attendances.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center">
        No attendances found for this user.
      </div>
    );
  }

  return (
    <>
      <DataTable columns={columns} data={attendances} />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attendance</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this attendance? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

type CombinedUser = User & { profile: Tables<"profiles"> };
interface AttendanceWithTents extends Tables<"attendances"> {
  tent_ids?: string[];
}

const UserList = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [attendances, setAttendances] = useState<AttendanceWithTents[]>([]);
  const [selectedUser, setSelectedUser] = useState<CombinedUser | null>(null);
  const [selectedAttendance, setSelectedAttendance] =
    useState<AttendanceWithTents | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [isFetchingAttendances, setIsFetchingAttendances] = useState(false);

  const handleRefresh = () => {
    // Invalidate all user search queries to trigger a refresh
    queryClient.invalidateQueries({
      queryKey: searchKeys.users(),
    });
  };

  async function fetchAttendances(userId: string) {
    setIsFetchingAttendances(true);
    try {
      const fetchedAttendances = await getUserAttendances(userId);
      setAttendances(fetchedAttendances);
    } catch (error) {
      logger.error(
        "Error fetching attendances",
        logger.clientComponent("UserList", {
          action: "fetchAttendances",
          userId,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.userLoadFailed"));
    } finally {
      setIsFetchingAttendances(false);
    }
  }

  async function handleUserSelect(user: CombinedUser) {
    setSelectedAttendance(null);
    setSelectedUser(user);
    setAttendances([]);
    setIsUserDialogOpen(true); // Open the dialog for user editing
  }

  async function handleUpdateUser(data: AdminUserUpdateForm) {
    try {
      const authData: { password?: string } = {};
      if (data.password && data.password.trim() !== "") {
        authData.password = data.password;
      }

      const profileData: Partial<Tables<"profiles">> = {
        full_name: data.full_name,
        username: data.username,
        is_super_admin: data.is_super_admin,
      };

      if (Object.keys(authData).length > 0) {
        await updateUserAuth(selectedUser!.id, authData);
      }
      if (Object.keys(profileData).length > 0) {
        await updateUserProfile(selectedUser!.id, profileData);
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

  async function handleDeleteAttendance(attendanceId: string) {
    try {
      await deleteAttendance(attendanceId);
      toast.success(t("notifications.success.attendanceDeleted"));
      // Refresh attendances list
      if (selectedUser) {
        const updatedAttendances = await getUserAttendances(selectedUser.id);
        setAttendances(updatedAttendances);
      }
    } catch (error) {
      logger.error(
        "Error deleting attendance",
        logger.clientComponent("UserList", {
          action: "deleteAttendance",
          attendanceId,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.attendanceDeleteAdminFailed"));
    }
  }

  async function handleUpdateAttendance(data: AdminAttendanceForm) {
    try {
      if (!selectedAttendance || !selectedUser) return;
      await updateAttendance(selectedAttendance.id, {
        date: formatDateForDatabase(data.date), // Convert Date to string with timezone handling
        beer_count: data.beer_count,
        user_id: selectedUser.id,
        tent_ids: data.tent_ids,
      });
      fetchAttendances(selectedUser.id);
      setSelectedAttendance(null);
      toast.success(t("notifications.success.attendanceUpdated"));
      setIsAttendanceDialogOpen(false);
    } catch (error) {
      logger.error(
        "Error updating attendance",
        logger.clientComponent("UserList", {
          action: "updateAttendance",
          attendanceId: selectedAttendance?.id,
        }),
        error as Error,
      );
      toast.error(t("notifications.error.attendanceUpdateAdminFailed"));
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">User List</h2>

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
        title="Edit User"
        description="Update user details"
      >
        {selectedUser && (
          <UserEditForm
            user={selectedUser}
            onSubmit={handleUpdateUser}
            attendances={attendances}
            onDeleteAttendance={handleDeleteAttendance}
            onFetchAttendances={() =>
              selectedUser && fetchAttendances(selectedUser.id)
            }
            isFetchingAttendances={isFetchingAttendances}
          />
        )}
      </ResponsiveDialog>

      {/* Attendance Edit Dialog */}
      <ResponsiveDialog
        open={isAttendanceDialogOpen}
        onOpenChange={setIsAttendanceDialogOpen}
        title="Edit Attendances"
        description="Manage user attendances"
      >
        {selectedUser && (
          <div>
            <h2 className="mb-2 text-xl font-semibold">
              Attendances for {selectedUser.profile?.full_name}
            </h2>
            {attendances.map((attendance) => (
              <div key={attendance.id} className="mb-2">
                <span>
                  {attendance.date.toString()} - {attendance.beer_count} beers
                </span>
                <Button
                  onClick={() => {
                    setSelectedAttendance(attendance);
                    setIsAttendanceDialogOpen(true);
                  }}
                  className="ml-2"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => handleDeleteAttendance(attendance.id)}
                  className="ml-2"
                  variant="destructive"
                >
                  Delete
                </Button>
              </div>
            ))}
            {selectedAttendance && (
              <AttendanceEditForm
                attendance={selectedAttendance}
                onSubmit={handleUpdateAttendance}
              />
            )}
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default UserList;
