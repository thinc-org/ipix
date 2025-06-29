import { session, table, verification } from "./schema";
import { spreads } from "./utils";

export const model = {
  insert: spreads(
    {
      user: table.user,
      session: table.session,
      account: table.account,
      verification: table.verification,
    },
    "insert"
  ),
  select: spreads(
    {
      user: table.user,
      session: table.session,
      account: table.account,
      verification: table.verification,
    },
    "select"
  ),
} as const;
