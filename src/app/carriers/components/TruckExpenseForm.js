"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

const CATEGORIES = [
  { value: "maintenance", label: "Service" },
  { value: "tyre", label: "Tyre" },
  { value: "others", label: "Others" },
];

export default function TruckExpenseForm({ truckId, truck, expense, onClose }) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState(expense?.category || "maintenance");
  const [amount, setAmount] = useState(expense?.amount?.toString() || "");
  const [details, setDetails] = useState(expense?.details || "");
  const [tyreNumber, setTyreNumber] = useState(expense?.tyreNumber || "");
  const [tyreInfo, setTyreInfo] = useState(expense?.tyreInfo || "");
  const [meterReading, setMeterReading] = useState(
    expense?.meterReading?.toString() || ""
  );
  const [date, setDate] = useState(
    expense?.date ? new Date(expense.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
  );

  // Auto-populate meter reading for service and tyre expenses from truck's current meter reading
  useEffect(() => {
    if ((category === "maintenance" || category === "tyre") && !expense && truck?.currentMeterReading) {
      const currentMeter = truck.currentMeterReading;
      if (!meterReading || meterReading === "") {
        setMeterReading(currentMeter.toString());
      }
    }
  }, [category, truck, expense]);

  const createExpenseMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/trucks/${truckId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create expense");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh truck data and expenses
      queryClient.invalidateQueries({ queryKey: ["truck-expenses", truckId] });
      queryClient.invalidateQueries({ queryKey: ["truck", truckId] });
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
      // Refetch truck data immediately to show updated maintenance info
      queryClient.refetchQueries({ queryKey: ["truck", truckId] });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/trucks/${truckId}/expenses/${expense._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update expense");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh truck data and expenses
      queryClient.invalidateQueries({ queryKey: ["truck-expenses", truckId] });
      queryClient.invalidateQueries({ queryKey: ["truck", truckId] });
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
      // Refetch truck data immediately to show updated maintenance info
      queryClient.refetchQueries({ queryKey: ["truck", truckId] });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate amount for tyre, maintenance, and others expenses
      if ((category === "tyre" || category === "maintenance" || category === "others") && (!amount || parseFloat(amount) <= 0)) {
        setError("Amount is required and must be greater than 0");
        setIsSubmitting(false);
        return;
      }

      const expenseData = {
        category,
        amount: parseFloat(amount) || 0,
        details: details.trim(),
        date,
      };
      
      if (category === "tyre") {
        if (tyreNumber) expenseData.tyreNumber = tyreNumber.trim();
        if (tyreInfo) expenseData.tyreInfo = tyreInfo.trim();
        if (meterReading) expenseData.meterReading = parseFloat(meterReading);
      }

      if (category === "maintenance") {
        if (meterReading) expenseData.meterReading = parseFloat(meterReading);
      }

      if (expense) {
        await updateExpenseMutation.mutateAsync(expenseData);
      } else {
        await createExpenseMutation.mutateAsync(expenseData);
      }

      onClose();
    } catch (err) {
      console.error("Error saving expense:", err);
      const errorMessage = err.message || "Failed to save expense";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">
            {expense ? "Edit Expense" : "Add Expense"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isSubmitting}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {category === "maintenance" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meter Reading (km)
                </label>
                <input
                  type="number"
                  step="1"
                  value={meterReading}
                  onChange={(e) => setMeterReading(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter current odometer reading"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {truck?.currentMeterReading 
                    ? `Current truck meter: ${truck.currentMeterReading.toLocaleString("en-US")} km (auto-filled)`
                    : "Record the vehicle&apos;s odometer reading at the time of service"}
                </p>
              </div>
              <div className="bg-green-50 p-2 rounded text-xs text-green-700">
                <strong>Note:</strong> This service expense will update the truck&apos;s last service record.
              </div>
            </>
          )}

          {category === "tyre" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meter Reading (km)
                </label>
                <input
                  type="number"
                  step="1"
                  value={meterReading}
                  onChange={(e) => setMeterReading(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter current odometer reading"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {truck?.currentMeterReading 
                    ? `Current truck meter: ${truck.currentMeterReading.toLocaleString("en-US")} km (auto-filled)`
                    : "Record the vehicle&apos;s odometer reading when the tyre was changed"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tyre Number
                </label>
                <input
                  type="text"
                  value={tyreNumber}
                  onChange={(e) => setTyreNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., TYRE-001"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tyre Information
                </label>
                <textarea
                  value={tyreInfo}
                  onChange={(e) => setTyreInfo(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Enter tyre details (brand, size, position, etc.)..."
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (R) *
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows="3"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Enter expense details..."
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : expense ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
