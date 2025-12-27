import { createClient } from "@/utils/supabase/server";

import type { AttendanceResult } from "./AttendanceTable";

import AttendanceTable from "./AttendanceTable";

export default async function Results() {
  const supabase = await createClient();

  const retrieveAttendance = async () => {
    const { data } = await supabase
      .from("results")
      .select()
      .order("total_days", { ascending: false })
      .order("total_liters", { ascending: false });

    if (!data) {
      return [];
    }

    const formattedData: AttendanceResult[] = data.map((item) => ({
      avatarUrl: item.avatar_url || undefined,
      username: item.username || undefined,
      fullName: item.full_name || undefined,
      email: item.email || "",
      totalDays: item.total_days || 0,
      totalLiters: item.total_liters || 0,
      averageLiters: item.average_liters || 0,
    }));

    return formattedData;
  };

  const tableData = await retrieveAttendance();

  return (
    <div className="flex flex-col min-w-[20rem] items-center gap-4 mt-4 shadow-md sm:min-w-[24rem]">
      <h2 className="w-full text-center p-2">Results</h2>
      <h4 className="text-center">
        Who went more times to this year&apos;s Wiesn?
      </h4>
      <AttendanceTable data={tableData} />
    </div>
  );
}
