"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { addAttendance, fetchAttendanceByDate } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus } from "lucide-react";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { useTents } from "@/hooks/use-tents";
import LoadingSpinner from "@/components/LoadingSpinner";

const QuickAttendanceRegistration = () => {
  const { toast } = useToast();
  const { tents, isLoading: tentsLoading, error: tentsError } = useTents();
  const [beerCount, setBeerCount] = useState<number | null>(null);
  const [attendanceExists, setAttendanceExists] = useState<boolean>(false);
  const [currentTents, setCurrentTents] = useState<string[]>([]);
  const [currentTent, setCurrentTent] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        setIsSubmitting(true);
        const attendance = await fetchAttendanceByDate(new Date());
        if (attendance && attendance.beer_count && attendance.beer_count >= 0) {
          setBeerCount(attendance.beer_count);
          setAttendanceExists(true);
          setCurrentTents(attendance.tent_ids || []);
          setCurrentTent(
            attendance.tent_ids?.[attendance.tent_ids.length - 1] || null,
          );
        } else {
          setBeerCount(0);
          setAttendanceExists(false);
          setCurrentTents([]);
          setCurrentTent(null);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load attendance data. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    loadAttendance();
  }, [toast]);

  const handleAddAttendance = async (tentId: string) => {
    try {
      setIsSubmitting(true);
      await addAttendance({ amount: 0, date: new Date(), tents: [tentId] });
      setBeerCount(0);
      setAttendanceExists(true);
      setCurrentTents([tentId]);
      setCurrentTent(tentId);
      const tentName = tents
        ?.flatMap((tentGroup) => tentGroup.options)
        .find((tent) => tent.value === tentId)?.label;

      toast({
        variant: "success",
        title: "Attendance Registered",
        description: tentName
          ? `Welcome to ${tentName}!`
          : "Welcome to the Wiesn!",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to register attendance. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeTent = async (option: { value: string; label: string }) => {
    try {
      setIsSubmitting(true);
      const updatedTents = [...currentTents, option.value];
      await addAttendance({
        amount: beerCount || 0,
        date: new Date(),
        tents: updatedTents,
      });
      setCurrentTents(updatedTents);
      setCurrentTent(option.value);
      toast({
        variant: "success",
        title: "Tent Updated",
        description: `You are now at ${option.label}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update tent. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBeer = async () => {
    const newBeerCount = (beerCount ?? 0) + 1;
    setBeerCount(newBeerCount);

    try {
      await addAttendance({
        amount: newBeerCount,
        date: new Date(),
        tents: currentTents,
      });
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
        await addAttendance({
          amount: newBeerCount,
          date: new Date(),
          tents: currentTents,
        });
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

  if (beerCount === null || tentsLoading) {
    return (
      <Button className="w-fit self-center" variant="yellow" disabled>
        <LoadingSpinner size={24} />
      </Button>
    );
  }

  if (tentsError) {
    return <div>Error: {tentsError}</div>;
  }

  if (!attendanceExists) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p>Are you at the Wiesn today?</p>
        <SingleSelect
          buttonClassName="w-fit self-center"
          options={tents.map((tent) => ({
            title: tent.category,
            options: tent.options,
          }))}
          placeholder="Select your current tent"
          onSelect={(option) => handleAddAttendance(option.value)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <span>You are at:</span>
        <SingleSelect
          buttonClassName="w-fit self-center"
          options={tents.map((tent) => ({
            title: tent.category,
            options: tent.options,
          }))}
          placeholder="Select your current tent"
          onSelect={handleChangeTent}
          value={currentTent}
          disabled={isSubmitting}
        />
      </div>
      <div className="flex items-center">
        <Button
          variant="yellow"
          onClick={handleRemoveBeer}
          disabled={isSubmitting}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <span className="mx-2">{beerCount} 🍺 drank today</span>
        <Button
          variant="yellow"
          onClick={handleAddBeer}
          disabled={isSubmitting}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default QuickAttendanceRegistration;
