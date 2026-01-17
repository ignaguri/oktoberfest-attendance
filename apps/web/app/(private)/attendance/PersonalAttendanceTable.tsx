"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "date-fns/format";
import { Beer, Tent, Trash } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { useDeleteAttendance } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";

import type { AttendanceWithTentVisits } from "./page";

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
  const { t } = useTranslation();
  const [isVisitedTentsDialogOpen, setVisitedTentsDialogOpen] = useState(false);
  const [isDeleteAttendanceDialogOpen, setDeleteAttendanceDialogOpen] =
    useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<string | null>(
    null,
  );
  const { mutate: deleteAttendanceMutation, loading: isDeleting } =
    useDeleteAttendance();

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
        await deleteAttendanceMutation(attendanceId);
        toast.success(t("notifications.success.attendanceDeleted"));
        setSelectedAttendance(null);
        onAttendanceDelete();
      } catch {
        toast.error(t("notifications.error.attendanceDeleteFailed"));
      }
    },
    [deleteAttendanceMutation, onAttendanceDelete, t],
  );

  const columns: ColumnDef<AttendanceWithTentVisits>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("attendance.table.date")}
        />
      ),
      cell: ({ row }) => formatDate(new Date(row.original.date), "dd/MM/yyyy"),
    },
    {
      accessorKey: "beerCount",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("attendance.table.amount")}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <span>{row.original.beerCount}</span>
          <Beer size={24} />
        </div>
      ),
    },
    {
      accessorKey: "tentVisits",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("attendance.table.tents")}
        />
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
      <p className="text-xs text-gray-500">{t("attendance.selectToEdit")}</p>
      <DataTable
        columns={columns}
        data={data || []}
        onRowClick={(row) => onDateSelect(new Date(row.original.date))}
      />

      <ResponsiveDialog
        open={isVisitedTentsDialogOpen}
        onOpenChange={setVisitedTentsDialogOpen}
        title={t("attendance.table.visitedTents")}
        description={t("attendance.table.visitedTentsDescription")}
      >
        {selectedAttendance &&
          (tentVisitsForDate?.length === 0 ? (
            <div className="mb-4 flex justify-center">
              <p>{t("attendance.table.noTentsRegistered")}</p>
            </div>
          ) : (
            <div className="mb-8 p-4">
              <ul className="space-y-2">
                {tentVisitsForDate?.map((tentVisit) => (
                  <li
                    key={`${tentVisit.tentId}-${tentVisit.visitDate}`}
                    className="list-inside list-disc text-base text-gray-700"
                  >
                    <span className="font-semibold">{tentVisit.tentName}</span>
                    {tentVisit.visitDate ? (
                      <>
                        <span> - {t("attendance.table.checkIn")}: </span>
                        <span className="font-semibold">
                          {formatDate(new Date(tentVisit.visitDate), "p")}
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
            <DialogTitle>{t("attendance.delete.title")}</DialogTitle>
            <DialogDescription>
              {t("attendance.delete.confirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => setDeleteAttendanceDialogOpen(false)}
              >
                {t("common.buttons.cancel")}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (selectedAttendanceData) {
                  await handleDelete(selectedAttendanceData.id);
                  setDeleteAttendanceDialogOpen(false);
                }
              }}
            >
              {isDeleting
                ? t("common.buttons.loading")
                : t("common.buttons.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalAttendanceTable;
