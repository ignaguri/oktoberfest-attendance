"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { groupSchema } from "@/lib/schemas/admin";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import type { Tables } from "@/lib/database.types";
import type { GroupFormData } from "@/lib/schemas/admin";

import { getGroups, updateGroup, deleteGroup } from "../actions";

const GroupEditForm = ({
  group,
  onSubmit,
}: {
  group: Tables<"groups">;
  onSubmit: (data: GroupFormData) => Promise<void>;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group.name,
      description: group.description || "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name" className="block">
          Group Name
        </Label>
        <Input
          type="text"
          id="name"
          className="input"
          errorMsg={errors.name?.message}
          {...register("name")}
        />
      </div>
      <div>
        <Label htmlFor="description" className="block">
          Description
        </Label>
        <Textarea
          id="description"
          className="input"
          errorMsg={errors.description?.message}
          {...register("description")}
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Update Group
      </Button>
    </form>
  );
};

const GroupList = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Tables<"groups">[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Tables<"groups"> | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // State for dialog

  async function fetchGroups() {
    try {
      setIsLoading(true);
      const fetchedGroups = await getGroups();
      setGroups(fetchedGroups);
    } catch (error) {
      logger.error(
        "Error fetching groups",
        logger.clientComponent("GroupList", { action: "fetchGroups" }),
        error as Error,
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateGroup(data: GroupFormData) {
    if (!selectedGroup) return;
    try {
      await updateGroup(selectedGroup.id, data);
      fetchGroups();
      setSelectedGroup(null);
      toast({
        title: "Success",
        variant: "success",
        description: "Group updated successfully",
      });
      setIsDialogOpen(false);
    } catch (error) {
      logger.error(
        "Error updating group",
        logger.clientComponent("GroupList", {
          action: "updateGroup",
          groupId: selectedGroup?.id,
        }),
        error as Error,
      );
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteGroup(groupId: string) {
    try {
      await deleteGroup(groupId);
      fetchGroups();
      toast({
        title: "Success",
        variant: "success",
        description: "Group deleted successfully",
      });
    } catch (error) {
      logger.error(
        "Error deleting group",
        logger.clientComponent("GroupList", { action: "deleteGroup", groupId }),
        error as Error,
      );
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    fetchGroups();
  }, []);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-2">Group List</h2>
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Group List</h2>
      <ul>
        {groups.map((group) => (
          <li key={group.id} className="mb-2">
            {group.name}
            <Button
              onClick={() => {
                setSelectedGroup(group);
                setIsDialogOpen(true); // Open dialog for editing
              }}
              className="ml-2"
            >
              Edit
            </Button>
            <Button
              onClick={() => handleDeleteGroup(group.id)}
              className="ml-2"
              variant="destructive"
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>

      {/* Group Edit Dialog */}
      <ResponsiveDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Edit Group"
        description="Update group details"
      >
        {selectedGroup && (
          <GroupEditForm group={selectedGroup} onSubmit={handleUpdateGroup} />
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default GroupList;
