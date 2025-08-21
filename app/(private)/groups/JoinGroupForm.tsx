"use client";

import { Button } from "@/components/ui/button";
import { useFestival } from "@/contexts/FestivalContext";
import { useForm } from "@/hooks/use-form";
import { useToast } from "@/hooks/use-toast";
import { joinGroupSchema, JoinGroupFormData } from "@/lib/schemas/groups";
import cn from "classnames";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";

import { joinGroup } from "./actions";

interface JoinGroupFormProps {
  groupName?: string;
  groupId?: string;
}

export const JoinGroupForm = ({ groupName }: JoinGroupFormProps) => {
  const { currentFestival } = useFestival();
  const [showPassword, setShowPassword] = useState(false);
  const router = useTransitionRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm(joinGroupSchema, {
    defaultValues: {
      groupName: groupName || "",
      password: "",
    },
  });

  const onSubmit = async (data: JoinGroupFormData) => {
    if (!currentFestival) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No festival selected. Please select a festival.",
      });
      return;
    }

    try {
      const joinedGroupId = await joinGroup({
        ...data,
        festivalId: currentFestival.id,
      });
      toast({
        variant: "success",
        title: "Success",
        description: "Successfully joined the group!",
      });
      router.push(`/groups/${joinedGroupId}`);
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Incorrect password or unable to join group for this festival.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 flex flex-col gap-2">
      <h3 className="text-xl font-semibold">Join a Group</h3>
      <input
        type="text"
        placeholder="Group Name"
        className={cn(
          "input",
          errors.groupName && "input-error",
        )}
        autoComplete="off"
        {...register("groupName")}
      />
      {errors.groupName && <span className="error">{errors.groupName.message}</span>}
      
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Group Password"
          className={cn(
            "input pr-10",
            errors.password && "input-error",
          )}
          autoComplete="off"
          {...register("password")}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute h-full inset-y-0 right-0 flex items-center text-gray-400 cursor-pointer pr-2"
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </Button>
      </div>
      {errors.password && <span className="error">{errors.password.message}</span>}
      
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
