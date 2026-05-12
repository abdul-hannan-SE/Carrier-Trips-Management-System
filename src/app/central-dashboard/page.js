"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAllTrucks } from "@/app/lib/carriers-actions/trucks";
import { getAllCarriers } from "@/app/lib/carriers-actions/carriers";
import { useUser } from "@/app/components/UserContext";
import TruckCards from "./components/TruckCards";
import DashboardFilters from "./components/DashboardFilters";
import TruckDetails from "./components/TruckDetails";

function clampInt(value, fallback) {
  const n = parseInt(value || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildCentralParams(searchParams) {
  const params = {
    truckId: searchParams.get("truckId") || "",
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    expenseCategory: searchParams.get("expenseCategory") || "",
    tripNumber: searchParams.get("tripNumber") || "",
    globalSearch: searchParams.get("globalSearch") || "",
    isActive: searchParams.get("isActive") || "",
    tripsPage: clampInt(searchParams.get("tripsPage"), 1),
    tripsLimit: clampInt(searchParams.get("tripsLimit"), 10),
    expensesPage: clampInt(searchParams.get("expensesPage"), 1),
    expensesLimit: clampInt(searchParams.get("expensesLimit"), 25),
  };
  return params;
}

export default function CentralDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  const params = useMemo(() => buildCentralParams(searchParams), [searchParams]);
  const isSuperAdmin = user?.role === "super_admin";

  const { data: trucksData, isLoading: trucksLoading } = useQuery({
    queryKey: ["centralTrucks", isSuperAdmin ? user?.userId : "me"],
    queryFn: () => getAllTrucks({}, null),
    staleTime: 0,
  });

  const trucks = useMemo(() => trucksData?.trucks ?? [], [trucksData?.trucks]);

  // Auto-pick first truck if none selected (keeps dashboard "one screen")
  useEffect(() => {
    if (params.truckId || trucksLoading) return;
    if (trucks.length === 0) return;
    const sp = new URLSearchParams(window.location.search);
    sp.set("truckId", trucks[0]._id);
    sp.set("tripsPage", "1");
    sp.set("expensesPage", "1");
    router.replace(`/central-dashboard?${sp.toString()}`);
  }, [params.truckId, trucksLoading, trucks, router]);

  const carriersQueryParams = useMemo(() => {
    const q = {
      page: params.tripsPage,
      limit: params.tripsLimit,
      truckId: params.truckId || undefined,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      tripNumber: params.tripNumber || undefined,
      globalSearch: params.globalSearch || undefined,
      isActive: params.isActive || undefined,
    };
    return q;
  }, [
    params.tripsPage,
    params.tripsLimit,
    params.truckId,
    params.startDate,
    params.endDate,
    params.tripNumber,
    params.globalSearch,
    params.isActive,
  ]);

  const {
    data: carriersData,
    isLoading: tripsLoading,
    error: tripsError,
    refetch: refetchTrips,
  } = useQuery({
    queryKey: ["centralTrips", carriersQueryParams],
    queryFn: () => getAllCarriers(carriersQueryParams),
    enabled: !!params.truckId,
    staleTime: 0,
  });

  const carriers = carriersData?.carriers || [];
  const tripsPagination = carriersData?.pagination || null;
  const tripsTotals = carriersData?.totals || {
    totalCars: 0,
    totalAmount: 0,
    totalExpenses: 0,
    totalProfit: 0,
    totalTrips: 0,
  };

  const [expensesState, setExpensesState] = useState({
    loading: false,
    error: null,
    data: null,
  });

  const fetchExpenses = useCallback(async () => {
    if (!params.truckId) return;
    setExpensesState((s) => ({ ...s, loading: true, error: null }));
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(params.expensesPage));
      sp.set("limit", String(params.expensesLimit));
      if (params.startDate) sp.set("startDate", params.startDate);
      if (params.endDate) sp.set("endDate", params.endDate);
      if (params.expenseCategory) sp.set("category", params.expenseCategory);
      const res = await fetch(
        `/api/trucks/${params.truckId}/all-expenses?${sp.toString()}`,
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load expenses");
      }
      setExpensesState({ loading: false, error: null, data: json });
    } catch (e) {
      setExpensesState({ loading: false, error: e.message, data: null });
    }
  }, [
    params.truckId,
    params.expensesPage,
    params.expensesLimit,
    params.startDate,
    params.endDate,
    params.expenseCategory,
  ]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const expensesData = expensesState.data;
  const expenseSummaries = expensesData?.summaries || {
    totalExpense: 0,
    byCategory: {},
    bySource: { trip: 0, truck: 0 },
  };

  // Net profit = revenue (cars) - ALL related expenses (trip + direct truck)
  const netProfit = useMemo(() => {
    const revenue = tripsTotals?.totalAmount || 0;
    const allExpense = expenseSummaries?.totalExpense || 0;
    return revenue - allExpense;
  }, [tripsTotals?.totalAmount, expenseSummaries?.totalExpense]);

  const handleParamsChange = useCallback(
    (patch) => {
      const sp = new URLSearchParams(window.location.search);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "") sp.delete(k);
        else sp.set(k, String(v));
      });
      router.push(`/central-dashboard?${sp.toString()}`);
    },
    [router],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-3 sm:px-4 py-4">
        <DashboardFilters
          params={params}
          onChange={handleParamsChange}
          tripsLoading={tripsLoading}
          expensesLoading={expensesState.loading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
          <TruckCards
            trucks={trucks}
            loading={trucksLoading}
            selectedTruckId={params.truckId}
            onSelectTruck={(truckId) =>
              handleParamsChange({
                truckId,
                tripsPage: 1,
                expensesPage: 1,
              })
            }
          />

          <TruckDetails
            truckId={params.truckId}
            trucks={trucks}
            startDate={params.startDate}
            endDate={params.endDate}
            tripNumber={params.tripNumber}
            expenseCategory={params.expenseCategory}
            trips={{
              loading: tripsLoading,
              error: tripsError?.message || null,
              carriers,
              pagination: tripsPagination,
              totals: tripsTotals,
              onPageChange: (page) => handleParamsChange({ tripsPage: page }),
              onLimitChange: (limit) =>
                handleParamsChange({ tripsLimit: limit, tripsPage: 1 }),
              onRefresh: refetchTrips,
            }}
            expenses={{
              loading: expensesState.loading,
              error: expensesState.error,
              data: expensesData,
              onPageChange: (page) => handleParamsChange({ expensesPage: page }),
              onLimitChange: (limit) =>
                handleParamsChange({ expensesLimit: limit, expensesPage: 1 }),
              onRefresh: fetchExpenses,
            }}
            summaries={{
              revenue: tripsTotals.totalAmount || 0,
              tripsProfit: tripsTotals.totalProfit || 0,
              tripExpenses: tripsTotals.totalExpenses || 0,
              truckExpenses: expenseSummaries.bySource?.truck || 0,
              tripRelatedExpenses: expenseSummaries.bySource?.trip || 0,
              allExpenses: expenseSummaries.totalExpense || 0,
              netProfit,
            }}
          />
        </div>
      </div>
    </div>
  );
}

