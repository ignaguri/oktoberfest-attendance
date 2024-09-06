import LoadingSpinner from "@/components/LoadingSpinner";
import { Tables } from "@/lib/database.types";

type AttendanceDBType = Tables<"attendance">;

interface PersonalAttendanceTableProps {
  data?: Pick<AttendanceDBType, "date" | "liters">[];
}

const PersonalAttendanceTable = ({ data }: PersonalAttendanceTableProps) => {
  if (!data) {
    return <LoadingSpinner />;
  }

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
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => (
            <tr key={row.date.toString()}>
              <td className="px-6 py-4 whitespace-nowrap">
                {new Date(row.date).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {`${row.liters ? "🍺".repeat(row.liters) : ""}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PersonalAttendanceTable;
