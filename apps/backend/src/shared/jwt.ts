import jwt from "@elysiajs/jwt";
import Elysia from "elysia";

export const jwtAdapter = new Elysia().use(
  jwt({
    name: "authToken",
    secret: process.env.JWT_SECRETS!,
  })
);
