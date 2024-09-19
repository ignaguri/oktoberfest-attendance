import LoadingSpinner from "@/components/LoadingSpinner";
import { formatDate } from "date-fns/format";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { useMemo, useState } from "react";

import type { AttendanceWithTentVisits } from "./page";
import { Tent } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PersonalAttendanceTableProps {
  data?: AttendanceWithTentVisits[];
}

const PersonalAttendanceTable = ({ data }: PersonalAttendanceTableProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<string | null>(
    null,
  );

  const tentVisitsForDate = useMemo(() => {
    return data?.find((attendance) => attendance.date === selectedAttendance)
      ?.tentVisits;
  }, [data, selectedAttendance]);

  if (!data) {
    return <LoadingSpinner />;
  }

  const handleTentClick = (attendance: string) => {
    setSelectedAttendance(attendance);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col items-center justify-center shadow-md">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tents
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map(({ date, beer_count, tentVisits }) => (
            <tr key={date.toString()}>
              <td className="px-6 py-4 whitespace-nowrap">
                {formatDate(date, "dd/MM/yyyy")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {`${beer_count ? "🍺".repeat(beer_count) : ""}`}
              </td>
              <td
                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                onClick={() => handleTentClick(date)}
              >
                <Button variant="outline" className="flex items-center gap-1">
                  <span>{tentVisits.length}</span>
                  <Tent size={24} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Visited Tents"
        description="Details of the tents you visited."
      >
        {selectedAttendance && (
          <ul>
            {tentVisitsForDate?.map((tentVisit) => (
              <li key={tentVisit.tent_id}>
                Tent Name: {tentVisit.tent_id} - Check-in Hour:{" "}
                {tentVisit.visit_date}
              </li>
            ))}
          </ul>
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default PersonalAttendanceTable;
