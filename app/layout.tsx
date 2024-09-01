import { createClient } from "@/utils/supabase/server";
import SupabaseProvider from "@/lib/supabase-provider";

import "@/styles/globals.css";
import { Metadata } from "next";
import Navbar from "@/components/Navbar";

// do not cache this layout
export const revalidate = 0;

export const metadata: Metadata = {
  description: "Oktoberfest attendance registering app",
  title: "ProstCounter 🍻",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center sm:py-2">
          <Navbar session={session} />
          <main className="flex w-full flex-1 shrink-0 flex-col items-center sm:justify-center p-8 text-center sm:px-20 bg-slate-50">
            <SupabaseProvider session={session}>{children}</SupabaseProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
