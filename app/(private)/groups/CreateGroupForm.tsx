import { useSupabase } from "@/hooks/useSupabase";
import { useState } from "react";

export const CreateGroup = ({
  onGroupCreated,
}: {
  onGroupCreated: (groupId: string) => void;
}) => {
  const { supabase, user } = useSupabase();
  const [groupName, setGroupName] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      return;
    }

    const { data, error } = await supabase.rpc("create_group_with_member", {
      p_group_name: groupName,
      p_password: password,
      p_user_id: user.id,
    });

    if (error) {
      console.error("Error creating group", error);
      return;
    }

    if (data) {
      setGroupName("");
      setPassword("");
      alert("Group created successfully!");
      onGroupCreated(data.group_id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <h3 className="text-xl font-semibold">Create a New Group</h3>
      <input
        type="text"
        placeholder="Group Name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />
      <input
        type="password"
        placeholder="Group Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />
      <button
        type="submit"
        className="w-full p-2 bg-blue-500 text-white rounded"
      >
        Create Group
      </button>
    </form>
  );
};
