"use client";

import { useCallback, useEffect, useState } from "react";

import Avatar, { AvatarProps } from "@/components/Avatar";
import { createClient } from "@/utils/supabase/client";
import { Session } from "@supabase/supabase-js";

interface AvatarForSessionProps extends Omit<AvatarProps, "uid" | "url"> {
  session: Session;
}

export default function AvatarForSession({
  session,
  ...avatarProps
}: AvatarForSessionProps) {
  const supabase = createClient();

  const [avatar_url, setAvatarUrl] = useState<string | null>(null);

  const getAvatarUrl = useCallback(async () => {
    try {
      const { data, error, status } = await supabase
        .from("profiles")
        .select(`avatar_url`)
        .eq("id", session.user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error("Error loading user data!");
    }
  }, [session, supabase]);

  useEffect(() => {
    getAvatarUrl();
  }, [session, getAvatarUrl]);

  return <Avatar uid={session.user.id} url={avatar_url} {...avatarProps} />;
}
