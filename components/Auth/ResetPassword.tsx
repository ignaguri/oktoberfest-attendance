"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import cn from "classnames";
import { Link } from "next-view-transitions";
import { useForm } from "react-hook-form";

import type { ResetPasswordFormData } from "@/lib/schemas/auth";

import { resetPassword } from "./actions";

const ResetPassword = () => {
  const { toast } = useToast();

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
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } else {
      toast({
        variant: "success",
        title: "Success",
        description: "Instructions sent. Check your email.",
      });
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">Reset Password</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
        <Label htmlFor="email">Email</Label>
        <input
          className={cn("input", errors.email && "input-error")}
          id="email"
          placeholder="jane@acme.com"
          type="email"
          {...register("email")}
        />
        {errors.email && <span className="error">{errors.email.message}</span>}
        <Button
          type="submit"
          className="self-center"
          variant="yellow"
          disabled={isSubmitting}
        >
          Send Instructions
        </Button>
      </form>
      <Button asChild variant="link">
        <Link href="/sign-in">Remember your password? Sign In.</Link>
      </Button>
    </div>
  );
};

export default ResetPassword;
