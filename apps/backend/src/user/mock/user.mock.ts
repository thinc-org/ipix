import { User } from "../user.model";

export const MockUsers: User[] = [
  {
    id: "1",
    email: "john.doe@gamil.com",
    name: "John Doe",
    password: Bun.password.hashSync("password_1"), // Mock hashed password
  },
  {
    id: "2",
    email: "sam.smith@gmail.com",
    name: "Sam Smith",
    password: Bun.password.hashSync("password_2"), // Mock hashed password
  },
  {
    id: "3",
    email: "emily.jane@gmail.com",
    name: "Emily Jane",
    password: Bun.password.hashSync("password_3"), // Mock hashed password
  },
];
