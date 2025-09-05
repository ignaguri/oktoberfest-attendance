"use client";

import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { winningCriteriaText } from "@/lib/constants";
import { groupSettingsSchema } from "@/lib/schemas/groups";
import { fetchWinningCriterias } from "@/lib/sharedActions";
import EyeClosedIcon from "@/public/icons/eye-closed.svg";
import EyeOpenIcon from "@/public/icons/eye-open.svg";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import type { Tables } from "@/lib/database.types";
import type { GroupSettingsFormData } from "@/lib/schemas/groups";
import type { WinningCriteria } from "@/lib/types";

import { getCurrentUserForGroup, updateGroup, removeMember } from "./actions";

type Props = {
  group: Tables<"groups">;
  members: Pick<Tables<"profiles">, "id" | "username" | "full_name">[];
};

export default function GroupSettingsClient({ group, members }: Props) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    isCreator: boolean;
  } | null>(null);
  const [winningCriterias, setWinningCriterias] = useState<
    { id: number; name: string }[]
  >([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GroupSettingsFormData>({
    resolver: zodResolver(groupSettingsSchema),
    defaultValues: {
      name: group.name,
      password: group.password,
      description: group.description || "",
      winning_criteria_id: group.winning_criteria_id,
    },
  });

  const winningCriteriaId = watch("winning_criteria_id");

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const result = await getCurrentUserForGroup(group.id);
      if (result) {
        setCurrentUser(result);
      }
    };

    fetchCurrentUser();
  }, [group.id]);

  useEffect(() => {
    const fetchWinningCriteriasData = async () => {
      const result = await fetchWinningCriterias();
      if (result) {
        setWinningCriterias(result);
      }
    };

    fetchWinningCriteriasData();
  }, []);

  const onSubmit = useCallback(
    async (data: GroupSettingsFormData) => {
      if (!currentUser?.isCreator) {
        alert("Only the group creator can update group details.");
        return;
      }

      try {
        await updateGroup(group.id, data);

        toast({
          variant: "success",
          title: "Group updated successfully!",
          description: "Your group details have been updated.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error updating group",
          description: "An unexpected error occurred while updating the group.",
        });
      }
    },
    [currentUser?.isCreator, group.id, toast],
  );

  const handleRemoveMember = useCallback(async () => {
    if (!currentUser?.isCreator || !selectedUserId) return;

    try {
      await removeMember(group.id, selectedUserId);
      toast({
        variant: "success",
        title: "Member removed successfully!",
        description: "The member has been removed from the group.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error removing member",
        description: "An unexpected error occurred while removing the member.",
      });
    } finally {
      setIsDialogOpen(false);
      setSelectedUserId(null);
    }
  }, [currentUser?.isCreator, group.id, selectedUserId, toast]);

  return (
    <div className="w-full max-w-lg">
      <h2 className="text-2xl font-semibold">Group Settings</h2>
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Group Details
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Group Name
              </Label>
              <Input
                type="text"
                id="name"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-xs p-2"
                disabled={!currentUser?.isCreator}
                errorMsg={errors.name?.message}
                {...register("name")}
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Group Password
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  className="block w-full border border-gray-300 rounded-md shadow-xs p-2"
                  disabled={!currentUser?.isCreator}
                  errorMsg={errors.password?.message}
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute h-full inset-y-0 right-0 flex items-center text-gray-400 cursor-pointer pr-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Image
                    src={showPassword ? EyeClosedIcon : EyeOpenIcon}
                    alt={showPassword ? "Hide password" : "Show password"}
                    width={20}
                    height={20}
                  />
                </Button>
              </div>
            </div>

            <div>
              <Label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Group Description
              </Label>
              <Textarea
                id="description"
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-xs p-2"
                disabled={!currentUser?.isCreator}
                errorMsg={errors.description?.message}
                {...register("description")}
              />
            </div>

            <div>
              <Label
                htmlFor="winning_criteria_id"
                className="block text-sm font-medium text-gray-700"
              >
                Winning Criteria
              </Label>
              <SingleSelect
                id="winning_criteria_id"
                options={[
                  {
                    options: winningCriterias.map((criteria) => ({
                      value: criteria.id.toString(),
                      label:
                        winningCriteriaText[criteria.name as WinningCriteria],
                    })),
                  },
                ]}
                placeholder="Select winning criteria"
                disabled={!currentUser?.isCreator}
                value={winningCriteriaId?.toString() || ""}
                onSelect={(option) => {
                  setValue("winning_criteria_id", parseInt(option.value));
                }}
                errorMsg={errors.winning_criteria_id?.message}
              />
            </div>

            {currentUser?.isCreator && (
              <div>
                <Button type="submit" variant="yellow" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Group"}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-xl font-semibold mb-2">Group Members</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              {currentUser?.isCreator && (
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.username || "–"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.full_name || "–"}
                </td>
                {currentUser?.isCreator && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:text-red-900 underline disabled:text-gray-400 disabled:no-underline"
                      disabled={member.id === currentUser?.userId}
                      onClick={() => {
                        setSelectedUserId(member.id);
                        setIsDialogOpen(true);
                      }}
                    >
                      Kick out
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Removal</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleRemoveMember}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
