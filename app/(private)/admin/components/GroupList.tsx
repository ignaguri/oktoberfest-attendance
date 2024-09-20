"use client";

import { Tables } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getGroups, updateGroup, deleteGroup } from "../actions";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveDialog from "@/components/ResponsiveDialog";

const GroupSchema = Yup.object().shape({
  name: Yup.string().required("Required"),
  description: Yup.string(),
});

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
      console.error("Error fetching groups:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateGroup(values: any, { setSubmitting }: any) {
    if (!selectedGroup) return;
    try {
      await updateGroup(selectedGroup.id, values);
      fetchGroups();
      setSelectedGroup(null);
      toast({
        title: "Success",
        variant: "success",
        description: "Group updated successfully",
      });
    } catch (error) {
      console.error("Error updating group:", error);
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive",
      });
    }
    setSubmitting(false);
    setIsDialogOpen(false); // Close the dialog after update
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
      console.error("Error deleting group:", error);
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
          <Formik
            initialValues={{
              name: selectedGroup.name,
              description: selectedGroup.description || "",
            }}
            validationSchema={GroupSchema}
            onSubmit={handleUpdateGroup}
            enableReinitialize
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                <div>
                  <label htmlFor="name" className="block">
                    Group Name
                  </label>
                  <Field type="text" id="name" name="name" className="input" />
                  <ErrorMessage
                    name="name"
                    component="span"
                    className="error"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block">
                    Description
                  </label>
                  <Field
                    as="textarea"
                    id="description"
                    name="description"
                    className="input"
                  />
                  <ErrorMessage
                    name="description"
                    component="span"
                    className="error"
                  />
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  Update Group
                </Button>
              </Form>
            )}
          </Formik>
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default GroupList;
