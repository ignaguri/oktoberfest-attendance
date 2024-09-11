"use client";

import { useSupabase } from "@/hooks/useSupabase";
import { Tables } from "@/lib/database.types";
import clearCachesByServerAction from "@/utils/revalidate";
import { useState, useCallback } from "react";
import Image from "next/image";

// Import SVG icons
import EyeOpenIcon from "@/public/icons/eye-open.svg";
import EyeClosedIcon from "@/public/icons/eye-closed.svg";

type Props = {
  group: Tables<"groups">;
  members: Tables<"profiles">[];
};

export default function GroupSettingsClient({ group, members }: Props) {
  const { supabase, user } = useSupabase();

  const isCreator = group.created_by === user?.id;

  const [name, setName] = useState(group.name);
  const [password, setPassword] = useState(group.password);
  const [showPassword, setShowPassword] = useState(false);

  const handleUpdateGroup = useCallback(async () => {
    if (!isCreator) {
      alert("Only the group creator can update group details.");
      return;
    }

    const { error } = await supabase
      .from("groups")
      .update({ name, password })
      .eq("id", group.id);

    if (error) {
      alert("Error updating group: " + error.message);
    } else {
      alert("Group updated successfully!");
    }
  }, [group.id, isCreator, name, password, supabase]);

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
          <div className="space-y-4">
            <div>
              <label
                htmlFor="groupName"
                className="block text-sm font-medium text-gray-700"
              >
                Group Name
              </label>
              <input
                type="text"
                id="groupName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                disabled={!isCreator}
              />
            </div>
            <div>
              <label
                htmlFor="groupPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Group Password
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  id="groupPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  disabled={!isCreator}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                >
                  <Image
                    src={showPassword ? EyeClosedIcon : EyeOpenIcon}
                    alt={showPassword ? "Hide password" : "Show password"}
                    width={20}
                    height={20}
                  />
                </button>
              </div>
            </div>
            {isCreator && (
              <div className="flex justify-center">
                <button onClick={handleUpdateGroup} className="button-inverse">
                  Update Group
                </button>
              </div>
            )}
          </div>
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
                    <button
                      className="text-red-600 hover:text-red-900 underline disabled:text-gray-400 disabled:no-underline"
                      disabled={member.id === user?.id}
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      Kick out
                    </button>
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
