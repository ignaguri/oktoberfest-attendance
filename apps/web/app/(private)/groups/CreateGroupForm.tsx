"use client";

// Use standardSchemaResolver instead of zodResolver to avoid Turbopack build failures
// caused by @hookform/resolvers v5.x importing "zod/v4/core" which Turbopack cannot resolve.
// See: https://github.com/colinhacks/zod/issues/4879
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useFestival } from "@prostcounter/shared/contexts";
import type { CreateGroupForm as CreateGroupFormData } from "@prostcounter/shared/schemas";
import { CreateGroupFormSchema } from "@prostcounter/shared/schemas";
import { useTransitionRouter } from "next-view-transitions";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateGroup } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";

export const CreateGroupForm = () => {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const router = useTransitionRouter();
  const { mutate: createGroupMutation, loading: isCreating } = useCreateGroup();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateGroupFormData>({
    resolver: standardSchemaResolver(CreateGroupFormSchema),
  });

  const onSubmit = async (data: CreateGroupFormData) => {
    if (!currentFestival) {
      toast.error(t("notifications.error.noFestivalSelected"));
      return;
    }

    try {
      const groupId = await createGroupMutation({
        ...data,
        festivalId: currentFestival.id,
      });
      if (groupId) {
        // Land on the group detail page: it surfaces the working Share/QR invite
        // buttons, whereas group-settings hides the link behind a regenerate.
        router.push(`/groups/${groupId}`);
        toast.success(t("notifications.success.groupCreated"));
      }
    } catch {
      toast.error(t("groups.create.errors.failed"));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 space-y-2">
      <h3 className="text-xl font-semibold">{t("groups.create.title")}</h3>
      <Input
        type="text"
        placeholder={t("groups.create.namePlaceholder")}
        errorMsg={errors.groupName?.message}
        autoComplete="new-password"
        {...register("groupName")}
      />

      <Button type="submit" variant="yellow" className="w-fit self-center" disabled={isCreating}>
        {isCreating ? t("common.status.loading") : t("groups.create.submit")}
      </Button>
    </form>
  );
};
