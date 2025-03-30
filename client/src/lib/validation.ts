import { z } from "zod";

export const loginSchema = z.object({
  email: z.string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z.string()
    .min(1, { message: "Password is required" }),
  rememberMe: z.boolean().optional()
});

export const signupSchema = z.object({
  firstName: z.string()
    .min(1, { message: "First name is required" }),
  lastName: z.string()
    .min(1, { message: "Last name is required" }),
  email: z.string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string()
    .min(1, { message: "Please confirm your password" }),
  terms: z.boolean()
    .refine(val => val === true, {
      message: "You must agree to the terms and conditions"
    })
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});
