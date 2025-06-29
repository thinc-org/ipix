import { Elysia, Context } from "elysia";
import { auth as authen } from "../../utils/auth";
 
export const auth = new Elysia().mount("/", authen.handler);