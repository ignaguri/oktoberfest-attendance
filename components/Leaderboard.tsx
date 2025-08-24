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

import type { Views } from "@/lib/database-helpers.types";
import type { WinningCriteria } from "@/lib/types";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import Avatar from "./Avatar/Avatar";
import { ProfilePreview } from "./ui/profile-preview";

type LeaderboardEntry = Views<"leaderboard"> & {
  group_count?: number;
};

const getDisplayName = ({
  username,
  full_name,
}: Pick<LeaderboardEntry, "full_name" | "username">) => {
  if (full_name) {
    return full_name;
  }
  if (username) {
    return username;
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
            fullName={entry.full_name}
            avatarUrl={entry.avatar_url}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                url={entry.avatar_url}
                fallback={{
                  username: entry.username,
                  full_name: entry.full_name,
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
      accessorKey: "days_attended",
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
      accessorKey: "total_beers",
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
      cell: ({ row }) => `${row.original.total_beers} 🍺`,
    },
    {
      accessorKey: "avg_beers",
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
      cell: ({ row }) => row.original.avg_beers?.toFixed(2),
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
