"use client";

import { useSupabase } from "@/hooks/useSupabase";
import { Tables } from "@/lib/database.types";
import { WinningCriteria, WinningCriteriaValues } from "@/lib/types";
import clearCachesByServerAction from "@/utils/revalidate";
import { useCallback, useState } from "react";
import Image from "next/image";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";

import EyeOpenIcon from "@/public/icons/eye-open.svg";
import EyeClosedIcon from "@/public/icons/eye-closed.svg";
import { winningCriteriaText } from "@/lib/constants";
import { Button } from "@/components/ui/button";

type Props = {
  group: Tables<"groups">;
  members: Tables<"profiles">[];
};

const GroupSettingsSchema = Yup.object().shape({
  name: Yup.string().required("Group name is required"),
  password: Yup.string().required("Password is required"),
  description: Yup.string(),
  winning_criteria: Yup.string()
    .oneOf(Object.values(WinningCriteriaValues))
    .required("Winning criteria is required"),
});

export default function GroupSettingsClient({ group, members }: Props) {
  const { supabase, user } = useSupabase();
  const isCreator = group.created_by === user?.id;
  const [showPassword, setShowPassword] = useState(false);

  const handleUpdateGroup = useCallback(
    async (
      values: Partial<Tables<"groups">>,
      { setSubmitting }: { setSubmitting: (isSubmitting: boolean) => void },
    ) => {
      if (!isCreator) {
        alert("Only the group creator can update group details.");
        setSubmitting(false);
        return;
      }

      try {
        const { error } = await supabase
          .from("groups")
          .update({
            name: values.name,
            password: values.password,
            description: values.description,
            winning_criteria: values.winning_criteria,
          })
          .eq("id", group.id);

        if (error) {
          alert("Error updating group: " + error.message);
        } else {
          alert("Group updated successfully!");
          clearCachesByServerAction(`/groups/${group.id}`);
        }
      } catch (error) {
        console.error("Error updating group:", error);
        alert("An unexpected error occurred while updating the group.");
      } finally {
        setSubmitting(false);
      }
    },
    [group.id, isCreator, supabase],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!isCreator) {
        alert("Only the group creator can remove members.");
        return;
      }

      if (confirm("Are you sure you want to remove this member?")) {
        const { error } = await supabase
          .from("group_members")
          .delete()
          .match({ group_id: group.id, user_id: userId });

        if (error) {
          alert("Error removing member: " + error.message);
        } else {
          alert("Member removed successfully!");
          clearCachesByServerAction(`/groups/${group.id}`);
        }
      }
    },
    [group.id, isCreator, supabase],
  );

  return (
    <div className="w-full max-w-lg space-y-6">
      <h2 className="text-2xl font-semibold">Group Settings</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Group Details
          </h3>
          <Formik
            initialValues={{
              name: group.name,
              password: group.password,
              description: group.description || "",
              winning_criteria: group.winning_criteria,
            }}
            validationSchema={GroupSettingsSchema}
            onSubmit={handleUpdateGroup}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Group Name
                  </label>
                  <Field
                    type="text"
                    id="name"
                    name="name"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    disabled={!isCreator}
                  />
                  <ErrorMessage
                    name="name"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Group Password
                  </label>
                  <div className="relative mt-1">
                    <Field
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      disabled={!isCreator}
                    />
                    <Button
                      variant="ghost"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <Image
                        src={showPassword ? EyeClosedIcon : EyeOpenIcon}
                        alt={showPassword ? "Hide password" : "Show password"}
                        width={20}
                        height={20}
                      />
                    </Button>
                  </div>
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Group Description
                  </label>
                  <Field
                    as="textarea"
                    id="description"
                    name="description"
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    disabled={!isCreator}
                  />
                  <ErrorMessage
                    name="description"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="winning_criteria"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Winning Criteria
                  </label>
                  <Field
                    as="select"
                    id="winning_criteria"
                    name="winning_criteria"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    disabled={!isCreator}
                  >
                    {Object.entries(WinningCriteriaValues).map(
                      ([key, value]) => (
                        <option key={key} value={value}>
                          {winningCriteriaText[value as WinningCriteria]}
                        </option>
                      ),
                    )}
                  </Field>
                  <ErrorMessage
                    name="winning_criteria"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                {isCreator && (
                  <div className="flex justify-center">
                    <Button
                      type="submit"
                      variant="yellow"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Updating..." : "Update Group"}
                    </Button>
                  </div>
                )}
              </Form>
            )}
          </Formik>
        </div>
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-2">Group Members</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              {isCreator && (
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.username || "–"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.full_name || "–"}
                </td>
                {isCreator && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:text-red-900 underline disabled:text-gray-400 disabled:no-underline"
                      disabled={member.id === user?.id}
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      Kick out
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
