"use client";

import { useState, useEffect } from "react";
import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  getUsers,
  updateUserAuth,
  updateUserProfile,
  deleteUser,
  getGroups,
  updateGroup,
  deleteGroup,
  getUserAttendances,
  updateAttendance,
  deleteAttendance,
} from "./actions";
import { Tables } from "@/lib/database.types";
import { User } from "@supabase/supabase-js";
import TentSelector from "@/components/TentSelector";

type CombinedUser = User & { profile: Tables<"profiles"> };

const UserSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().min(8, "Password must be at least 8 characters"),
  full_name: Yup.string(),
  username: Yup.string(),
  is_super_admin: Yup.boolean(),
});

const GroupSchema = Yup.object().shape({
  name: Yup.string().required("Required"),
  description: Yup.string(),
});

const AttendanceSchema = Yup.object().shape({
  date: Yup.date().required("Required"),
  beer_count: Yup.number().min(0, "Must be at least 0").required("Required"),
  tent_ids: Yup.array()
    .of(Yup.string())
    .required("At least one tent must be selected"),
});

interface AttendanceWithTents extends Tables<"attendances"> {
  tent_ids?: string[];
}

export default function AdminPage() {
  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [groups, setGroups] = useState<Tables<"groups">[]>([]);
  const [selectedUser, setSelectedUser] = useState<CombinedUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Tables<"groups"> | null>(
    null,
  );
  const [attendances, setAttendances] = useState<Tables<"attendances">[]>([]);
  const [selectedAttendance, setSelectedAttendance] =
    useState<AttendanceWithTents | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

  async function fetchUsers() {
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers as CombinedUser[]);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  async function fetchGroups() {
    try {
      const fetchedGroups = await getGroups();
      setGroups(fetchedGroups);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  }

  async function fetchAttendances(userId: string) {
    try {
      const fetchedAttendances = await getUserAttendances(userId);
      setAttendances(fetchedAttendances);
    } catch (error) {
      console.error("Error fetching attendances:", error);
    }
  }

  async function handleUserSelect(user: CombinedUser) {
    setSelectedAttendance(null);
    setSelectedUser(user);
    await fetchAttendances(user.id);
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
  }

  async function handleDeleteUser(userId: string) {
    try {
      await deleteUser(userId);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  }

  async function handleUpdateGroup(values: any, { setSubmitting }: any) {
    if (!selectedGroup) return;
    try {
      await updateGroup(selectedGroup.id, values);
      fetchGroups();
      setSelectedGroup(null);
      toast({
        title: "Success",
        variant: "success",
        description: "Group updated successfully",
      });
    } catch (error) {
      console.error("Error updating group:", error);
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  }

  async function handleDeleteGroup(groupId: string) {
    try {
      await deleteGroup(groupId);
      fetchGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <div id="user-list">
          <h2 className="text-xl font-semibold mb-2">User List</h2>
          <ul>
            {users.map((user) => (
              <li key={user.id} className="mb-2">
                {user.profile?.full_name || "N/A"} ({user.email})
                <button
                  onClick={() => handleUserSelect(user)}
                  className="ml-2 bg-blue-500 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="ml-2 bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {selectedUser && (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Edit User</h2>
                <Formik
                  initialValues={{
                    email: selectedUser.email,
                    password: "",
                    full_name: selectedUser.profile?.full_name || "",
                    username: selectedUser.profile?.username || "",
                    is_super_admin:
                      selectedUser.profile?.is_super_admin || false,
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
              </div>
              <div id="attendances">
                <h2 className="text-xl font-semibold mb-2">Attendances</h2>
                {attendances.map((attendance) => (
                  <li key={attendance.id} className="mb-2">
                    {attendance.date.toString()} - {attendance.beer_count} beers
                    <button
                      onClick={() => handleDeleteAttendance(attendance.id)}
                      className="ml-2 bg-red-500 text-white px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setSelectedAttendance(attendance)}
                      className="ml-2 bg-yellow-500 text-white px-2 py-1 rounded"
                    >
                      Edit
                    </button>
                  </li>
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
            </div>
          )}
        </div>
        <div id="group-list">
          <h2 className="text-xl font-semibold mb-2">Group List</h2>
          <ul>
            {groups.map((group) => (
              <li key={group.id} className="mb-2">
                {group.name}
                <button
                  onClick={() => setSelectedGroup(group)}
                  className="ml-2 bg-blue-500 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="ml-2 bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {selectedGroup && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">Edit Group</h2>
              <Formik
                initialValues={{
                  name: selectedGroup.name,
                  description: selectedGroup.description || "",
                }}
                validationSchema={GroupSchema}
                onSubmit={handleUpdateGroup}
                enableReinitialize
              >
                {({ isSubmitting }) => (
                  <Form className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block">
                        Group Name
                      </label>
                      <Field
                        type="text"
                        id="name"
                        name="name"
                        className="input"
                      />
                      <ErrorMessage
                        name="name"
                        component="span"
                        className="error"
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="block">
                        Description
                      </label>
                      <Field
                        as="textarea"
                        id="description"
                        name="description"
                        className="input"
                      />
                      <ErrorMessage
                        name="description"
                        component="span"
                        className="error"
                      />
                    </div>
                    <Button type="submit" disabled={isSubmitting}>
                      Update Group
                    </Button>
                  </Form>
                )}
              </Formik>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
