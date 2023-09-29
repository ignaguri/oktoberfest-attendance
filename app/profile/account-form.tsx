"use client";

import { useCallback, useEffect, useState } from "react";

import { Database } from "@/lib/database.types";
import {
  Session,
  createClientComponentClient,
} from "@supabase/auth-helpers-nextjs";
import SignOut from "@/components/Auth/SignOut";
import Avatar from "@/components/Avatar";
import Link from "next/link";

interface AccountFormProps {
  user: Session["user"];
}

export default function AccountForm({ user }: AccountFormProps) {
  const supabase = createClientComponentClient<Database>();

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
        .eq("id", user.id)
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
    getProfile();
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
        id: user.id as string,
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

  return (
    <div className="card">
      <h2>Your Profile</h2>
      <Avatar
        className="justify-self-center mb-4"
        isEditing={isEditing}
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
          <button
            className="button justify-self-center mt-4"
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
        ) : (
          <button
            className="button justify-self-center mt-4"
            onClick={() => setIsEditing(true)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Edit"}
          </button>
        )}
      </div>
      <Link className="button" href="/">
        Go Home
      </Link>
      <SignOut />
    </div>
  );
}
