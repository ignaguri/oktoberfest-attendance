"use client";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { DataTable } from "@/components/Table/DataTable";
import { DataTableColumnHeader } from "@/components/Table/DataTableColumnHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "date-fns/format";
import { Beer, Tent, Trash } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { AttendanceWithTentVisits } from "./page";
import type { ColumnDef } from "@tanstack/react-table";

import { deleteAttendance } from "./actions";

interface PersonalAttendanceTableProps {
  data?: AttendanceWithTentVisits[];
  onDateSelect: (date: Date) => void;
  onAttendanceDelete: () => void;
}

const PersonalAttendanceTable = ({
  data,
  onDateSelect,
  onAttendanceDelete,
}: PersonalAttendanceTableProps) => {
  const [isVisitedTentsDialogOpen, setVisitedTentsDialogOpen] = useState(false);
  const [isDeleteAttendanceDialogOpen, setDeleteAttendanceDialogOpen] =
    useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<string | null>(
    null,
  );
  const { toast } = useToast();

  const tentVisitsForDate = useMemo(() => {
    return data?.find((attendance) => attendance.date === selectedAttendance)
      ?.tentVisits;
  }, [data, selectedAttendance]);

  const selectedAttendanceData = useMemo(() => {
    return data?.find((attendance) => attendance.date === selectedAttendance);
  }, [data, selectedAttendance]);

  const handleTentClick = useCallback(
    (attendance: string) => {
      setSelectedAttendance(attendance);
      setVisitedTentsDialogOpen(true);
      onDateSelect(new Date(attendance));
    },
    [onDateSelect],
  );

  const handleDelete = useCallback(
    async (attendanceId: string) => {
      try {
        await deleteAttendance(attendanceId);

        toast({
          variant: "success",
          title: "Success",
          description: "Attendance deleted successfully.",
        });
        setSelectedAttendance(null);
        onAttendanceDelete();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete attendance. Please try again.",
        });
      }
    },
    [onAttendanceDelete, toast],
  );

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
    {
      id: "delete",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="" />
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="outline"
          className="flex items-center justify-center gap-1"
          onClick={() => {
            setSelectedAttendance(row.original.date);
            setDeleteAttendanceDialogOpen(true);
          }}
        >
          <Trash size={24} />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">Select any attendance to edit it</p>
      <DataTable
        columns={columns}
        data={data || []}
        onRowClick={(row) => onDateSelect(new Date(row.original.date))}
      />

      <ResponsiveDialog
        open={isVisitedTentsDialogOpen}
        onOpenChange={setVisitedTentsDialogOpen}
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
      <Dialog
        open={isDeleteAttendanceDialogOpen}
        onOpenChange={setDeleteAttendanceDialogOpen}
      >
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this attendance? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => setDeleteAttendanceDialogOpen(false)}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                if (selectedAttendanceData) {
                  await handleDelete(selectedAttendanceData.id);
                  setDeleteAttendanceDialogOpen(false);
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalAttendanceTable;
