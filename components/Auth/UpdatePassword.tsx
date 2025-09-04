"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updatePasswordSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import cn from "classnames";
import { EyeOff, Eye } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { UpdatePasswordFormData } from "@/lib/schemas/auth";

import { updatePassword } from "./actions";

export default function UpdatePassword() {
  const { toast } = useToast();
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
      toast({
        variant: "success",
        title: "Success",
        description: "Password updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message || "An error occurred while updating the password.",
      });
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">Update Password</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
        <Label htmlFor="password">New Password</Label>
        <div className="relative w-full">
          <input
            className={cn("input", errors.password && "bg-red-50")}
            id="password"
            type={showPassword ? "text" : "password"}
            disabled={isSubmitting}
            {...register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute h-full inset-y-0 right-0 flex items-center text-gray-400 cursor-pointer pr-2"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </Button>
        </div>
        {errors.password && (
          <span className="error">{errors.password.message}</span>
        )}

        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative w-full">
          <input
            className={cn("input", errors.confirmPassword && "bg-red-50")}
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            disabled={isSubmitting}
            {...register("confirmPassword")}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute h-full inset-y-0 right-0 flex items-center text-gray-400 cursor-pointer pr-2"
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </Button>
        </div>
        {errors.confirmPassword && (
          <span className="error">{errors.confirmPassword.message}</span>
        )}

        <Button
          variant="yellow"
          className="self-center"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </div>
  );
}
