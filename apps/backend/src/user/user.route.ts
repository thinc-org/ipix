import Elysia, { t } from "elysia";
import { createUser, signInUser } from "./user.service";
import { createUserDTOSchema } from "./dto/create-user.dto";
import { signInDTOSchema } from "./dto/sign-in.dto";
import { jwtAdapter } from "../shared/jwt";

const userRoutes = new Elysia()
  .use(jwtAdapter)
  .post(
    "/register",
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
    "/login",
    async ({
      body: { email, password },
      status,
      authToken,
      cookie: { auth },
    }) => {
      try {
        const user = await signInUser({ email, password });
        if (!user) {
          return status(401, {
            message: "Invalid email or password",
            error: "Authentication failed",
          });
        }

        const accessToken = await authToken.sign({
          userId: user.id,
          email: user.email,
        });

        auth?.set({
          value: accessToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        });

        return status(200, {
          message: "User signed in successfully",
          user,
          accessToken,
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
  .get("/me", async ({ authToken, status, cookie: { auth } }) => {
    try {
      const user = await authToken.verify(auth?.value);
      if (!user) {
        return status(401, {
          message: "Unauthorized",
          error: "User not authenticated",
        });
      }

      return status(200, {
        message: "Retrieved user successfully",
        user,
      });
    } catch (error) {
      return status(401, {
        message: "Error verifying user",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })
  .get("/logout", async ({ authToken, cookie: { auth }, status }) => {
    try {
      if (!auth?.value) {
        return status(400, {
          message: "No active session found",
          error: "User not logged in",
        });
      }

      // Clear the auth cookie
      auth?.remove();
      return status(200, {
        message: "User logged out successfully",
      });
    } catch (error) {
      return status(500, {
        message: "Error during logout",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

export { userRoutes };
