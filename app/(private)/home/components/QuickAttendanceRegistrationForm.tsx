"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import { useFestival } from "@/contexts/FestivalContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTents } from "@/hooks/use-tents";
import { useToast } from "@/hooks/use-toast";
import { addAttendance, fetchAttendanceByDate } from "@/lib/sharedActions";
import { quickAttendanceSchema, QuickAttendanceFormData } from "@/lib/schemas/attendance";
import { Plus, Minus } from "lucide-react";
import { useEffect, useState } from "react";

import type { AttendanceByDate } from "@/lib/sharedActions";

interface QuickAttendanceRegistrationFormProps {
  onAttendanceIdReceived: (attendanceId: string) => void;
}

export const QuickAttendanceRegistrationForm = ({
  onAttendanceIdReceived,
}: QuickAttendanceRegistrationFormProps) => {
  const { toast } = useToast();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const { tents, isLoading: tentsLoading, error: tentsError } = useTents();
  const [attendanceData, setAttendanceData] = useState<AttendanceByDate | null>(
    null,
  );

  const {
    setValue,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<QuickAttendanceFormData>({
    resolver: zodResolver(quickAttendanceSchema),
    defaultValues: {
      tentId: "",
      beerCount: 0,
    },
  });

  const tentId = watch("tentId");
  const beerCount = watch("beerCount");

  useEffect(() => {
    const loadAttendance = async () => {
      if (!currentFestival) return;

      try {
        const attendance = await fetchAttendanceByDate(
          new Date(),
          currentFestival.id,
        );
        if (attendance) {
          setAttendanceData(attendance);
          onAttendanceIdReceived(attendance.id);
          setValue("tentId", attendance.tent_ids[attendance.tent_ids.length - 1] || "");
          setValue("beerCount", attendance.beer_count || 0);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load attendance data. Please try again.",
        });
      }
    };

    loadAttendance();
  }, [toast, onAttendanceIdReceived, currentFestival, setValue]);

  const onSubmit = async (data: QuickAttendanceFormData) => {
    if (!currentFestival) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No festival selected. Please select a festival.",
      });
      return;
    }

    try {
      const allVisitedTents = [...(attendanceData?.tent_ids ?? [])];

      // Check if the last tent ID is the same as the new tent ID
      if (allVisitedTents[allVisitedTents.length - 1] !== data.tentId) {
        allVisitedTents.push(data.tentId);
      }

      const newAttendanceId = await addAttendance({
        amount: data.beerCount,
        date: new Date(),
        tents: allVisitedTents,
        festivalId: currentFestival.id,
      });
      const updatedAttendance: AttendanceByDate = {
        ...attendanceData!,
        id: newAttendanceId,
        beer_count: data.beerCount,
        tent_ids: allVisitedTents,
      };
      setAttendanceData(updatedAttendance);
      onAttendanceIdReceived(newAttendanceId);

      const tentName = tents
        ?.flatMap((tentGroup) => tentGroup.options)
        .find((tent) => tent.value === data.tentId)?.label;

      toast({
        variant: "success",
        title: "Attendance Updated",
        description: tentName
          ? `Updated attendance for ${tentName}!`
          : `Updated attendance for ${currentFestival.name}!`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update attendance. Please try again.",
      });
    }
  };

  if (tentsLoading || festivalLoading || !currentFestival) {
    return (
      <Button className="w-fit self-center" variant="yellow" disabled>
        <LoadingSpinner size={24} />
      </Button>
    );
  }

  if (tentsError) {
    return <div>Error: {tentsError}</div>;
  }

  return (
    <form className="flex flex-col items-center gap-4">
      {!attendanceData && <p>Are you at {currentFestival.name} today?</p>}
      <div className="flex items-center gap-2">
        <span>{attendanceData ? "You are at:" : "Which tent?"}</span>
        <SingleSelect
          value={tentId}
          buttonClassName="w-fit self-center"
          options={tents.map((tent) => ({
            title: tent.category,
            options: tent.options,
          }))}
          placeholder="Select your current tent"
          onSelect={(option) => {
            setValue("tentId", option.value);
            handleSubmit(onSubmit)();
          }}
          disabled={isSubmitting}
        />
      </div>
      {attendanceData && (
        <div className="flex items-center">
          <Button
            type="button"
            variant="yellow"
            onClick={() => {
              setValue("beerCount", Math.max(0, beerCount - 1));
              handleSubmit(onSubmit)();
            }}
            disabled={isSubmitting}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="mx-2">{beerCount} 🍺 drank today</span>
          <Button
            type="button"
            variant="yellow"
            onClick={() => {
              setValue("beerCount", beerCount + 1);
              handleSubmit(onSubmit)();
            }}
            disabled={isSubmitting}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </form>
  );
};
