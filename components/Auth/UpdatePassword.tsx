"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updatePasswordSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
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
              className="h-auto p-0 text-gray-400 cursor-pointer hover:bg-transparent"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </Button>
          }
          {...register("password")}
        />

        <Label htmlFor="confirmPassword">Confirm Password</Label>
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
              className="h-auto p-0 text-gray-400 cursor-pointer hover:bg-transparent"
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
          {isSubmitting ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </div>
  );
}
