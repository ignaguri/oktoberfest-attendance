/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createContext, useContext, useEffect } from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Session, SupabaseClient } from "@supabase/supabase-js";

export type MaybeSession = Session | null;

type SupabaseContext = {
  supabase: SupabaseClient<any, string>;
  session: MaybeSession;
};

const Context = createContext<SupabaseContext | undefined>(undefined);

export default function SupabaseProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: MaybeSession;
}) {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, _session) => {
      if (_session?.access_token !== session?.access_token) {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase, session]);

  return (
    <Context.Provider value={{ session, supabase }}>
      <>{children}</>
    </Context.Provider>
  );
}

export const useSupabase = <
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
>() => {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error("useSupabase must be used inside SupabaseProvider");
  }

  return context.supabase as SupabaseClient<Database, SchemaName>;
};

export const useSession = () => {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error("useSession must be used inside SupabaseProvider");
  }

  return context.session;
};
