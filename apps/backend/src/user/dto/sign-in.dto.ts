import { t } from "elysia";

export const signInDTOSchema = t.Object({
  email: t.String({
    format: "email",
  }),
  password: t.String({
    minLength: 8,
    maxLength: 100,
  }),
});

export type SignInDTO = typeof signInDTOSchema.static;
