import LoadingSpinner from "@/components/LoadingSpinner";
import { formatDate } from "date-fns/format";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { useMemo, useState } from "react";

import type { AttendanceWithTentVisits } from "./page";
import { Tent } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PersonalAttendanceTableProps {
  data?: AttendanceWithTentVisits[];
  onDateSelect: (date: Date) => void;
}

const PersonalAttendanceTable = ({
  data,
  onDateSelect,
}: PersonalAttendanceTableProps) => {
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

  const handleRowClick = (date: Date) => {
    onDateSelect(date);
  };

  const handleTentClick = (attendance: string) => {
    setSelectedAttendance(attendance);
    setDialogOpen(true);
    onDateSelect(new Date(attendance));
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
            <tr
              key={date.toString()}
              onClick={() => handleRowClick(new Date(date))}
            >
              <td className="px-6 py-4 whitespace-nowrap cursor-pointer">
                {formatDate(date, "dd/MM/yyyy")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {`${beer_count ? "🍺".repeat(beer_count) : ""}`}
              </td>
              <td className="px-6 py-4 whitespace-nowrap cursor-pointer">
                <Button
                  variant="outline"
                  className="flex items-center gap-1"
                  onClick={() => handleTentClick(date)}
                >
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
        {selectedAttendance &&
          (tentVisitsForDate?.length === 0 ? (
            <div className="flex justify-center mb-4">
              <p>No tents registered on this date.</p>
            </div>
          ) : (
            <ul className="p-4 space-y-2">
              {tentVisitsForDate?.map((tentVisit) => (
                <li
                  key={`${tentVisit.tent_id}-${tentVisit.visit_date}`}
                  className="text-base text-gray-700"
                >
                  Tent:{" "}
                  <span className="font-semibold">{tentVisit.tentName}</span>
                  {tentVisit.visit_date ? (
                    <>
                      <span>- Check-in: </span>
                      <span className="font-semibold">
                        {formatDate(new Date(tentVisit.visit_date), "p")}
                      </span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ))}
      </ResponsiveDialog>
    </div>
  );
};

export default PersonalAttendanceTable;
