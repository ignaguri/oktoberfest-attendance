"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFestival } from "@/contexts/FestivalContext";
import { apiClient } from "@/lib/api-client";
import { joinGroupSchema } from "@/lib/schemas/groups";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { JoinGroupFormData } from "@/lib/schemas/groups";

interface JoinGroupFormProps {
  groupName?: string;
  groupId?: string;
}

export const JoinGroupForm = ({ groupName, groupId }: JoinGroupFormProps) => {
  const { currentFestival } = useFestival();
  const router = useTransitionRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm<JoinGroupFormData>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: {
      groupName: groupName || "",
      password: "",
    },
  });

  // Direct join when groupId is provided (from group detail page)
  const handleDirectJoin = async () => {
    if (!groupId) {
      toast.error("Invalid group.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.groups.join(groupId);
      toast.success("Successfully joined the group!");
      router.push(`/groups/${groupId}`);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to join group.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search and join by name+password (from groups list page)
  const onSubmit = async (data: JoinGroupFormData) => {
    if (!currentFestival) {
      toast.error("No festival selected. Please select a festival.");
      return;
    }

    try {
      // Search for the group by name
      const searchResult = await apiClient.groups.search({
        name: data.groupName,
        festivalId: currentFestival.id,
        limit: 1,
      });

      if (!searchResult.data || searchResult.data.length === 0) {
        toast.error("Group not found. Please check the group name.");
        return;
      }

      const foundGroup = searchResult.data[0];

      // Try to join the group (password validation happens server-side)
      // Note: The API uses invite tokens, not passwords. For password-based join,
      // we'll attempt to join and let the server validate.
      await apiClient.groups.join(foundGroup.id, data.password);
      toast.success("Successfully joined the group!");
      router.push(`/groups/${foundGroup.id}`);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Incorrect password or unable to join group.",
      );
    }
  };

  // If groupId is provided, show simple join button
  if (groupId) {
    return (
      <div className="space-y-4 flex flex-col gap-2 items-center">
        <p className="text-gray-600">
          Click below to join <strong>{groupName}</strong>
        </p>
        <Button
          type="button"
          variant="yellow"
          className="w-fit"
          disabled={isSubmitting}
          onClick={handleDirectJoin}
        >
          {isSubmitting ? "Joining..." : "Join Group"}
        </Button>
      </div>
    );
  }

  // Otherwise, show the full form for searching and joining by name+password
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
        autoComplete="new-password"
        {...register("groupName")}
      />

      <Input
        type={showPassword ? "text" : "password"}
        placeholder="Group Password"
        errorMsg={errors.password?.message}
        autoComplete="new-password"
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
        disabled={formSubmitting}
      >
        {formSubmitting ? "Joining..." : "Join Group"}
      </Button>
    </form>
  );
};
