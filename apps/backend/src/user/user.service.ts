import { Value } from "@sinclair/typebox/value";
import { CreateUserDTO } from "./dto/create-user.dto";
import { User, userSchema } from "./user.model";

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
    // For this example, we will just return the new user object
    return newUser;
  } catch (error) {
    // Handle validation errors
    throw error; // Re-throw other unexpected errors
  }
}
