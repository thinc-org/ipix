import Elysia, { t } from "elysia";
import { createUser } from "./user.service";
import { createUserDTOSchema } from "./dto/create-user.dto";

const userRoutes = new Elysia().group("/user", (app) =>
  app.post(
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
);

export { userRoutes };
