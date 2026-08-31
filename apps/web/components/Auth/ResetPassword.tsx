"use client";

// Use standardSchemaResolver instead of zodResolver to avoid Turbopack build failures
// caused by @hookform/resolvers v5.x importing "zod/v4/core" which Turbopack cannot resolve.
// See: https://github.com/colinhacks/zod/issues/4879
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { type ResetPasswordFormData, resetPasswordSchema } from "@prostcounter/shared/schemas";
import { Link } from "next-view-transitions";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/client";

import { resetPassword } from "./actions";
import { CaptchaWidget, useCaptcha } from "./Captcha";

const ResetPassword = () => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: standardSchemaResolver(resetPasswordSchema),
  });

  const {
    captchaRef,
    token: captchaToken,
    setToken,
    reset: resetCaptcha,
    enabled: isCaptchaEnabled,
  } = useCaptcha();

  const onSubmit = async (data: ResetPasswordFormData) => {
    // The widget renders as a visible checkbox, so the form can be submitted
    // before it has been ticked.
    if (isCaptchaEnabled && !captchaToken) {
      toast.error(t("common.status.error"), {
        description: t("auth.captcha.required"),
      });
      return;
    }

    const [_, errorMessage] = await resetPassword(data, captchaToken);

    if (errorMessage) {
      // The token is spent on a failed attempt too, so replace it before retry.
      resetCaptcha();

      toast.error(t("common.status.error"), {
        description: errorMessage,
      });
    } else {
      // This form stays mounted after a success, unlike sign-in (which
      // redirects) and sign-up (which swaps views). The token that just
      // succeeded is spent, so a second send from the same form would fail on
      // the captcha rather than on anything the user did.
      resetCaptcha();

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
        <CaptchaWidget captchaRef={captchaRef} onVerify={setToken} onExpire={resetCaptcha} />
        <Button type="submit" className="self-center" variant="yellow" disabled={isSubmitting}>
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
