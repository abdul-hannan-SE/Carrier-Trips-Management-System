"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

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

function ServiceBadge({ truck }) {
  const { remaining, status } = getServiceMeta(truck);
  const text =
    status === "overdue"
      ? `${fmt(Math.abs(remaining))}km over`
      : `${fmt(remaining)}km left`;
  const cls =
    status === "overdue"
      ? "bg-red-100 text-red-700 border-red-200"
      : status === "due_soon"
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] whitespace-nowrap ${cls}`}
      title="Service remaining"
    >
      {text}
    </span>
  );
}

function TruckCard({ truck, selected, expanded, onSelect, onToggleExpand }) {
  const driversText = useMemo(() => {
    const ds = truck.drivers || [];
    if (!ds.length) return "No drivers";
    return ds.map((d) => d.name).filter(Boolean).join(", ");
  }, [truck.drivers]);

  return (
    <div
      className={`w-full text-left rounded-lg border shadow-sm transition-colors ${
        selected ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggleExpand}
          className="px-2 py-2 text-gray-500 hover:text-gray-800"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="flex-1 px-2 py-2 hover:bg-gray-50"
          title="Select truck"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-900 truncate">
                {truck.name}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {truck.number ? `#${truck.number}` : "—"} • {driversText}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] text-gray-500 whitespace-nowrap">
                {truck.currentMeterReading != null
                  ? `${fmt(truck.currentMeterReading)}km`
                  : ""}
              </div>
              <ServiceBadge truck={truck} />
            </div>
          </div>

          {truck.maintenanceWarning ? (
            <div className="mt-1 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              {truck.maintenanceWarning}
            </div>
          ) : null}
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-gray-200 px-3 py-2 bg-white">
          {(() => {
            const { nextAt, remaining, status } = getServiceMeta(truck);
            return (
              <div className="mb-2 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Next service at:</span>
                  <span className="font-semibold text-gray-700">
                    {fmt(nextAt)}km
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    {status === "overdue" ? "Overdue by:" : "Remaining:"}
                  </span>
                  <span
                    className={`font-semibold ${
                      status === "overdue"
                        ? "text-red-700"
                        : status === "due_soon"
                          ? "text-yellow-800"
                          : "text-gray-700"
                    }`}
                  >
                    {fmt(Math.abs(remaining))}km
                  </span>
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600">
            <div>
              <span className="text-gray-500">Meter:</span>{" "}
              <span className="font-semibold">{fmt(truck.currentMeterReading)}km</span>
            </div>
            <div className="text-right">
              <span className="text-gray-500">Service interval:</span>{" "}
              <span className="font-semibold">{fmt(truck.maintenanceInterval)}km</span>
            </div>
            <div>
              <span className="text-gray-500">Last service:</span>{" "}
              <span className="font-semibold">{fmt(truck.lastMaintenanceKm)}km</span>
            </div>
            <div className="text-right">
              <span className="text-gray-500">Drivers:</span>{" "}
              <span className="font-semibold">
                {(truck.drivers || []).length}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TruckCards({
  trucks,
  loading,
  selectedTruckId,
  onSelectTruck,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpand = useCallback((truckId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(truckId)) next.delete(truckId);
      else next.add(truckId);
      return next;
    });
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
      <div className="px-1 py-1.5 flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-800">Trucks</div>
        <div className="text-[10px] text-gray-500">
          {loading ? "Loading..." : `${trucks.length}`}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg border border-gray-200 bg-gray-50 animate-pulse"
            />
          ))}
        </div>
      ) : trucks.length === 0 ? (
        <div className="p-3 text-xs text-gray-500">No trucks found.</div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-auto p-1">
          {trucks.map((t) => (
            <TruckCard
              key={t._id}
              truck={t}
              selected={t._id === selectedTruckId}
              expanded={expanded.has(t._id)}
              onToggleExpand={() => toggleExpand(t._id)}
              onSelect={() => onSelectTruck(t._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

