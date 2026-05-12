"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTransaction } from "@/app/lib/accounting-actions/transaction";
import { X, ArrowUpDown, Calendar, FileText, Landmark, CheckCircle } from "lucide-react";

function toDatetimeLocalValue(dateLike) {
  try {
    const d = new Date(dateLike);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}

export default function EditTransactionForm({ account, transaction, onClose }) {
  const router = useRouter();

  const initial = useMemo(() => {
    const isCredit = (transaction?.credit ?? 0) > 0;
    const isDebit = (transaction?.debit ?? 0) > 0;
    const isBoth = isCredit && isDebit;
    const type = isBoth ? "both" : isCredit ? "credit" : "debit";
    const amount = isCredit ? transaction?.credit : transaction?.debit;
    const isTransfer = isDebit && !!transaction?.destination;
    return {
      type,
      amount: amount ?? "",
      creditAmount: transaction?.credit ?? "",
      debitAmount: transaction?.debit ?? "",
      details: transaction?.details ?? "",
      isTransfer,
      destination: transaction?.destination ?? "",
      transactionDate: toDatetimeLocalValue(transaction?.transactionDate),
      rateOfExchange: transaction?.rateOfExchange ?? "",
    };
  }, [transaction]);

  const [type, setType] = useState(initial.type);
  const [isTransfer, setIsTransfer] = useState(initial.isTransfer);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFormSubmit = async (formData) => {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      formData.append("transactionId", transaction._id);
      formData.append("accountId", account._id);
      formData.append("type", type);
      formData.append("debitType", isTransfer ? "transfer" : "expense");

      const result = await updateTransaction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(result.message || "Transaction updated successfully!");
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err?.message || "Failed to update transaction. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <ArrowUpDown className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                Edit Transaction
              </h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                {account?.title || "Account"} • {account?.currency || "USD"}
              </p>
            </div>
          </div>
          {!success && (
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-600 font-medium">{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-in slide-in-from-top duration-300">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {!success ? (
          <form action={handleFormSubmit} className="p-5 overflow-y-auto space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setType("credit");
                  setIsTransfer(false);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 border-2 rounded-lg transition-all text-sm font-semibold ${
                  type === "credit"
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-gray-100 bg-gray-50 text-gray-500"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    type === "credit" ? "bg-green-600" : "bg-gray-300"
                  }`}
                />
                Credit
              </button>
              <button
                type="button"
                onClick={() => setType("debit")}
                className={`flex items-center justify-center gap-2 py-2 px-3 border-2 rounded-lg transition-all text-sm font-semibold ${
                  type === "debit"
                    ? "border-red-600 bg-red-50 text-red-700"
                    : "border-gray-100 bg-gray-50 text-gray-500"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    type === "debit" ? "bg-red-600" : "bg-gray-300"
                  }`}
                />
                Debit
              </button>
              <button
                type="button"
                onClick={() => setType("both")}
                className={`flex items-center justify-center gap-2 py-2 px-3 border-2 rounded-lg transition-all text-sm font-semibold ${
                  type === "both"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-100 bg-gray-50 text-gray-500"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    type === "both" ? "bg-blue-600" : "bg-gray-300"
                  }`}
                />
                Both
              </button>
            </div>

            {(type === "debit" || type === "both") && (
              <div className="flex gap-4 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center">
                  <input
                    type="radio"
                    name="debitTypeRadio"
                    checked={!isTransfer}
                    onChange={() => setIsTransfer(false)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">Expense</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center">
                  <input
                    type="radio"
                    name="debitTypeRadio"
                    checked={isTransfer}
                    onChange={() => setIsTransfer(true)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">Transfer</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                {type !== "both" ? (
                  <>
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <span>{account.currencySymbol}</span>
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="amount"
                      required
                      min="0.01"
                      defaultValue={initial.amount}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                      placeholder="0.00"
                    />
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700">
                        Credit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="creditAmount"
                        min="0"
                        defaultValue={initial.creditAmount}
                        className="w-full px-3 py-2 bg-green-50 border border-green-100 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-sm transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700">
                        Debit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="debitAmount"
                        min="0"
                        defaultValue={initial.debitAmount}
                        className="w-full px-3 py-2 bg-red-50 border border-red-100 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date *
                </label>
                <input
                  type="datetime-local"
                  name="transactionDate"
                  defaultValue={initial.transactionDate}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                />
              </div>
            </div>

            {/* Destination (optional for credit; required only for debit/both transfer) */}
            {(type === "credit" || ((type === "debit" || type === "both") && isTransfer)) && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
                  Destination {type === "credit" ? "(Optional)" : "*"}
                </label>
                <input
                  type="text"
                  name="destination"
                  required={type !== "credit"}
                  defaultValue={initial.destination}
                  className="w-full px-3 py-2 bg-blue-50/30 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  placeholder="Where is the money going?"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Details *
              </label>
              <textarea
                name="details"
                rows="2"
                required
                defaultValue={initial.details}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none"
                placeholder="What was this for?"
              />
            </div>

            <div className="pt-4 border-t bg-white flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold text-white transition-all ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Landmark className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Updated</h3>
            <p className="text-gray-600 text-center mb-6">{success}</p>
            <p className="text-xs text-gray-400 animate-pulse">Closing...</p>
          </div>
        )}
      </div>
    </div>
  );
}
