import { Type, Static } from "@sinclair/typebox/type";

export const userSchema = Type.Object({
  id: Type.String({
    format: "uuid",
  }),
  email: Type.String({
    format: "email",
  }),
  name: Type.String({
    minLength: 1,
    maxLength: 100,
  }),
  password: Type.String({
    minLength: 8,
    maxLength: 100,
  }),
});

export type User = Static<typeof userSchema>;
