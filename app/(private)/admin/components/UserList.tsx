"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import TentSelector from "@/components/TentSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateForDatabase } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { userSchema, attendanceSchema } from "@/lib/schemas/admin";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { Tables } from "@/lib/database.types";
import type { UserFormData, AttendanceFormData } from "@/lib/schemas/admin";
import type { User } from "@supabase/supabase-js";

import {
  deleteAttendance,
  deleteUser,
  getUserAttendances,
  getUsers,
  updateAttendance,
  updateUserAuth,
  updateUserProfile,
} from "../actions";

const UserEditForm = ({
  user,
  onSubmit,
}: {
  user: CombinedUser;
  onSubmit: (data: UserFormData) => Promise<void>;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: user.email,
      password: "",
      full_name: user.profile?.full_name || "",
      username: user.profile?.username || "",
      is_super_admin: user.profile?.is_super_admin || false,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="email" className="block">
          Email
        </Label>
        <Input
          type="email"
          id="email"
          className="input"
          errorMsg={errors.email?.message}
          {...register("email")}
        />
        {errors.email && <span className="error">{errors.email.message}</span>}
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
        <Input
          type="checkbox"
          id="is_super_admin"
          errorMsg={errors.is_super_admin?.message}
          {...register("is_super_admin")}
        />
        <Label htmlFor="is_super_admin" className="block">
          Is Super Admin
        </Label>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Update User
      </Button>
    </form>
  );
};

const AttendanceEditForm = ({
  attendance,
  onSubmit,
}: {
  attendance: AttendanceWithTents;
  onSubmit: (data: AttendanceFormData) => Promise<void>;
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema),
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

type CombinedUser = User & { profile: Tables<"profiles"> };
interface AttendanceWithTents extends Tables<"attendances"> {
  tent_ids?: string[];
}

const UserList = () => {
  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [attendances, setAttendances] = useState<Tables<"attendances">[]>([]);
  const [selectedUser, setSelectedUser] = useState<CombinedUser | null>(null);
  const [selectedAttendance, setSelectedAttendance] =
    useState<AttendanceWithTents | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const USERS_PER_PAGE = 50;

  async function fetchUsers(page: number = 1, searchTerm: string = "") {
    try {
      setIsLoading(true);
      const result = await getUsers(searchTerm, page, USERS_PER_PAGE);
      setUsers(result.users as CombinedUser[]);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setCurrentPage(result.currentPage);
    } catch (error) {
      logger.error(
        "Error fetching users",
        logger.clientComponent("UserList", { action: "fetchUsers" }),
        error as Error,
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAttendances(userId: string) {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUserSelect(user: CombinedUser) {
    setSelectedAttendance(null);
    setSelectedUser(user);
    await fetchAttendances(user.id);
    setIsUserDialogOpen(true); // Open the dialog for user editing
  }

  async function handleUpdateUser(data: UserFormData) {
    try {
      const authData: { email?: string; password?: string } = {};
      if (data.email !== selectedUser?.email) authData.email = data.email;
      if (data.password) authData.password = data.password;

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
      fetchUsers(currentPage, debouncedSearch);
      setSelectedUser(null);
      toast.success("User updated successfully");
      setIsUserDialogOpen(false);
    } catch (error) {
      logger.error(
        "Error updating user",
        logger.clientComponent("UserList", {
          action: "updateUser",
          userId: selectedUser?.id,
        }),
        error as Error,
      );
      toast.error("Failed to update user");
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      await deleteUser(userId);
      fetchUsers(currentPage, debouncedSearch);
      toast.success("User deleted successfully");
    } catch (error) {
      logger.error(
        "Error deleting user",
        logger.clientComponent("UserList", { action: "deleteUser", userId }),
        error as Error,
      );
      toast.error("Failed to delete user");
    }
  }

  async function handleUpdateAttendance(data: AttendanceFormData) {
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
      toast.success("Attendance updated successfully");
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
      toast.error("Failed to update attendance");
    }
  }

  async function handleDeleteAttendance(attendanceId: string) {
    try {
      await deleteAttendance(attendanceId);
      fetchAttendances(selectedUser!.id); // Refresh attendances
      toast.success("Attendance deleted successfully");
    } catch (error) {
      logger.error(
        "Error deleting attendance",
        logger.clientComponent("UserList", {
          action: "deleteAttendance",
          attendanceId,
        }),
        error as Error,
      );
      toast.error("Failed to delete attendance");
    }
  }

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users when search or page changes
  useEffect(() => {
    fetchUsers(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (debouncedSearch !== search) {
      setCurrentPage(1);
    }
  }, [debouncedSearch, search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    [],
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-2">User List</h2>
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">User List</h2>

      {/* Search Input */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by name, username, or email..."
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
      </div>

      {/* Results Info */}
      <div className="mb-4 text-sm text-gray-600">
        {debouncedSearch && (
          <p>
            Showing {users.length} of {totalCount} users for &ldquo;
            {debouncedSearch}&rdquo;
          </p>
        )}
        {!debouncedSearch && (
          <p>
            Showing {users.length} of {totalCount} users
          </p>
        )}
      </div>

      {/* User List */}
      {users.length === 0 && !isLoading ? (
        <div className="text-center py-8 text-gray-500">
          {debouncedSearch
            ? "No users found matching your search."
            : "No users found."}
        </div>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border"
            >
              <div className="flex-1">
                <div className="font-medium">
                  {user.profile?.full_name || "N/A"}
                </div>
                <div className="text-sm text-gray-600">
                  {user.profile?.username && (
                    <span className="mr-2">@{user.profile.username}</span>
                  )}
                  <span>[{user.email}]</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleUserSelect(user)} size="sm">
                  Edit
                </Button>
                <Button
                  onClick={() => handleDeleteUser(user.id)}
                  size="sm"
                  variant="destructive"
                >
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setSelectedUser(user);
                    fetchAttendances(user.id);
                    setIsAttendanceDialogOpen(true);
                  }}
                  size="sm"
                >
                  Edit Attendances
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              size="sm"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page =
                Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              if (page > totalPages) return null;
              return (
                <Button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                >
                  {page}
                </Button>
              );
            })}
            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* User Edit Dialog */}
      <ResponsiveDialog
        open={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
        title="Edit User"
        description="Update user details"
      >
        {selectedUser && (
          <UserEditForm user={selectedUser} onSubmit={handleUpdateUser} />
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
            <h2 className="text-xl font-semibold mb-2">
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
