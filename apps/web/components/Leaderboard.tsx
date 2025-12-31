"use client";

import { DataTableColumnHeader } from "@/components/Table/DataTableColumnHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Crown } from "lucide-react";
import { useState } from "react";

import type { WinningCriteria } from "@/lib/types";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import Avatar from "./Avatar/Avatar";
import { ProfilePreview } from "./ui/profile-preview";

// API response uses camelCase
type LeaderboardEntry = {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  daysAttended: number;
  totalBeers: number;
  avgBeers: number;
  position: number;
  group_count?: number;
};

const getDisplayName = ({
  username,
  fullName,
}: Pick<LeaderboardEntry, "fullName" | "username">) => {
  if (username) {
    return username;
  }
  if (fullName) {
    return fullName;
  }
  return "No name";
};

export const Leaderboard = ({
  entries,
  winningCriteria,
  showGroupCount = false,
}: {
  entries: LeaderboardEntry[];
  winningCriteria: WinningCriteria;
  showGroupCount?: boolean;
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<LeaderboardEntry>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const entry = row.original;

        return (
          <ProfilePreview
            username={entry.username || "Unknown"}
            fullName={entry.fullName}
            avatarUrl={entry.avatarUrl}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                url={entry.avatarUrl}
                fallback={{
                  username: entry.username,
                  full_name: entry.fullName,
                  email: "no.name@email.com",
                }}
              />
              <span className="font-medium line-clamp-2">
                {getDisplayName(entry)}
              </span>
            </div>
          </ProfilePreview>
        );
      },
    },
    {
      accessorKey: "daysAttended",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            <div className="flex items-center gap-1">
              {winningCriteria === "days_attended" && (
                <Crown className="text-yellow-500" size={16} />
              )}
              <span>Days</span>
            </div>
          }
        />
      ),
    },
    {
      accessorKey: "totalBeers",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            <div className="flex items-center gap-1">
              {winningCriteria === "total_beers" && (
                <Crown className="text-yellow-500" size={16} />
              )}
              <span>Liters</span>
            </div>
          }
        />
      ),
      cell: ({ row }) => `${row.original.totalBeers} 🍺`,
    },
    {
      accessorKey: "avgBeers",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            <div className="flex items-center gap-1">
              {winningCriteria === "avg_beers" && (
                <Crown className="text-yellow-500" size={16} />
              )}
              <span>Avg.</span>
            </div>
          }
        />
      ),
      cell: ({ row }) => row.original.avgBeers?.toFixed(2),
    },
  ];

  if (showGroupCount) {
    columns.push({
      accessorKey: "group_count",
      header: "Groups",
    });
  }

  const table = useReactTable({
    data: entries,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, index) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-100"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
