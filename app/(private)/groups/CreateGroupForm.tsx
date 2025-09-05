"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFestival } from "@/contexts/FestivalContext";
import { useToast } from "@/hooks/use-toast";
import { createGroupSchema } from "@/lib/schemas/groups";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { CreateGroupFormData } from "@/lib/schemas/groups";

import { createGroup } from "./actions";

export const CreateGroupForm = () => {
  const { currentFestival } = useFestival();
  const router = useTransitionRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
  });

  const onSubmit = async (data: CreateGroupFormData) => {
    if (!currentFestival) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No festival selected. Please select a festival.",
      });
      return;
    }

    try {
      const groupId = await createGroup({
        ...data,
        festivalId: currentFestival.id,
      });
      if (groupId) {
        router.push(`/group-settings/${groupId}`);
        toast({
          variant: "success",
          title: "Success",
          description: "Group created successfully!",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "There was an error creating the group. Maybe try a different name?",
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-2 flex flex-col gap-2"
    >
      <h3 className="text-xl font-semibold">Create a New Group</h3>
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
        {isSubmitting ? "Creating..." : "Create Group"}
      </Button>
    </form>
  );
};
