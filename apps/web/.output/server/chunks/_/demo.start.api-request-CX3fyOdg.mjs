import { jsx } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';

function getNames() {
  return fetch("/api/demo-names").then((res) => res.json());
}
const SplitComponent = function Home() {
  const [names, setNames] = useState([]);
  useEffect(() => {
    getNames().then(setNames);
  }, []);
  return /* @__PURE__ */ jsx("div", { className: "p-4", children: /* @__PURE__ */ jsx("div", { children: names.join(", ") }) });
};

export { SplitComponent as component };
//# sourceMappingURL=demo.start.api-request-CX3fyOdg.mjs.map
