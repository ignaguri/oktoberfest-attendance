import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import SupabaseProvider from "@/lib/supabase-provider";

import "@/styles/globals.css";

// do not cache this layout
export const revalidate = 0;

export const metadata = {
  description: "Oktoberfest attendance registering app",
  title: "ProstCounter",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center py-2">
          <main className="flex w-full flex-1 shrink-0 flex-col items-center justify-center px-8 text-center sm:px-20">
            <h1 className="mb-12 text-5xl font-bold sm:text-6xl">
              <span className="font-extrabold text-yellow-600">
                ProstCounter
              </span>{" "}
              🍻
            </h1>
            <SupabaseProvider session={session}>{children}</SupabaseProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
