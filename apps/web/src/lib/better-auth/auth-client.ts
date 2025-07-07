import { createAuthClient } from "better-auth/react";
import { reactStartCookies } from "better-auth/react-start";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
	baseURL: "http://localhost:20257",
	credentials: "include", // Ensure cookies are included in requests
	plugins: [reactStartCookies()]
});

// refer to https://github.com/better-auth/better-auth/issues/2036
// AI won't solve your bug, especially when they assume the package is bug free.