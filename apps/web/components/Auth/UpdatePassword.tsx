"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/client";
import { updatePasswordSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { UpdatePasswordFormData } from "@/lib/schemas/auth";

import { updatePassword } from "./actions";

export default function UpdatePassword() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const onSubmit = async (data: UpdatePasswordFormData) => {
    try {
      await updatePassword({ password: data.password });
      toast.success(t("notifications.success.passwordUpdated"));
    } catch (error: any) {
      toast.error(error.message || t("auth.updatePassword.errors.failed"));
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">{t("auth.updatePassword.title")}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
        <Label htmlFor="password">
          {t("auth.updatePassword.passwordLabel")}
        </Label>
        <Input
          errorMsg={errors.password?.message}
          id="password"
          type={showPassword ? "text" : "password"}
          disabled={isSubmitting}
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

        <Label htmlFor="confirmPassword">
          {t("auth.updatePassword.confirmPasswordLabel")}
        </Label>
        <Input
          errorMsg={errors.confirmPassword?.message}
          id="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          disabled={isSubmitting}
          rightElement={
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="h-auto cursor-pointer p-0 text-gray-400 hover:bg-transparent"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </Button>
          }
          {...register("confirmPassword")}
        />

        <Button
          variant="yellow"
          className="self-center"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? t("common.status.loading")
            : t("auth.updatePassword.submit")}
        </Button>
      </form>
    </div>
  );
}
