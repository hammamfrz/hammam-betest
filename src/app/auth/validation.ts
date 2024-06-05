import { query } from "express";
import z from "zod";

export const registerUserSchema = z.object({
  body: z.object({
    userName: z.string().min(4),
    emailAddress: z.string().email("Invalid email address"),
    identityNumber: z.string().length(16),
    password: z.string().min(6),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
});

export const loginUserSchema = z.object({
  body: z.object({
    userName: z.string().min(4).optional(),
    emailAddress: z.string().email("Invalid email address").optional(),
    password: z.string().min(6),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    userName: z.string().min(4).optional(),
    emailAddress: z.string().email("Invalid email address").optional(),
    password: z.string().min(6).optional(),
    updatedAt: z.date().optional(),
  }),
});

export const getUserByAccountNumberSchema = z.object({
    query: z.object({
        accountNumber: z.string().length(10)
    })
})

export const getUserByIdentityNumberSchema = z.object({
    query: z.object({
        identityNumber: z.string().length(16)
    })
})