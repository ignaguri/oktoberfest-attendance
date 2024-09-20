"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { Tables } from "@/lib/database.types";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import {
  deleteAttendance,
  deleteUser,
  getUserAttendances,
  getUsers,
  updateAttendance,
  updateUserAuth,
  updateUserProfile,
} from "../actions";
import TentSelector from "@/components/TentSelector";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveDialog from "@/components/ResponsiveDialog";

type CombinedUser = User & { profile: Tables<"profiles"> };
interface AttendanceWithTents extends Tables<"attendances"> {
  tent_ids?: string[];
}

const UserSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().min(8, "Password must be at least 8 characters"),
  full_name: Yup.string(),
  username: Yup.string(),
  is_super_admin: Yup.boolean(),
});

const AttendanceSchema = Yup.object().shape({
  date: Yup.date().required("Required"),
  beer_count: Yup.number().min(0, "Must be at least 0").required("Required"),
  tent_ids: Yup.array()
    .of(Yup.string())
    .required("At least one tent must be selected"),
});

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

  async function handleUpdateUser(values: any, { setSubmitting }: any) {
    try {
      const authData: { email?: string; password?: string } = {};
      if (values.email !== selectedUser?.email) authData.email = values.email;
      if (values.password) authData.password = values.password;

      const profileData: Partial<Tables<"profiles">> = {
        full_name: values.full_name,
        username: values.username,
        is_super_admin: values.is_super_admin,
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
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
    setSubmitting(false);
    setIsUserDialogOpen(false); // Close the dialog after update
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

  async function handleUpdateAttendance(values: any, { setSubmitting }: any) {
    try {
      if (!selectedAttendance || !selectedUser) return;
      await updateAttendance(selectedAttendance.id, {
        date: values.date,
        beer_count: values.beer_count,
        user_id: selectedUser.id, // Pass user_id
        tent_ids: values.tent_ids,
      });
      fetchAttendances(selectedUser.id); // Refresh attendances
      setSelectedAttendance(null); // Clear selection
      toast({
        title: "Success",
        variant: "success",
        description: "Attendance updated successfully",
      });
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    }
    setSubmitting(false);
    setIsAttendanceDialogOpen(false); // Close the dialog after update
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
          <Formik
            initialValues={{
              email: selectedUser.email,
              password: "",
              full_name: selectedUser.profile?.full_name || "",
              username: selectedUser.profile?.username || "",
              is_super_admin: selectedUser.profile?.is_super_admin || false,
            }}
            validationSchema={UserSchema}
            onSubmit={handleUpdateUser}
            enableReinitialize
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                <div>
                  <label htmlFor="email" className="block">
                    Email
                  </label>
                  <Field
                    type="email"
                    id="email"
                    name="email"
                    className="input"
                  />
                  <ErrorMessage
                    name="email"
                    component="span"
                    className="error"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block">
                    New Password (leave blank to keep unchanged)
                  </label>
                  <Field
                    type="password"
                    id="password"
                    name="password"
                    className="input"
                  />
                  <ErrorMessage
                    name="password"
                    component="span"
                    className="error"
                  />
                </div>
                <div>
                  <label htmlFor="full_name" className="block">
                    Full Name
                  </label>
                  <Field
                    type="text"
                    id="full_name"
                    name="full_name"
                    className="input"
                  />
                  <ErrorMessage
                    name="full_name"
                    component="span"
                    className="error"
                  />
                </div>
                <div>
                  <label htmlFor="username" className="block">
                    Username
                  </label>
                  <Field
                    type="text"
                    id="username"
                    name="username"
                    className="input"
                  />
                  <ErrorMessage
                    name="username"
                    component="span"
                    className="error"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Field
                    type="checkbox"
                    id="is_super_admin"
                    name="is_super_admin"
                  />
                  <label htmlFor="is_super_admin" className="block">
                    Is Super Admin
                  </label>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  Update User
                </Button>
              </Form>
            )}
          </Formik>
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
              <Formik
                initialValues={{
                  date: selectedAttendance.date,
                  beer_count: selectedAttendance.beer_count,
                  tent_ids: selectedAttendance.tent_ids || [],
                }}
                validationSchema={AttendanceSchema}
                onSubmit={handleUpdateAttendance}
                enableReinitialize
              >
                {({ isSubmitting, setFieldValue, values }) => (
                  <Form className="space-y-4">
                    <div>
                      <label htmlFor="date" className="block">
                        Date
                      </label>
                      <Field
                        type="date"
                        id="date"
                        name="date"
                        className="border p-1"
                      />
                      <ErrorMessage
                        name="date"
                        component="div"
                        className="text-red-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="beer_count" className="block">
                        Beer Count
                      </label>
                      <Field
                        type="number"
                        id="beer_count"
                        name="beer_count"
                        className="border p-1"
                      />
                      <ErrorMessage
                        name="beer_count"
                        component="div"
                        className="text-red-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="tents" className="block">
                        Tents
                      </label>
                      <TentSelector
                        selectedTents={values.tent_ids}
                        onTentsChange={(tents) =>
                          setFieldValue("tent_ids", tents)
                        }
                      />
                    </div>
                    <Button type="submit" disabled={isSubmitting}>
                      Update Attendance
                    </Button>
                  </Form>
                )}
              </Formik>
            )}
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default UserList;
