import { jsx, jsxs } from 'react/jsx-runtime';
import { useStore } from '@tanstack/react-store';
import { Store, Derived } from '@tanstack/store';

const store = new Store({
  firstName: "Jane",
  lastName: "Smith"
});
const fullName = new Derived({
  fn: () => `${store.state.firstName} ${store.state.lastName}`,
  deps: [store]
});
fullName.mount();
function FirstName() {
  const firstName = useStore(store, (state) => state.firstName);
  return /* @__PURE__ */ jsx("input", { type: "text", value: firstName, onChange: (e) => store.setState((state) => ({
    ...state,
    firstName: e.target.value
  })), className: "bg-white/10 rounded-lg px-4 py-2 outline-none border border-white/20 hover:border-white/40 focus:border-white/60 transition-colors duration-200 placeholder-white/40" });
}
function LastName() {
  const lastName = useStore(store, (state) => state.lastName);
  return /* @__PURE__ */ jsx("input", { type: "text", value: lastName, onChange: (e) => store.setState((state) => ({
    ...state,
    lastName: e.target.value
  })), className: "bg-white/10 rounded-lg px-4 py-2 outline-none border border-white/20 hover:border-white/40 focus:border-white/60 transition-colors duration-200 placeholder-white/40" });
}
function FullName() {
  const fName = useStore(fullName);
  return /* @__PURE__ */ jsx("div", { className: "bg-white/10 rounded-lg px-4 py-2 outline-none ", children: fName });
}
const SplitComponent = function DemoStore() {
  return /* @__PURE__ */ jsx("div", { className: "min-h-[calc(100vh-32px)] text-white p-8 flex items-center justify-center w-full h-full", style: {
    backgroundImage: "radial-gradient(50% 50% at 80% 80%, #f4a460 0%, #8b4513 70%, #1a0f0a 100%)"
  }, children: /* @__PURE__ */ jsxs("div", { className: "bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-lg flex flex-col gap-4 text-3xl min-w-1/2", children: [
    /* @__PURE__ */ jsx("h1", { className: "text-4xl font-bold mb-5", children: "Store Example" }),
    /* @__PURE__ */ jsx(FirstName, {}),
    /* @__PURE__ */ jsx(LastName, {}),
    /* @__PURE__ */ jsx(FullName, {})
  ] }) });
};

export { SplitComponent as component };
//# sourceMappingURL=demo.store-BlEdmKkx.mjs.map
