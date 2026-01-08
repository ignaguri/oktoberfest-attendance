"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/client";
import { signUpSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "next-view-transitions";
import React, { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { SignUpFormData } from "@/lib/schemas/auth";

import { signUp, signInWithOAuth } from "./actions";
import { GoogleIcon, FacebookIcon } from "./SocialIcons";

export default function SignUp() {
  const { t } = useTranslation();
  const [isAccountCreated, setIsAccountCreated] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormData) => {
    try {
      await signUp({ email: data.email, password: data.password });
      setIsAccountCreated(true);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(t("notifications.error.signUpFailed"), {
          description: error.message,
        });
      } else {
        toast.error(t("notifications.error.signUpFailed"), {
          description: t("notifications.error.generic"),
        });
      }
      if (emailRef.current) {
        emailRef.current.focus();
      }
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "facebook") => {
    try {
      await signInWithOAuth(provider);
    } catch (error: any) {
      // Check if this is a Next.js redirect response
      if (error?.digest?.startsWith("NEXT_REDIRECT")) {
        // This is a redirect response, let it pass through
        throw error;
      }

      toast.error(t("notifications.error.signUpFailed"), {
        description: t("auth.signIn.errors.providerFailed", { provider }),
      });
    }
  };

  // Extract error messages before render to avoid ref access during render
  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;
  const confirmPasswordError = errors.confirmPassword?.message;

  // Memoize form submission handler to avoid ref access during render
  const onSubmitHandler = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit(onSubmit)(e);
    },
    [handleSubmit, onSubmit],
  );

  if (isAccountCreated) {
    return (
      <div className="card">
        <h2 className="w-full text-center">
          {t("auth.signUp.accountCreated", { defaultValue: "Account created" })}
        </h2>
        <div className="flex flex-col items-center gap-6">
          <p>{t("auth.signUp.success.checkEmail")}</p>
          <Button asChild variant="yellow">
            <Link href="/sign-in">{t("auth.signIn.title")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="w-full p-0 text-center text-2xl font-semibold">
        {t("auth.signUp.title")}
      </h2>

      <form onSubmit={onSubmitHandler} className="column w-full">
        <Label htmlFor="email">{t("auth.signUp.emailLabel")}</Label>
        <Input
          errorMsg={emailError}
          id="email"
          placeholder={t("auth.signUp.emailPlaceholder")}
          type="email"
          autoComplete="email"
          autoFocus
          disabled={isSubmitting}
          {...register("email")}
        />

        <Label htmlFor="password">{t("auth.signUp.passwordLabel")}</Label>
        <Input
          errorMsg={passwordError}
          id="password"
          type="password"
          disabled={isSubmitting}
          {...register("password")}
        />

        <Label htmlFor="confirmPassword">
          {t("auth.signUp.confirmPasswordLabel")}
        </Label>
        <Input
          errorMsg={confirmPasswordError}
          id="confirmPassword"
          type="password"
          disabled={isSubmitting}
          {...register("confirmPassword")}
        />

        <Button
          className="self-center"
          type="submit"
          variant="yellow"
          disabled={isSubmitting}
        >
          {t("auth.signUp.submit")}
        </Button>
      </form>

      <div className="flex w-full items-center gap-4">
        <div className="h-px flex-1 bg-gray-300"></div>
        <span className="text-sm text-gray-500">
          {t("auth.signIn.orContinueWith")}
        </span>
        <div className="h-px flex-1 bg-gray-300"></div>
      </div>

      {/* Social Login Buttons */}
      <div className="flex w-full flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOAuthSignIn("google")}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          <GoogleIcon className="size-5" />
          {t("auth.signIn.continueWithGoogle")}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => handleOAuthSignIn("facebook")}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 border-[#1877F2] bg-[#1877F2] text-white hover:bg-[#166FE5]"
        >
          <FacebookIcon className="size-5" />
          {t("auth.signIn.continueWithFacebook")}
        </Button>
      </div>

      <Button asChild variant="link">
        <Link href="/sign-in">
          {t("auth.signUp.hasAccount")} {t("auth.signUp.signInLink")}
        </Link>
      </Button>
    </div>
  );
}
