import AttendanceTable from "@/components/AttendanceTable";
import { DbResult } from "@/lib/database-helpers.types";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AttendanceResult } from "@/components/AttendanceTable";

export default async function Results() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const retrieveAttendance = async () => {
    const query = supabase
      .from("results")
      .select()
      .order("total_days", { ascending: false });

    const { data }: DbResult<typeof query> = await query;

    if (!data) {
      return [];
    }

    const formattedData: AttendanceResult[] = data.map((item) => ({
      avatarUrl: item.avatar_url,
      averageLiters: item.average_liters,
      email: item.email,
      fullName: item.full_name,
      totalDays: item.total_days,
      totalLiters: item.total_liters,
      username: item.username,
    }));

    return formattedData;
  };

  const tableData = await retrieveAttendance();

  return (
    <div className="flex flex-col min-w-[20rem] items-center gap-4 mt-4 shadow-md sm:min-w-[24rem]">
      <h2 className="w-full text-center p-2">Results</h2>
      <h4 className="text-center">Who went more times to this year's Wiesn?</h4>
      <AttendanceTable data={tableData} session={session} />
    </div>
  );
}
