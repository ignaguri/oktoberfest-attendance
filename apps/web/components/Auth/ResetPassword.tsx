"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ResetPasswordFormData,
  resetPasswordSchema,
} from "@prostcounter/shared/schemas";
import { Link } from "next-view-transitions";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/client";

import { resetPassword } from "./actions";

const ResetPassword = () => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    const [_, errorMessage] = await resetPassword(data);

    if (errorMessage) {
      toast.error(t("common.status.error"), {
        description: errorMessage,
      });
    } else {
      toast.success(t("auth.resetPassword.success"));
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">{t("auth.resetPassword.title")}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
        <Label htmlFor="email">{t("auth.resetPassword.emailLabel")}</Label>
        <Input
          errorMsg={errors.email?.message}
          id="email"
          placeholder={t("auth.resetPassword.emailPlaceholder")}
          type="email"
          {...register("email")}
        />
        <Button
          type="submit"
          className="self-center"
          variant="yellow"
          disabled={isSubmitting}
        >
          {t("auth.resetPassword.submit")}
        </Button>
      </form>
      <Button asChild variant="link">
        <Link href="/sign-in">{t("auth.resetPassword.backToSignIn")}</Link>
      </Button>
    </div>
  );
};

export default ResetPassword;
