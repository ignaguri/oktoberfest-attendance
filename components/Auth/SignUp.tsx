"use client";

import { Button } from "@/components/ui/button";
import { useForm } from "@/hooks/use-form";
import { useToast } from "@/hooks/use-toast";
import { signUpSchema, SignUpFormData } from "@/lib/schemas/auth";
import cn from "classnames";
import { Link } from "next-view-transitions";
import React, { useState, useRef } from "react";

import { signUp } from "./actions";

export default function SignUp() {
  const { toast } = useToast();
  const [isAccountCreated, setIsAccountCreated] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm(signUpSchema);

  const onSubmit = async (data: SignUpFormData) => {
    try {
      await signUp({ email: data.email, password: data.password });
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Sign up failed.",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign up failed.",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
      }
      if (emailRef.current) {
        emailRef.current.focus();
      }
    } finally {
      setIsAccountCreated(true);
    }
  };

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
      <h2 className="w-full text-center">Create Account</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
        <label htmlFor="email">Email</label>
        <input
          className={cn(
            "input",
            errors.email && "bg-red-50",
          )}
          id="email"
          placeholder="jane@acme.com"
          type="email"
          disabled={isSubmitting}
          {...register("email")}
        />
        {errors.email && <span className="error">{errors.email.message}</span>}

        <label htmlFor="password">Password</label>
        <input
          className={cn(
            "input",
            errors.password && "bg-red-50",
          )}
          id="password"
          type="password"
          disabled={isSubmitting}
          {...register("password")}
        />
        {errors.password && <span className="error">{errors.password.message}</span>}

        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          className={cn(
            "input",
            errors.confirmPassword && "bg-red-50",
          )}
          id="confirmPassword"
          type="password"
          disabled={isSubmitting}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && <span className="error">{errors.confirmPassword.message}</span>}

        <Button
          className="self-center"
          type="submit"
          variant="yellow"
          disabled={isSubmitting}
        >
          Submit
        </Button>
      </form>
      <Button asChild variant="link">
        <Link href="/sign-in">Already have an account? Sign In.</Link>
      </Button>
    </div>
  );
}
