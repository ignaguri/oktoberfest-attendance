"use client";

import { useState } from "react";
import cn from "classnames";
import { Session } from "@supabase/supabase-js";
import Loading from "@/app/loading";
import Avatar from "./Avatar";

type SortableCols = "totalDays" | "totalLiters" | "averageLiters";

export type AttendanceResult = {
  avatarUrl?: string;
  username?: string;
  fullName?: string;
  email: string;
  totalDays: number;
  totalLiters: number;
  averageLiters: number;
};

interface AttendanceTableProps {
  data?: AttendanceResult[];
  session: Session;
}

const AttendanceTable = ({ data, session }: AttendanceTableProps) => {
  const [tableData, setTableData] = useState(data);
  const [sortKey, setSortKey] = useState("");

  if (!tableData) {
    return <Loading />;
  }

  const handleSort = (key: SortableCols) => {
    if (sortKey === key) {
      setTableData([...tableData].reverse());
    } else {
      setTableData([...tableData].sort((a, b) => (a[key] > b[key] ? 1 : -1)));
    }
    setSortKey(key);
  };

  const getDisplayName = ({
    username,
    fullName,
    email,
  }: {
    username?: string;
    fullName?: string;
    email: string;
  }) => {
    if (fullName) {
      return fullName;
    }
    if (username) {
      return username;
    }
    return email;
  };

  const getFormattedAvg = (avg: number) => {
    try {
      return Number(avg.toFixed(2));
    } catch (error) {
      console.error("Error parsing avg.", error);
      return 0;
    }
  };

  return (
    <table className="w-full bg-white rounded-lg shadow-md">
      <thead>
        <tr className="bg-gray-200">
          <th className="px-2 py-1 sm:px-4 sm:py-2"></th>
          <th className="px-2 py-1 sm:px-4 sm:py-2">Name</th>
          <th
            className="px-2 py-1 sm:px-4 sm:py-2 cursor-pointer"
            onClick={() => handleSort("totalDays")}
          >
            Days
          </th>
          <th
            className="px-2 py-1 sm:px-4 sm:py-2 cursor-pointer"
            onClick={() => handleSort("totalLiters")}
          >
            Liters
          </th>
          <th
            className="px-2 py-1 sm:px-4 sm:py-2 cursor-pointer"
            onClick={() => handleSort("averageLiters")}
          >
            Avg.
          </th>
        </tr>
      </thead>
      <tbody>
        {tableData.map((item, index) => (
          <tr
            key={index}
            className={cn({
              "bg-gray-100": index % 2 === 0,
              "bg-white": index % 2 !== 0,
            })}
          >
            <td className="px-2 py-1 sm:px-4 sm:py-2">
              <Avatar
                uid={session.user.id}
                url={item.avatarUrl ?? null}
                size="small"
              />
            </td>
            <td className="px-0 py-1 sm:px-4 sm:py-2 leading-none truncate">
              {getDisplayName(item)}
            </td>
            <td className="px-2 py-1 sm:px-4 sm:py-2">{item.totalDays}</td>
            <td className="px-2 py-1 sm:px-4 sm:py-2">{`${item.totalLiters}🍺`}</td>
            <td className="px-2 py-1 sm:px-4 sm:py-2">
              {getFormattedAvg(item.averageLiters)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AttendanceTable;
