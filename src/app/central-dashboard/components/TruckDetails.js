"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { formatDate } from "@/app/lib/utils/dateFormat";

function money(n) {
  return `R${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function getServiceMeta(truck) {
  const last = Number(truck?.lastMaintenanceKm || 0);
  const interval = Number(truck?.maintenanceInterval || 1000);
  const current = Number(truck?.currentMeterReading || 0);
  const nextAt = last + interval;
  const remaining = nextAt - current;
  const status = remaining <= 0 ? "overdue" : remaining <= 500 ? "due_soon" : "ok";
  return { nextAt, remaining, status };
}

function SummaryStrip({ summaries }) {
  const {
    revenue,
    tripsProfit,
    tripRelatedExpenses,
    truckExpenses,
    allExpenses,
    netProfit,
  } = summaries;
  const profitClass = netProfit >= 0 ? "text-green-700" : "text-red-700";
  const tripsProfitClass = tripsProfit >= 0 ? "text-green-700" : "text-red-700";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
        <div className="text-[10px] text-gray-500">Revenue</div>
        <div className="text-sm font-bold text-green-700">{money(revenue)}</div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
        <div className="text-[10px] text-gray-500">Trips profit</div>
        <div className={`text-sm font-bold ${tripsProfitClass}`}>
          {money(tripsProfit)}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
        <div className="text-[10px] text-gray-500">Trip expenses</div>
        <div className="text-sm font-bold text-red-700">
          {money(tripRelatedExpenses)}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
        <div className="text-[10px] text-gray-500">Truck expenses</div>
        <div className="text-sm font-bold text-red-700">
          {money(truckExpenses)}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
        <div className="text-[10px] text-gray-500">All expenses</div>
        <div className="text-sm font-bold text-red-700">{money(allExpenses)}</div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
        <div className="text-[10px] text-gray-500">Net profit</div>
        <div className={`text-sm font-bold ${profitClass}`}>
          {money(netProfit)}
        </div>
      </div>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  limit,
  onPageChange,
  onLimitChange,
  total,
  label,
}) {
  if (!total) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-2">
      <div className="text-[10px] text-gray-500">
        {label}: {total.toLocaleString("en-US")} • Page {page} / {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={limit}
          onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
          className="px-2 py-1 text-xs border border-gray-300 rounded"
          title="Page size"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/page
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function CarsTable({ cars }) {
  if (!cars || cars.length === 0) {
    return (
      <div className="text-xs text-gray-500 px-3 py-2">No cars in this trip.</div>
    );
  }
  const total = cars.reduce((s, c) => s + (c.amount || 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-white border-b">
          <tr>
            <th className="px-2 py-1 text-left text-[10px] text-gray-600">#</th>
            <th className="px-2 py-1 text-left text-[10px] text-gray-600">STOCK</th>
            <th className="px-2 py-1 text-left text-[10px] text-gray-600">COMPANY</th>
            <th className="px-2 py-1 text-left text-[10px] text-gray-600">NAME</th>
            <th className="px-2 py-1 text-left text-[10px] text-gray-600">CHASSIS</th>
            <th className="px-2 py-1 text-right text-[10px] text-gray-600">AMOUNT</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {cars.map((car, idx) => (
            <tr key={car._id}>
              <td className="px-2 py-1 text-gray-600">{idx + 1}</td>
              <td className="px-2 py-1 font-medium">{car.stockNo}</td>
              <td className="px-2 py-1">{car.companyName}</td>
              <td className="px-2 py-1">{car.name}</td>
              <td className="px-2 py-1 font-mono text-[10px]">{car.chassis}</td>
              <td className="px-2 py-1 text-right text-green-700 font-semibold whitespace-nowrap">
                {money(car.amount || 0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t">
          <tr>
            <td colSpan={5} className="px-2 py-1 text-right text-[10px] font-semibold">
              Total
            </td>
            <td className="px-2 py-1 text-right text-xs font-bold text-green-700">
              {money(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TripRow({ trip, expanded, onToggle }) {
  const totalAmount = trip.totalAmount || 0;
  const totalExpense = trip.totalExpense || 0;
  const profit = totalAmount - totalExpense;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-start gap-2"
      >
        <div className="pt-0.5 text-gray-500">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-gray-900 truncate">
              {trip.tripNumber || trip.name || "Trip"}
            </div>
            <div className="text-[10px] text-gray-500 whitespace-nowrap">
              {formatDate(trip.date)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div className="text-[10px] text-gray-600">
              Cars: <span className="font-semibold">{trip.carCount || 0}</span>
            </div>
            <div className="text-[10px] text-gray-600 truncate">
              Revenue:{" "}
              <span className="font-semibold text-green-700">
                {money(totalAmount)}
              </span>
            </div>
            <div className="text-[10px] text-gray-600 truncate">
              Profit:{" "}
              <span
                className={`font-semibold ${
                  profit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {money(profit)}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 mt-1 truncate">
            Expense: <span className="text-red-700 font-semibold">{money(totalExpense)}</span>{" "}
            • Truck:{" "}
            <span className="font-medium">
              {trip.truckData?.name || trip.carrierName || "-"}
            </span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="bg-gray-50 border-t border-gray-200 px-2 py-2">
          <CarsTable cars={trip.cars || []} />
          <div className="mt-2 flex justify-end">
            <a
              href={`/carrier-trips/${trip._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-700 hover:underline px-2 py-1"
            >
              Open trip
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TripsPanel({ trips }) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
      <div className="flex items-center justify-between px-1 py-1.5">
        <div className="text-xs font-semibold text-gray-800">Trips</div>
        <button
          type="button"
          onClick={trips.onRefresh}
          className="text-gray-600 hover:text-gray-900"
          title="Refresh trips"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {trips.error ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {trips.error}
        </div>
      ) : null}

      {trips.loading ? (
        <div className="space-y-2 p-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg border border-gray-200 bg-gray-50 animate-pulse"
            />
          ))}
        </div>
      ) : trips.carriers.length === 0 ? (
        <div className="p-3 text-xs text-gray-500">No trips found.</div>
      ) : (
        <>
          {trips.pagination ? (
            <PaginationBar
              label="Trips"
              page={trips.pagination.page}
              totalPages={trips.pagination.totalPages}
              limit={trips.pagination.limit}
              total={trips.pagination.total}
              onPageChange={trips.onPageChange}
              onLimitChange={trips.onLimitChange}
            />
          ) : null}

          <div className="space-y-2 p-1">
            {trips.carriers.map((t) => (
              <TripRow
                key={t._id}
                trip={t}
                expanded={expanded.has(t._id)}
                onToggle={() => toggle(t._id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ExpensesPanel({ expenses }) {
  const rows = expenses.data?.expenses || [];
  const pagination = expenses.data?.pagination || null;
  const summaries = expenses.data?.summaries || null;
  const tripTotal = summaries?.bySource?.trip || 0;
  const truckTotal = summaries?.bySource?.truck || 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
      <div className="flex items-center justify-between px-1 py-1.5">
        <div className="text-xs font-semibold text-gray-800">Expenses</div>
        <button
          type="button"
          onClick={expenses.onRefresh}
          className="text-gray-600 hover:text-gray-900"
          title="Refresh expenses"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {expenses.error ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {expenses.error}
        </div>
      ) : null}

      {summaries ? (
        <div className="px-1 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-[10px] text-gray-500">
              Trip:{" "}
              <span className="font-semibold text-red-700">{money(tripTotal)}</span>
            </div>
            <div className="text-[10px] text-gray-500">
              Truck:{" "}
              <span className="font-semibold text-red-700">{money(truckTotal)}</span>
            </div>
            <div className="text-[10px] text-gray-500 text-right">
              Total:{" "}
              <span className="font-semibold text-red-700">
                {money(summaries.totalExpense)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {expenses.loading ? (
        <div className="space-y-2 p-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-10 rounded border border-gray-200 bg-gray-50 animate-pulse"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-3 text-xs text-gray-500">No expenses found.</div>
      ) : (
        <>
          {pagination ? (
            <PaginationBar
              label="Expenses"
              page={pagination.page}
              totalPages={pagination.totalPages}
              limit={pagination.limit}
              total={pagination.total}
              onPageChange={expenses.onPageChange}
              onLimitChange={expenses.onLimitChange}
            />
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-1 text-left text-[10px] text-gray-600">DATE</th>
                  <th className="px-2 py-1 text-left text-[10px] text-gray-600">TYPE</th>
                  <th className="px-2 py-1 text-left text-[10px] text-gray-600">SOURCE</th>
                  <th className="px-2 py-1 text-left text-[10px] text-gray-600">TRIP</th>
                  <th className="px-2 py-1 text-right text-[10px] text-gray-600">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map((e) => (
                  <tr key={e._id} className="hover:bg-gray-50">
                    <td className="px-2 py-1 whitespace-nowrap text-gray-600">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {(e.category || "").replace(/_/g, " ")}
                    </td>
                    <td className="px-2 py-1 text-[10px] text-gray-500">
                      {e.source === "truck" ? "Truck" : "Trip"}
                    </td>
                    <td className="px-2 py-1 text-[10px] text-gray-600">
                      {e.carrier?.tripNumber || e.carrier?.name || "-"}
                    </td>
                    <td className="px-2 py-1 text-right text-red-700 font-semibold whitespace-nowrap">
                      {money(e.amount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function TruckDetails({
  truckId,
  trucks,
  trips,
  expenses,
  summaries,
}) {
  const selectedTruck = useMemo(
    () => trucks.find((t) => t._id === truckId) || null,
    [trucks, truckId],
  );

  const serviceMeta = useMemo(
    () => getServiceMeta(selectedTruck),
    [selectedTruck],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">
              {selectedTruck?.name || "Select a truck"}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              {selectedTruck?.number ? `#${selectedTruck.number}` : ""}
              {selectedTruck?.drivers?.length
                ? ` • ${selectedTruck.drivers.map((d) => d.name).join(", ")}`
                : ""}
            </div>
          </div>

          {selectedTruck ? (
            <div
              className={`rounded-lg border px-3 py-2 text-[10px] shadow-sm w-full sm:w-auto ${
                serviceMeta.status === "overdue"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : serviceMeta.status === "due_soon"
                    ? "bg-yellow-50 border-yellow-200 text-yellow-900"
                    : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
              title="Service status"
            >
              <div className="font-semibold">Service</div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-600">Next at</span>
                <span className="font-semibold">{fmt(serviceMeta.nextAt)}km</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-600">
                  {serviceMeta.status === "overdue" ? "Overdue" : "Remaining"}
                </span>
                <span className="font-semibold">
                  {fmt(Math.abs(serviceMeta.remaining))}km
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <SummaryStrip summaries={summaries} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <TripsPanel trips={trips} />
        <ExpensesPanel expenses={expenses} />
      </div>
    </div>
  );
}

