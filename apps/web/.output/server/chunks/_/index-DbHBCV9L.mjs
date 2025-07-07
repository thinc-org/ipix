import { jsx, jsxs } from 'react/jsx-runtime';

const logo = "/assets/logo-CHtJT8UQ.svg";
const SplitComponent = function App() {
  return /* @__PURE__ */ jsx("div", { className: "text-center", children: /* @__PURE__ */ jsxs("header", { className: "min-h-screen flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]", children: [
    /* @__PURE__ */ jsx("img", { src: logo, className: "h-[40vmin] pointer-events-none animate-[spin_20s_linear_infinite]", alt: "logo" }),
    /* @__PURE__ */ jsxs("p", { children: [
      "Edit ",
      /* @__PURE__ */ jsx("code", { children: "src/routes/index.tsx" }),
      " and save to reload."
    ] }),
    /* @__PURE__ */ jsx("a", { className: "text-[#61dafb] hover:underline", href: "https://reactjs.org", target: "_blank", rel: "noopener noreferrer", children: "Learn React" }),
    /* @__PURE__ */ jsx("a", { className: "text-[#61dafb] hover:underline", href: "https://tanstack.com", target: "_blank", rel: "noopener noreferrer", children: "Learn TanStack" })
  ] }) });
};

export { SplitComponent as component };
//# sourceMappingURL=index-DbHBCV9L.mjs.map
