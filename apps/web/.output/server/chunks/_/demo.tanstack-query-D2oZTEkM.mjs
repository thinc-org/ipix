import { jsxs, jsx } from 'react/jsx-runtime';
import { useQuery } from '@tanstack/react-query';

const SplitComponent = function TanStackQueryDemo() {
  const {
    data
  } = useQuery({
    queryKey: ["people"],
    queryFn: () => Promise.resolve([{
      name: "John Doe"
    }, {
      name: "Jane Doe"
    }]),
    initialData: []
  });
  return /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl mb-4", children: "People list" }),
    /* @__PURE__ */ jsx("ul", { children: data.map((person) => /* @__PURE__ */ jsx("li", { children: person.name }, person.name)) })
  ] });
};

export { SplitComponent as component };
//# sourceMappingURL=demo.tanstack-query-D2oZTEkM.mjs.map
