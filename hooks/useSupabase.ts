import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

import type { User } from "@supabase/supabase-js";

export function useSupabase() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: fetchedUser },
      } = await supabase.auth.getUser();
      if (!fetchedUser) {
        router.push("/sign-in");
      } else {
        setUser(fetchedUser);
      }
      setLoading(false);
    };

    getUser();
  }, [router, supabase]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        router.push("/sign-in");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const memoizedUser = useMemo(() => {
    if (loading) return null;
    return {
      id: user?.id,
      email: user?.email,
      role: user?.role,
    };
  }, [user, loading]);

  return { user: memoizedUser, supabase };
}
