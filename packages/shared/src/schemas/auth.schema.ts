import { z } from "zod";

/**
 * Authentication Schemas
 *
 * Shared validation schemas for authentication forms.
 * Used by both web and mobile platforms.
 */

// Sign In Schema
export const signInSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z.string().min(1, "Password is required"),
});

// Sign Up Schema
export const signUpSchema = z
  .object({
    email: z.email({ error: "Invalid email address" }),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Reset Password Schema (request password reset)
export const resetPasswordSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
});

// Update Password Schema (set new password)
export const updatePasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Type exports
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
