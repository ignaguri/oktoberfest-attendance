import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import AttendanceForm from "./AttendanceForm";

export default async function Attendance() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <AttendanceForm />;
}
