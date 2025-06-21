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
