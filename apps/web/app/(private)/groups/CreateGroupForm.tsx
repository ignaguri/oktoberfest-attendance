"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFestival } from "@/contexts/FestivalContext";
import { useCreateGroup } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";
import { createGroupSchema } from "@/lib/schemas/groups";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CreateGroupFormData } from "@/lib/schemas/groups";

export const CreateGroupForm = () => {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const router = useTransitionRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: createGroupMutation, loading: isCreating } = useCreateGroup();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
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
        router.push(`/group-settings/${groupId}`);
        toast.success(t("notifications.success.groupCreated"));
      }
    } catch {
      toast.error(t("groups.create.errors.failed"));
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-2 space-y-2"
    >
      <h3 className="text-xl font-semibold">{t("groups.create.title")}</h3>
      <Input
        type="text"
        placeholder={t("groups.create.namePlaceholder")}
        errorMsg={errors.groupName?.message}
        autoComplete="new-password"
        {...register("groupName")}
      />

      <Input
        type={showPassword ? "text" : "password"}
        placeholder={t("groups.create.passwordPlaceholder")}
        errorMsg={errors.password?.message}
        autoComplete="new-password"
        rightElement={
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
            className="h-auto cursor-pointer p-0 text-gray-400 hover:bg-transparent"
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
        disabled={isCreating}
      >
        {isCreating ? t("common.status.loading") : t("groups.create.submit")}
      </Button>
    </form>
  );
};
