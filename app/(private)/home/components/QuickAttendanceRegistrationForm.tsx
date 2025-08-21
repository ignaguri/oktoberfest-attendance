"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import { useFestival } from "@/contexts/FestivalContext";
import { useTents } from "@/hooks/use-tents";
import { useToast } from "@/hooks/use-toast";
import { addAttendance, fetchAttendanceByDate } from "@/lib/sharedActions";
import { Formik, Form, Field } from "formik";
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
  }, [toast, onAttendanceIdReceived, currentFestival]);

  const handleSubmit = async (
    values: { tentId: string; beerCount: number },
    { setSubmitting }: { setSubmitting: (isSubmitting: boolean) => void },
  ) => {
    if (!currentFestival) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No festival selected. Please select a festival.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const allVisitedTents = [...(attendanceData?.tent_ids ?? [])];

      // Check if the last tent ID is the same as the new tent ID
      if (allVisitedTents[allVisitedTents.length - 1] !== values.tentId) {
        allVisitedTents.push(values.tentId);
      }

      const newAttendanceId = await addAttendance({
        amount: values.beerCount,
        date: new Date(),
        tents: allVisitedTents,
        festivalId: currentFestival.id,
      });
      const updatedAttendance: AttendanceByDate = {
        ...attendanceData!,
        id: newAttendanceId,
        beer_count: values.beerCount,
        tent_ids: allVisitedTents,
      };
      setAttendanceData(updatedAttendance);
      onAttendanceIdReceived(newAttendanceId);

      const tentName = tents
        ?.flatMap((tentGroup) => tentGroup.options)
        .find((tent) => tent.value === values.tentId)?.label;

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
    } finally {
      setSubmitting(false);
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
    <Formik
      initialValues={{
        tentId:
          attendanceData?.tent_ids[attendanceData.tent_ids.length - 1] || "",
        beerCount: attendanceData?.beer_count || 0,
      }}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      {({ values, isSubmitting, setFieldValue, submitForm }) => (
        <Form className="flex flex-col items-center gap-4">
          {!attendanceData && <p>Are you at {currentFestival.name} today?</p>}
          <div className="flex items-center gap-2">
            <span>{attendanceData ? "You are at:" : "Which tent?"}</span>
            <Field name="tentId">
              {({ field }: { field: any }) => (
                <SingleSelect
                  {...field}
                  buttonClassName="w-fit self-center"
                  options={tents.map((tent) => ({
                    title: tent.category,
                    options: tent.options,
                  }))}
                  placeholder="Select your current tent"
                  onSelect={(option) => {
                    setFieldValue("tentId", option.value);
                    submitForm();
                  }}
                  disabled={isSubmitting}
                />
              )}
            </Field>
          </div>
          {attendanceData && (
            <div className="flex items-center">
              <Button
                type="button"
                variant="yellow"
                onClick={() => {
                  setFieldValue("beerCount", Math.max(0, values.beerCount - 1));
                  submitForm();
                }}
                disabled={isSubmitting}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="mx-2">{values.beerCount} 🍺 drank today</span>
              <Button
                type="button"
                variant="yellow"
                onClick={() => {
                  setFieldValue("beerCount", values.beerCount + 1);
                  submitForm();
                }}
                disabled={isSubmitting}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Form>
      )}
    </Formik>
  );
};
