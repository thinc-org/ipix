import { User } from "../user.model";

export class MockUsers {
  private static instance: MockUsers;
  private users: User[];

  private constructor() {
    this.users = [
      {
        id: "1",
        email: "john.doe@gmail.com",
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
  }

  public static getInstance(): MockUsers {
    if (!MockUsers.instance) {
      MockUsers.instance = new MockUsers();
    }
    return MockUsers.instance;
  }

  public getUsers(): User[] {
    return this.users;
  }

  public addUser(user: User): void {
    this.users.push(user);
  }
}
