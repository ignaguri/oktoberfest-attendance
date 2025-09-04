"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { signInSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { SignInFormData } from "@/lib/schemas/auth";

import { login } from "./actions";

export default function SignIn() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    try {
      await login(data, redirect);
    } catch (error: any) {
      // Check if this is a Next.js redirect response
      if (error?.digest?.startsWith("NEXT_REDIRECT")) {
        // This is a redirect response, let it pass through
        throw error;
      }

      // Only show error for actual authentication failures
      setError("password", { message: "Invalid email or password" });
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">Sign In</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
        <Label htmlFor="email">Email</Label>
        <input
          className={errors.email ? "input-error" : "input"}
          id="email"
          placeholder="jane@acme.com"
          type="email"
          {...register("email")}
        />
        {errors.email && <span className="error">{errors.email.message}</span>}

        <Label htmlFor="password">Password</Label>
        <div className="relative w-full">
          <input
            className={errors.password ? "input-error" : "input"}
            id="password"
            type={showPassword ? "text" : "password"}
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

        <Button
          variant="yellow"
          className="self-center"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing In..." : "Sign In"}
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        <Button variant="link" asChild>
          <Link href="/reset-password">Forgot your password?</Link>
        </Button>
        <Button variant="link" asChild>
          <Link href="/sign-up">Don&apos;t have an account? Sign Up.</Link>
        </Button>
      </div>
    </div>
  );
}
