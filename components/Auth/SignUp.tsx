"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        toast.error("Sign up failed.", {
          description: error.message,
        });
      } else {
        toast.error("Sign up failed.", {
          description: "An unexpected error occurred.",
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

      toast.error("Sign up failed.", {
        description: `Failed to sign up with ${provider}`,
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
        <h2 className="w-full text-center">Account created</h2>
        <div className="flex flex-col items-center gap-6">
          <p>Please check your email for verification.</p>
          <Button asChild variant="yellow">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="w-full text-2xl font-semibold text-center p-0">
        Create Account
      </h2>

      <form onSubmit={onSubmitHandler} className="column w-full">
        <Label htmlFor="email">Email</Label>
        <Input
          errorMsg={emailError}
          id="email"
          placeholder="jane@acme.com"
          type="email"
          autoComplete="email"
          autoFocus
          disabled={isSubmitting}
          {...register("email")}
        />

        <Label htmlFor="password">Password</Label>
        <Input
          errorMsg={passwordError}
          id="password"
          type="password"
          disabled={isSubmitting}
          {...register("password")}
        />

        <Label htmlFor="confirmPassword">Confirm Password</Label>
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
          Submit
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

      <Button asChild variant="link">
        <Link href="/sign-in">Already have an account? Sign In.</Link>
      </Button>
    </div>
  );
}
