import { Value } from "@sinclair/typebox/value";
import { CreateUserDTO } from "./dto/create-user.dto";
import { User, userSchema } from "./user.model";
import { SignInDTO } from "./dto/sign-in.dto";
import { MockUsers } from "./mock/user.mock";

export async function createUser(userBody: CreateUserDTO) {
  try {
    const hashedPassword = await Bun.password.hash(userBody.password);

    const newUser: User = {
      id: crypto.randomUUID(),
      email: userBody.email,
      name: userBody.name,
      password: hashedPassword,
    };

    // Create a new user object with a unique ID
    Value.Check(userSchema, newUser);

    if (!newUser.id) {
      throw new Error("User ID generation failed");
    }

    // Here you would typically save the new user to a database
    MockUsers.getInstance().addUser(newUser);

    return newUser;
  } catch (error) {
    // Handle validation errors
    throw error; // Re-throw other unexpected errors
  }
}

export async function signInUser(signInBody: SignInDTO) {
  try {
    // Here you would typically fetch the user from a database
    // For this example, we will use a mock user

    const mockUsers = MockUsers.getInstance().getUsers();

    const user = mockUsers.find((u) => u.email === signInBody.email);

    if (!user) {
      return null; // Return null if user not found
    }

    const passwordMatch = await Bun.password.verify(
      signInBody.password,
      user.password
    );

    if (!passwordMatch) {
      return null; // Return null if user not found or password does not match
    }

    // Validate the user object
    Value.Check(userSchema, user);
    const { password, ...userWithoutPassword } = user; // Exclude password from the returned user object
    return userWithoutPassword; // Return the user object if authentication is successful
  } catch (error) {
    // Handle validation errors
    throw error; // Re-throw other unexpected errors
  }
}

export function getGoogleEndpoint(): string {
  const endpoint = new URL("https://accounts.google.com/o/oauth2/auth");
  endpoint.searchParams.set(
    "client_id",
    "919252019629-apmdjn2n58l8pd4sm3k4hv5efq4qqk06.apps.googleusercontent.com"
  );
  endpoint.searchParams.set("redirect_uri", "http://localhost:4000/callback");
  endpoint.searchParams.set("response_type", "code");
  endpoint.searchParams.set("scope", "email profile");

  return endpoint.toString();
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  id_token?: string; // Optional, depending on the scope
  email?: string; // Optional, depending on the scope
}

export async function fetchGoogleToken(
  code: string
): Promise<GoogleTokenResponse> {
  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${code}`,
      },
    }
  );

  const tokenEndpoint = new URL("https://accounts.google.com/o/oauth2/token");
  tokenEndpoint.searchParams.set("code", code);
  tokenEndpoint.searchParams.set("grant_type", "authorization_code");
  tokenEndpoint.searchParams.set(
    "client_id",
    "919252019629-apmdjn2n58l8pd4sm3k4hv5efq4qqk06.apps.googleusercontent.com"
  );
  tokenEndpoint.searchParams.set(
    "client_secret",
    process.env.GOOGLE_CLIENT_SECRET || ""
  );
  tokenEndpoint.searchParams.set(
    "redirect_uri",
    `http://localhost:4000/callback`
  );

  const tokenResponse = await fetch(
    tokenEndpoint.origin + tokenEndpoint.pathname,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenEndpoint.searchParams.toString(),
    }
  );

  return tokenResponse.json();
}

interface GoogleDataResponse {
  id?: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function fetchUserData(
  token: string
): Promise<GoogleDataResponse> {
  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch user data from Google");
  }

  return userInfoResponse.json();
}
