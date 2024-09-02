"use client";

import { useCallback, useEffect, useState } from "react";

import Avatar from "@/components/Avatar";
import { useSupabase } from "@/hooks/useSupabase";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AccountForm() {
  const { user, supabase } = useSupabase();

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [fullname, setFullname] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar_url, setAvatarUrl] = useState<string | null>(null);

  const getProfile = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error, status } = await supabase
        .from("profiles")
        .select(`full_name, username, avatar_url`)
        .eq("id", user?.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setFullname(data.full_name);
        setUsername(data.username);
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      alert("Error loading user data!");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      getProfile();
    }
  }, [user, getProfile]);

  async function updateProfile({
    username,
    avatar_url,
  }: {
    username: string | null;
    fullname: string | null;
    avatar_url: string | null;
  }) {
    try {
      setLoading(true);

      const { error } = await supabase.from("profiles").upsert({
        avatar_url,
        full_name: fullname,
        id: user?.id as string,
        updated_at: new Date().toISOString(),
        username,
      });

      if (error) throw error;

      alert("Profile updated!");
    } catch (error) {
      alert("Error updating the data!");
    } finally {
      setLoading(false);
      setIsEditing(false);
    }
  }

  if (!user) {
    return <LoadingSpinner />;
  }

  return (
    <div className="card">
      <h2>Your Profile</h2>
      <Avatar
        className="justify-self-center mb-4"
        isEditing={isEditing}
        size="large"
        uid={user.id}
        url={avatar_url}
        onUpload={(url) => {
          setAvatarUrl(url);
          updateProfile({
            avatar_url: url,
            fullname,
            username,
          });
        }}
      />
      <div className="rounded-lg border border-gray-300">
        <p className="p-2 font-semibold">{user.email}</p>
      </div>
      <div className="grid grid-cols-2 items-center">
        <label htmlFor="fullName">Full Name</label>
        <input
          className="input"
          disabled={!isEditing}
          id="fullName"
          type="text"
          value={fullname || ""}
          onChange={(e) => setFullname(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 items-center">
        <label htmlFor="username">Username</label>
        <input
          className="input"
          disabled={!isEditing}
          id="username"
          type="text"
          value={username || ""}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        {isEditing ? (
          <div className="flex flex-col gap-2 mt-4">
            <button
              className="button"
              onClick={() =>
                updateProfile({
                  avatar_url,
                  fullname,
                  username,
                })
              }
              disabled={loading}
            >
              {loading ? "Loading..." : "Update"}
            </button>
            <button
              className="button"
              onClick={() => setIsEditing(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="button mt-4"
            onClick={() => setIsEditing(true)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Edit"}
          </button>
        )}
      </div>
    </div>
  );
}
