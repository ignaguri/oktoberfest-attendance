import { useSupabase } from "@/hooks/useSupabase";
import { useState } from "react";

type Props = {
  groupId: string;
  onLogSubmitted: () => void;
};

export const DailyLog = ({ groupId, onLogSubmitted }: Props) => {
  const { supabase, user } = useSupabase();
  const [beerCount, setBeerCount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("attendances").upsert(
      {
        user_id: user?.id,
        group_id: groupId,
        date,
        beer_count: beerCount,
      },
      {
        onConflict: "user_id,group_id,date",
      },
    );

    console.log("data, error :>> ", data, error);

    if (data) {
      alert("Attendance logged successfully!");
      setBeerCount(0);
      onLogSubmitted();
    } else if (error) {
      alert("Error logging attendance: " + error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-semibold">Log Daily Attendance</h2>
      <div>
        <label
          htmlFor="date"
          className="block text-sm font-medium text-gray-700"
        >
          Date
        </label>
        <input
          type="date"
          id="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          required
        />
      </div>
      <div>
        <label
          htmlFor="beerCount"
          className="block text-sm font-medium text-gray-700"
        >
          Beers Consumed
        </label>
        <input
          type="number"
          id="beerCount"
          value={beerCount}
          onChange={(e) => setBeerCount(parseInt(e.target.value))}
          min="0"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-blue-500 text-white rounded-md py-2 px-4 hover:bg-blue-600"
      >
        Log Attendance
      </button>
    </form>
  );
};
