"use client";

import { useMemo } from "react";

const CATEGORY_OPTIONS = [
  { value: "", label: "All expenses" },
  { value: "fuel", label: "Fuel" },
  { value: "driver_rent", label: "Driver rent" },
  { value: "taxes", label: "Taxes" },
  { value: "tool_taxes", label: "Tool taxes" },
  { value: "on_road", label: "On road" },
  { value: "maintenance", label: "Service" },
  { value: "tyre", label: "Tyre" },
  { value: "others", label: "Others" },
];

export default function DashboardFilters({
  params,
  onChange,
  tripsLoading,
  expensesLoading,
}) {
  const busy = tripsLoading || expensesLoading;

  const clearable = useMemo(
    () =>
      !!(
        params.startDate ||
        params.endDate ||
        params.tripNumber ||
        params.globalSearch ||
        params.expenseCategory ||
        params.isActive
      ),
    [
      params.startDate,
      params.endDate,
      params.tripNumber,
      params.globalSearch,
      params.expenseCategory,
      params.isActive,
    ],
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-500">Start</label>
            <input
              type="date"
              value={params.startDate || ""}
              onChange={(e) =>
                onChange({
                  startDate: e.target.value,
                  tripsPage: 1,
                  expensesPage: 1,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] text-gray-500">End</label>
            <input
              type="date"
              value={params.endDate || ""}
              onChange={(e) =>
                onChange({
                  endDate: e.target.value,
                  tripsPage: 1,
                  expensesPage: 1,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col min-w-[160px]">
            <label className="text-[10px] text-gray-500">Trip #</label>
            <input
              placeholder="TRIP-001"
              value={params.tripNumber || ""}
              onChange={(e) =>
                onChange({ tripNumber: e.target.value, tripsPage: 1 })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col min-w-[180px] flex-1">
            <label className="text-[10px] text-gray-500">Search</label>
            <input
              placeholder="Truck / trip / notes..."
              value={params.globalSearch || ""}
              onChange={(e) =>
                onChange({ globalSearch: e.target.value, tripsPage: 1 })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col min-w-[160px]">
            <label className="text-[10px] text-gray-500">Expense type</label>
            <select
              value={params.expenseCategory || ""}
              onChange={(e) =>
                onChange({
                  expenseCategory: e.target.value,
                  expensesPage: 1,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col min-w-[140px]">
            <label className="text-[10px] text-gray-500">Trips</label>
            <select
              value={params.isActive || ""}
              onChange={(e) => onChange({ isActive: e.target.value, tripsPage: 1 })}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <button
            type="button"
            disabled={!clearable || busy}
            onClick={() =>
              onChange({
                startDate: "",
                endDate: "",
                tripNumber: "",
                globalSearch: "",
                expenseCategory: "",
                isActive: "",
                tripsPage: 1,
                expensesPage: 1,
              })
            }
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear filters"
          >
            Clear
          </button>
        </div>

        <div className="text-[10px] text-gray-500">
          Net profit = Revenue - All expenses (trip + direct truck).
        </div>
      </div>
    </div>
  );
}

