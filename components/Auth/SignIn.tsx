"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, Eye } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Link } from "next-view-transitions";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

import type { SignInFormData } from "@/lib/schemas/auth";

import { login, signInWithOAuth } from "./actions";
import { GoogleIcon, FacebookIcon } from "./SocialIcons";

export default function SignIn() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const error = searchParams.get("error");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  // Show OAuth error if present
  useEffect(() => {
    if (error === "oauth_failed") {
      setError("password", {
        message: "OAuth sign-in failed. Please try again.",
      });
    }
  }, [error, setError]);

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

  const handleOAuthSignIn = async (provider: "google" | "facebook") => {
    try {
      await signInWithOAuth(provider, redirect);
    } catch (error: any) {
      // Check if this is a Next.js redirect response
      if (error?.digest?.startsWith("NEXT_REDIRECT")) {
        // This is a redirect response, let it pass through
        throw error;
      }

      setError("password", { message: `Failed to sign in with ${provider}` });
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-2xl font-semibold text-center p-0">Sign In</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          placeholder="jane@acme.com"
          type="email"
          errorMsg={errors.email?.message}
          autoComplete="email"
          autoFocus
          {...register("email")}
        />

        <Label htmlFor="password">Password</Label>
        <div className="relative w-full">
          <Input
            id="password"
            errorMsg={errors.password?.message}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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

        <Button
          variant="yellow"
          className="self-center"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing In..." : "Sign In"}
        </Button>
      </form>

      <div className="flex items-center gap-4 w-full">
        <div className="flex-1 h-px bg-gray-300"></div>
        <span className="text-sm text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>

      {/* Social Login Buttons */}
      <div className="flex flex-col gap-3 w-full">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOAuthSignIn("google")}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
        >
          <GoogleIcon className="size-5" />
          Continue with Google
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => handleOAuthSignIn("facebook")}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white border-[#1877F2]"
        >
          <FacebookIcon className="size-5" />
          Continue with Facebook
        </Button>
      </div>

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
