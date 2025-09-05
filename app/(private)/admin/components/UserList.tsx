"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import TentSelector from "@/components/TentSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { userSchema, attendanceSchema } from "@/lib/schemas/admin";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

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
  const { toast } = useToast();

  async function fetchUsers() {
    try {
      setIsLoading(true);
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers as CombinedUser[]);
    } catch (error) {
      console.error("Error fetching users:", error);
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
      console.error("Error fetching attendances:", error);
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
      fetchUsers();
      setSelectedUser(null);
      toast({
        title: "Success",
        variant: "success",
        description: "User updated successfully",
      });
      setIsUserDialogOpen(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      await deleteUser(userId);
      fetchUsers();
      toast({
        title: "Success",
        variant: "success",
        description: "User deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  }

  async function handleUpdateAttendance(data: AttendanceFormData) {
    try {
      if (!selectedAttendance || !selectedUser) return;
      await updateAttendance(selectedAttendance.id, {
        date: data.date.toISOString().split("T")[0], // Convert Date to string
        beer_count: data.beer_count,
        user_id: selectedUser.id,
        tent_ids: data.tent_ids,
      });
      fetchAttendances(selectedUser.id);
      setSelectedAttendance(null);
      toast({
        title: "Success",
        variant: "success",
        description: "Attendance updated successfully",
      });
      setIsAttendanceDialogOpen(false);
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteAttendance(attendanceId: string) {
    try {
      await deleteAttendance(attendanceId);
      fetchAttendances(selectedUser!.id); // Refresh attendances
      toast({
        title: "Success",
        variant: "success",
        description: "Attendance deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting attendance:", error);
      toast({
        title: "Error",
        description: "Failed to delete attendance",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    fetchUsers();
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
      <h2 className="text-xl font-semibold mb-2">User List</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id} className="mb-2">
            <span>{user.profile?.full_name || "N/A"}</span>
            <span> · </span>
            <span>[{user.email}]</span>
            <Button onClick={() => handleUserSelect(user)} className="ml-2">
              Edit
            </Button>
            <Button
              onClick={() => handleDeleteUser(user.id)}
              className="ml-2"
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
              className="ml-2"
            >
              Edit Attendances
            </Button>
          </li>
        ))}
      </ul>

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
