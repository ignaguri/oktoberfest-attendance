import { useSupabase } from "@/hooks/useSupabase";
import { useRef, useState } from "react";

export const JoinGroup = ({
  onGroupJoined,
}: {
  onGroupJoined: (groupId: string) => void;
}) => {
  const { supabase, user } = useSupabase();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [groupName, setGroupName] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      return;
    }

    const { data: groupId, error } = await supabase.rpc("join_group", {
      p_user_id: user?.id,
      p_group_name: groupName,
      p_password: password,
    });

    if (error || !groupId) {
      alert("Something went wrong. Check group name or password.");
      nameInputRef.current?.focus();
    } else {
      setGroupName("");
      setPassword("");
      onGroupJoined(groupId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <h3 className="text-xl font-semibold">Join a Group</h3>
      <input
        type="text"
        placeholder="Group Name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="w-full p-2 border rounded"
        required
        ref={nameInputRef}
      />
      <input
        type="password"
        placeholder="Group Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
        required
        ref={passwordInputRef}
      />
      <button
        type="submit"
        className="w-full p-2 bg-green-500 text-white rounded"
      >
        Join Group
      </button>
    </form>
  );
};
