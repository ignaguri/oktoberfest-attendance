"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { addAttendance, fetchAttendanceByDate } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus } from "lucide-react";

const QuickAttendanceRegistration = () => {
  const [beerCount, setBeerCount] = useState<number | null>(null);
  const [attendanceExists, setAttendanceExists] = useState<boolean>(false);
  const { toast } = useToast();
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    const checkAttendance = async () => {
      try {
        const attendance = await fetchAttendanceByDate(today);
        if (attendance) {
          setBeerCount(attendance.beer_count);
          setAttendanceExists(true);
        } else {
          setBeerCount(0);
        }
      } catch (error) {
        setAttendanceExists(false);
      }
    };

    checkAttendance();
  }, [today]);

  const handleAddAttendance = async () => {
    const newBeerCount = 0;

    try {
      await addAttendance({ amount: newBeerCount, date: today });
      setBeerCount(newBeerCount);
      setAttendanceExists(true);
      toast({
        variant: "success",
        title: "Attendance Registered",
        description: `You have registered your attendance for today with ${newBeerCount} beers.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to register attendance. Please try again.",
      });
    }
  };

  const handleAddBeer = async () => {
    const newBeerCount = (beerCount ?? 0) + 1;
    setBeerCount(newBeerCount);

    try {
      await addAttendance({ amount: newBeerCount, date: today });
      toast({
        variant: "success",
        title: "Attendance Updated",
        description: `You have added ${newBeerCount} beers for today.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update attendance. Please try again.",
      });
    }
  };

  const handleRemoveBeer = async () => {
    if (beerCount && beerCount > 0) {
      const newBeerCount = beerCount - 1;
      setBeerCount(newBeerCount);

      try {
        await addAttendance({ amount: newBeerCount, date: today });
        toast({
          variant: "success",
          title: "Attendance Updated",
          description: `You have updated your beers to ${newBeerCount} for today.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update attendance. Please try again.",
        });
      }
    }
  };

  return (
    <div className="flex flex-col items-center">
      {beerCount === null ? (
        <Button variant="yellow" disabled>
          Loading...
        </Button>
      ) : !attendanceExists ? (
        <Button variant="yellow" onClick={handleAddAttendance}>
          I&apos;m at Wiesn today!
        </Button>
      ) : (
        <div className="flex items-center">
          <Button variant="yellow" onClick={handleRemoveBeer}>
            <Minus className="w-4 h-4" />
          </Button>
          <span className="mx-2">{beerCount} 🍺 drank today</span>
          <Button variant="yellow" onClick={handleAddBeer}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default QuickAttendanceRegistration;
