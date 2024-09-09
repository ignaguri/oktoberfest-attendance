"use client";

import { useState } from "react";
import cn from "classnames";
import Avatar from "@/components/Avatar/Avatar";
import Image from "next/image";

import UpAndDownArrowIcon from "@/public/icons/up-down-arrows-fa.svg";
import LoadingSpinner from "@/components/LoadingSpinner";

const ICON_SIZE = 12;

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
}

const AttendanceTable = ({ data }: AttendanceTableProps) => {
  const [tableData, setTableData] = useState(data);
  const [sortKey, setSortKey] = useState("");

  if (!tableData) {
    return <LoadingSpinner />;
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
          <th className="max-w-[164px] sm:max-w-full px-0 py-1 sm:px-4 sm:py-2">
            Name
          </th>
          <th
            className="px-2 py-1 sm:px-4 sm:py-2 cursor-pointer"
            onClick={() => handleSort("totalDays")}
          >
            <div className="flex items-center gap-1">
              Days
              <Image
                width={ICON_SIZE}
                height={ICON_SIZE}
                src={UpAndDownArrowIcon}
                alt="Sort"
                style={{ height: ICON_SIZE, width: ICON_SIZE }}
              />
            </div>
          </th>
          <th
            className="px-2 py-1 sm:px-4 sm:py-2 cursor-pointer"
            onClick={() => handleSort("totalLiters")}
          >
            <div className="flex items-center gap-1">
              Liters
              <Image
                width={ICON_SIZE}
                height={ICON_SIZE}
                src={UpAndDownArrowIcon}
                alt="Sort"
                style={{ height: ICON_SIZE, width: ICON_SIZE }}
              />
            </div>
          </th>
          <th
            className="px-2 py-1 sm:px-4 sm:py-2 cursor-pointer"
            onClick={() => handleSort("averageLiters")}
          >
            <div className="flex items-center gap-1">
              Avg.
              <Image
                width={ICON_SIZE}
                height={ICON_SIZE}
                src={UpAndDownArrowIcon}
                alt="Sort"
                style={{ height: ICON_SIZE, width: ICON_SIZE }}
              />
            </div>
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
              <Avatar url={item.avatarUrl ?? null} size="small" />
            </td>
            <td className="max-w-[164px] sm:max-w-full px-0 py-1 sm:px-4 sm:py-2 leading-none truncate">
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
