import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import React from 'react';
import { useReactTable, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, getCoreRowModel, flexRender, sortingFns } from '@tanstack/react-table';
import { compareItems, rankItem } from '@tanstack/match-sorter-utils';
import { faker } from '@faker-js/faker';

const range = (len) => {
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
};
const newPerson = (num) => {
  return {
    id: num,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    age: faker.number.int(40),
    visits: faker.number.int(1e3),
    progress: faker.number.int(100),
    status: faker.helpers.shuffle([
      "relationship",
      "complicated",
      "single"
    ])[0]
  };
};
function makeData(...lens) {
  const makeDataLevel = (depth = 0) => {
    const len = lens[depth];
    return range(len).map((index) => {
      return {
        ...newPerson(index),
        subRows: lens[depth + 1] ? makeDataLevel(depth + 1) : void 0
      };
    });
  };
  return makeDataLevel();
}
const fuzzyFilter = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({
    itemRank
  });
  return itemRank.passed;
};
const fuzzySort = (rowA, rowB, columnId) => {
  var _a, _b;
  let dir = 0;
  if (rowA.columnFiltersMeta[columnId]) {
    dir = compareItems((_a = rowA.columnFiltersMeta[columnId]) == null ? void 0 : _a.itemRank, (_b = rowB.columnFiltersMeta[columnId]) == null ? void 0 : _b.itemRank);
  }
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir;
};
function Filter({
  column
}) {
  const columnFilterValue = column.getFilterValue();
  return /* @__PURE__ */ jsx(DebouncedInput, { type: "text", value: columnFilterValue != null ? columnFilterValue : "", onChange: (value) => column.setFilterValue(value), placeholder: `Search...`, className: "w-full px-2 py-1 bg-gray-700 text-white rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" });
}
function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}) {
  const [value, setValue] = React.useState(initialValue);
  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);
    return () => clearTimeout(timeout);
  }, [value]);
  return /* @__PURE__ */ jsx("input", { ...props, value, onChange: (e) => setValue(e.target.value) });
}
const SplitComponent = function TableDemo() {
  var _a;
  const rerender = React.useReducer(() => ({}), {})[1];
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const columns = React.useMemo(() => [{
    accessorKey: "id",
    filterFn: "equalsString"
    //note: normal non-fuzzy filter column - exact match required
  }, {
    accessorKey: "firstName",
    cell: (info) => info.getValue(),
    filterFn: "includesStringSensitive"
    //note: normal non-fuzzy filter column - case sensitive
  }, {
    accessorFn: (row) => row.lastName,
    id: "lastName",
    cell: (info) => info.getValue(),
    header: () => /* @__PURE__ */ jsx("span", { children: "Last Name" }),
    filterFn: "includesString"
    //note: normal non-fuzzy filter column - case insensitive
  }, {
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    id: "fullName",
    header: "Full Name",
    cell: (info) => info.getValue(),
    filterFn: "fuzzy",
    //using our custom fuzzy filter function
    // filterFn: fuzzyFilter, //or just define with the function
    sortingFn: fuzzySort
    //sort by fuzzy rank (falls back to alphanumeric)
  }], []);
  const [data, setData] = React.useState(() => makeData(5e3));
  const refreshData = () => setData((_old) => makeData(5e4));
  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter
      //define as a filter function that can be used in column definitions
    },
    state: {
      columnFilters,
      globalFilter
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "fuzzy",
    //apply fuzzy filter to the global filter (most common use case for fuzzy filter)
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    //client side filtering
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false
  });
  React.useEffect(() => {
    var _a2, _b;
    if (((_a2 = table.getState().columnFilters[0]) == null ? void 0 : _a2.id) === "fullName") {
      if (((_b = table.getState().sorting[0]) == null ? void 0 : _b.id) !== "fullName") {
        table.setSorting([{
          id: "fullName",
          desc: false
        }]);
      }
    }
  }, [(_a = table.getState().columnFilters[0]) == null ? void 0 : _a.id]);
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-gray-900 p-6", children: [
    /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(DebouncedInput, { value: globalFilter != null ? globalFilter : "", onChange: (value) => setGlobalFilter(String(value)), className: "w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none", placeholder: "Search all columns..." }) }),
    /* @__PURE__ */ jsx("div", { className: "h-4" }),
    /* @__PURE__ */ jsx("div", { className: "overflow-x-auto rounded-lg border border-gray-700", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm text-gray-200", children: [
      /* @__PURE__ */ jsx("thead", { className: "bg-gray-800 text-gray-100", children: table.getHeaderGroups().map((headerGroup) => /* @__PURE__ */ jsx("tr", { children: headerGroup.headers.map((header) => {
        var _a2;
        return /* @__PURE__ */ jsx("th", { colSpan: header.colSpan, className: "px-4 py-3 text-left", children: header.isPlaceholder ? null : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { ...{
            className: header.column.getCanSort() ? "cursor-pointer select-none hover:text-blue-400 transition-colors" : "",
            onClick: header.column.getToggleSortingHandler()
          }, children: [
            flexRender(header.column.columnDef.header, header.getContext()),
            (_a2 = {
              asc: " \u{1F53C}",
              desc: " \u{1F53D}"
            }[header.column.getIsSorted()]) != null ? _a2 : null
          ] }),
          header.column.getCanFilter() ? /* @__PURE__ */ jsx("div", { className: "mt-2", children: /* @__PURE__ */ jsx(Filter, { column: header.column }) }) : null
        ] }) }, header.id);
      }) }, headerGroup.id)) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-gray-700", children: table.getRowModel().rows.map((row) => {
        return /* @__PURE__ */ jsx("tr", { className: "hover:bg-gray-800 transition-colors", children: row.getVisibleCells().map((cell) => {
          return /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: flexRender(cell.column.columnDef.cell, cell.getContext()) }, cell.id);
        }) }, row.id);
      }) })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "h-4" }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 text-gray-200", children: [
      /* @__PURE__ */ jsx("button", { className: "px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed", onClick: () => table.setPageIndex(0), disabled: !table.getCanPreviousPage(), children: "<<" }),
      /* @__PURE__ */ jsx("button", { className: "px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed", onClick: () => table.previousPage(), disabled: !table.getCanPreviousPage(), children: "<" }),
      /* @__PURE__ */ jsx("button", { className: "px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed", onClick: () => table.nextPage(), disabled: !table.getCanNextPage(), children: ">" }),
      /* @__PURE__ */ jsx("button", { className: "px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed", onClick: () => table.setPageIndex(table.getPageCount() - 1), disabled: !table.getCanNextPage(), children: ">>" }),
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsx("div", { children: "Page" }),
        /* @__PURE__ */ jsxs("strong", { children: [
          table.getState().pagination.pageIndex + 1,
          " of",
          " ",
          table.getPageCount()
        ] })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
        "| Go to page:",
        /* @__PURE__ */ jsx("input", { type: "number", defaultValue: table.getState().pagination.pageIndex + 1, onChange: (e) => {
          const page = e.target.value ? Number(e.target.value) - 1 : 0;
          table.setPageIndex(page);
        }, className: "w-16 px-2 py-1 bg-gray-800 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" })
      ] }),
      /* @__PURE__ */ jsx("select", { value: table.getState().pagination.pageSize, onChange: (e) => {
        table.setPageSize(Number(e.target.value));
      }, className: "px-2 py-1 bg-gray-800 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none", children: [10, 20, 30, 40, 50].map((pageSize) => /* @__PURE__ */ jsxs("option", { value: pageSize, children: [
        "Show ",
        pageSize
      ] }, pageSize)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 text-gray-400", children: [
      table.getPrePaginationRowModel().rows.length,
      " Rows"
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 flex gap-2", children: [
      /* @__PURE__ */ jsx("button", { onClick: () => rerender(), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: "Force Rerender" }),
      /* @__PURE__ */ jsx("button", { onClick: () => refreshData(), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: "Refresh Data" })
    ] }),
    /* @__PURE__ */ jsx("pre", { className: "mt-4 p-4 bg-gray-800 rounded-lg text-gray-300 overflow-auto", children: JSON.stringify({
      columnFilters: table.getState().columnFilters,
      globalFilter: table.getState().globalFilter
    }, null, 2) })
  ] });
};

export { SplitComponent as component };
//# sourceMappingURL=demo.table-B8W1ay23.mjs.map
