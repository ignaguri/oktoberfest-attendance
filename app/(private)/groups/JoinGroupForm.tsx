"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFestival } from "@/contexts/FestivalContext";
import { joinGroupSchema } from "@/lib/schemas/groups";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { JoinGroupFormData } from "@/lib/schemas/groups";

import { joinGroup } from "./actions";

interface JoinGroupFormProps {
  groupName?: string;
  groupId?: string;
}

export const JoinGroupForm = ({ groupName }: JoinGroupFormProps) => {
  const { currentFestival } = useFestival();
  const [showPassword, setShowPassword] = useState(false);
  const router = useTransitionRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinGroupFormData>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: {
      groupName: groupName || "",
      password: "",
    },
  });

  const onSubmit = async (data: JoinGroupFormData) => {
    if (!currentFestival) {
      toast.error("No festival selected. Please select a festival.");
      return;
    }

    try {
      const joinedGroupId = await joinGroup({
        ...data,
        festivalId: currentFestival.id,
      });
      toast.success("Successfully joined the group!");
      router.push(`/groups/${joinedGroupId}`);
      window.location.reload();
    } catch {
      toast.error(
        "Incorrect password or unable to join group for this festival.",
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-2 flex flex-col gap-2"
    >
      <h3 className="text-xl font-semibold">Join a Group</h3>
      <Input
        type="text"
        placeholder="Group Name"
        errorMsg={errors.groupName?.message}
        autoComplete="off"
        {...register("groupName")}
      />

      <Input
        type={showPassword ? "text" : "password"}
        placeholder="Group Password"
        errorMsg={errors.password?.message}
        autoComplete="off"
        rightElement={
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
            className="h-auto p-0 text-gray-400 cursor-pointer hover:bg-transparent"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </Button>
        }
        {...register("password")}
      />

      <Button
        type="submit"
        variant="yellow"
        className="w-fit self-center"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Joining..." : "Join Group"}
      </Button>
    </form>
  );
};
