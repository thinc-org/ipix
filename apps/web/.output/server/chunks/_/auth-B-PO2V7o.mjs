import { jsxs, jsx } from 'react/jsx-runtime';
import { createAuthClient } from 'better-auth/react';
import { reactStartCookies } from 'better-auth/react-start';

const authClient = createAuthClient({
  baseURL: "http://localhost:20257",
  plugins: [reactStartCookies()]
});
const SplitComponent = function AuthComponent() {
  var _a;
  const {
    data: session,
    refetch
  } = authClient.useSession();
  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "github"
    });
    refetch();
  };
  const handleSignOut = async () => {
    await authClient.signOut();
    refetch();
  };
  return /* @__PURE__ */ jsxs("div", { className: "p-2", children: [
    /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Better-Auth GitHub Sign In" }),
    /* @__PURE__ */ jsx("div", { className: "p-4", children: session ? /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("p", { children: [
        "Welcome, ",
        (_a = session.user) == null ? void 0 : _a.email
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: handleSignOut, className: "mt-2 px-4 py-2 bg-red-500 text-white rounded", children: "Sign Out" })
    ] }) : /* @__PURE__ */ jsx("button", { onClick: handleSignIn, className: "px-4 py-2 bg-blue-500 text-white rounded", children: "Sign In with GitHub" }) }),
    /* @__PURE__ */ jsx("pre", { className: "mt-4 bg-gray-100 p-4 rounded", children: JSON.stringify(session, null, 2) })
  ] });
};

export { SplitComponent as component };
//# sourceMappingURL=auth-B-PO2V7o.mjs.map
