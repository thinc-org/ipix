import Elysia, { t } from "elysia";
import {
  createUser,
  fetchGoogleToken,
  fetchUserData,
  getGoogleEndpoint,
  signInUser,
} from "./user.service";
import { createUserDTOSchema } from "./dto/create-user.dto";
import { signInDTOSchema } from "./dto/sign-in.dto";
import { jwtAdapter } from "../shared/jwt";
import { MockUsers } from "./mock/user.mock";

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
  .get("/logout", async ({ cookie: { auth }, status }) => {
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
  })
  .get("/google", ({ redirect }) => {
    // redirect to Google OAuth CLIENT ID 919252019629-apmdjn2n58l8pd4sm3k4hv5efq4qqk06.apps.googleusercontent.com

    return redirect(getGoogleEndpoint());
  })
  .get(
    "/callback",
    async ({ query: { code }, status, authToken, cookie: { auth } }) => {
      // Handle Google OAuth callback
      // This is a placeholder, actual implementation will require fetching tokens and user info
      if (!code) {
        return status(400, {
          message: "No authorization code provided",
          error: "Invalid request",
        });
      }

      const token = await fetchGoogleToken(code);

      if (!token || !token.access_token) {
        return status(400, {
          message: "Failed to fetch Google access token",
          error: "Invalid Google token response",
        });
      }

      const googleUser = await fetchUserData(token.access_token);

      console.log("Google User:", googleUser);

      if (!googleUser || !googleUser.email) {
        return status(400, {
          message: "Failed to retrieve user information from Google",
          error: "Invalid Google user data",
        });
      }

      const mockUsers = MockUsers.getInstance();

      const user = mockUsers
        .getUsers()
        .find((u) => u.email === googleUser.email);

      if (!user) {
        return status(404, {
          message: "User not found",
          error: "No user associated with this Google account",
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
        message: "User authenticated via Google",
        user,
        accessToken,
      });
    }
  );

export { userRoutes };
