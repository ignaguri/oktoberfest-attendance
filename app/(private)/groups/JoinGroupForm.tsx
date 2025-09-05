"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFestival } from "@/contexts/FestivalContext";
import { useToast } from "@/hooks/use-toast";
import { joinGroupSchema } from "@/lib/schemas/groups";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
  const { toast } = useToast();

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

      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Group Password"
          errorMsg={errors.password?.message}
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
