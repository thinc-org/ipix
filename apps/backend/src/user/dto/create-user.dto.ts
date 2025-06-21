import { t } from "elysia";

export const createUserDTOSchema = t.Object({
  email: t.String({
    format: "email",
  }),
  name: t.String({
    minLength: 1,
    maxLength: 100,
  }),
  password: t.String({
    minLength: 8,
    maxLength: 100,
  }),
});

export type CreateUserDTO = typeof createUserDTOSchema.static;
