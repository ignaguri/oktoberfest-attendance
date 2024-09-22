"use client";

import { useMemo, useState } from "react";
import { formatDate } from "date-fns/format";
import { Beer, Tent } from "lucide-react";
import { Button } from "@/components/ui/button";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { DataTable } from "@/components/Table/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/Table/DataTableColumnHeader";

import type { AttendanceWithTentVisits } from "./page";

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

  const handleTentClick = (attendance: string) => {
    setSelectedAttendance(attendance);
    setDialogOpen(true);
    onDateSelect(new Date(attendance));
  };

  const columns: ColumnDef<AttendanceWithTentVisits>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => formatDate(new Date(row.original.date), "dd/MM/yyyy"),
    },
    {
      accessorKey: "beer_count",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <span>{row.original.beer_count}</span>
          <Beer size={24} />
        </div>
      ),
    },
    {
      accessorKey: "tentVisits",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tents" />
      ),
      cell: ({ row }) => (
        <Button
          variant="outline"
          className="flex items-center justify-center gap-1"
          onClick={() => handleTentClick(row.original.date)}
        >
          <span>{row.original.tentVisits.length}</span>
          <Tent size={24} />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data || []}
        onRowClick={(row) => onDateSelect(new Date(row.original.date))}
      />

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
            <div className="p-4 mb-8">
              <ul className="space-y-2">
                {tentVisitsForDate?.map((tentVisit) => (
                  <li
                    key={`${tentVisit.tent_id}-${tentVisit.visit_date}`}
                    className="text-base text-gray-700 list-disc list-inside"
                  >
                    <span className="font-semibold">{tentVisit.tentName}</span>
                    {tentVisit.visit_date ? (
                      <>
                        <span> - Check-in: </span>
                        <span className="font-semibold">
                          {formatDate(new Date(tentVisit.visit_date), "p")}
                        </span>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </ResponsiveDialog>
    </div>
  );
};

export default PersonalAttendanceTable;
