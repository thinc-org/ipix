import { user, session, account, verification } from "./schemas/auth";
import { item, space, accessRank } from "./schemas/storage";

export const storageTable = { item, space, accessRank };
export const authTable = { user, session, account, verification };
