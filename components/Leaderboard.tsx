"use client";

import { Views } from "@/lib/database-helpers.types";
import { useState } from "react";
import Avatar from "./Avatar/Avatar";
import { WinningCriteria } from "@/lib/types";

type LeaderboardEntry = Views<"leaderboard">;

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
}: {
  entries: LeaderboardEntry[];
  winningCriteria: WinningCriteria;
}) => {
  const [data, setData] = useState<LeaderboardEntry[]>(entries);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof LeaderboardEntry;
    direction: "asc" | "desc";
  } | null>(null);

  const sortData = (key: keyof LeaderboardEntry) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    const sortedData = [...data].sort((a, b) => {
      if (a[key] && b[key]) {
        if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
        if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    setData(sortedData);
    setSortConfig({ key, direction });
  };

  const getCrownEmoji = (columnKey: string) => {
    return columnKey === winningCriteria ? "👑 " : "";
  };

  return (
    <div className="max-w-full">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => sortData("days_attended")}
                >
                  {getCrownEmoji("days_attended")}Days{" "}
                  {sortConfig?.key === "days_attended" &&
                    (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => sortData("total_beers")}
                >
                  {getCrownEmoji("total_beers")}Liters{" "}
                  {sortConfig?.key === "total_beers" &&
                    (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => sortData("avg_beers")}
                >
                  {getCrownEmoji("avg_beers")}Avg.{" "}
                  {sortConfig?.key === "avg_beers" &&
                    (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((attendee, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Avatar url={attendee.avatar_url} size="small" />

                      <p className="text-xs sm:text-sm font-medium text-gray-900">
                        {getDisplayName(attendee)}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {attendee.days_attended}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {attendee.total_beers} 🍺
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {attendee.avg_beers?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
