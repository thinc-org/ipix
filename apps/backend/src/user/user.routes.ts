import Elysia, { t } from "elysia";
import { createUser, signInUser } from "./user.service";
import { createUserDTOSchema } from "./dto/create-user.dto";
import { signInDTOSchema } from "./dto/sign-in.dto";

const userRoutes = new Elysia().group("/user", (app) =>
  app
    .post(
      "/sign-up",
      async ({ body: { email, name, password }, status }) => {
        try {
          const user = await createUser({
            email,
            name,
            password,
          });

          return status(201, {
            message: "User created successfully",
            user,
          });
        } catch (error) {
          return status(401, {
            message: "Error creating user",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
      {
        body: createUserDTOSchema,
      }
    )
    .post(
      "/sign-in",
      async ({ body: { email, password }, status }) => {
        try {
          const user = await signInUser({ email, password });
          if (!user) {
            return status(401, {
              message: "Invalid email or password",
              error: "Authentication failed",
            });
          }
          return status(200, {
            message: "User signed in successfully",
            user,
          });
        } catch (error) {
          return status(401, {
            message: "Error signing in user",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
      {
        body: signInDTOSchema,
      }
    )
);

export { userRoutes };
