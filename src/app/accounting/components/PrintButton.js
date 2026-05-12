"use client";
import { useState } from "react";
import { Printer, Loader2, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatDate } from "@/app/lib/utils/dateFormat";
export default function PrintButton({ account, filters }) {
  const [loading, setLoading] = useState(null); // 'pdf' | 'excel' | null

  const generatePDF = (data, balances) => {
    const doc = new jsPDF();
    const margin = 14;

    // --- Header Section (Left Aligned) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55); // Dark Gray
    doc.text(`${account.title}`.toUpperCase(), margin, 20);
    const pageWidth = doc.internal.pageSize.getWidth();

    const lineHeight = 5;
    let yPosition = margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Account Statement: ${account.slug}`, margin, 26);
    const formattedBalance = (balances?.currentBalance ?? 0).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
    doc.text(
      `Current Balance: ${account.currencySymbol}${formattedBalance}`,
      pageWidth - margin,
      yPosition,
      { align: "right" }
    );
    // Period and Search info
    doc.setFontSize(9);
    doc.text(`Period: ${filters.startDate} to ${filters.endDate}`, margin, 34);

    if (filters.search) {
      doc.text(`Filtered by: "${filters.search}"`, margin, 39);
    }

    // --- Data Processing ---
    const openingBalance =
      (balances && typeof balances.openingBalance === "number"
        ? balances.openingBalance
        : account.initialBalance) || 0;
    let currentBalance = openingBalance;
    let totalCredit = 0;
    let totalDebit = 0;

    // PDF should be oldest -> newest so balances build up consistently.
    // The API already returns oldest-first with calculatedBalance.
    const tableRows = data.map((t, index) => {
      const credit = t.credit || 0;
      const debit = t.debit || 0;
      totalCredit += credit;
      totalDebit += debit;

      const description = t.details || "";
      const destination = t.destination ? String(t.destination).trim() : "";
      // Prefer server-calculated global running balance when available
      if (typeof t.calculatedBalance === "number") {
        currentBalance = t.calculatedBalance;
      } else {
        currentBalance = currentBalance + credit - debit;
      }

      const rowBalance =
        typeof t.calculatedBalance === "number"
          ? t.calculatedBalance
          : currentBalance;

      return [
        index + 1,
        formatDate(t.transactionDate),
        description,
        destination || "-",
        credit > 0
          ? credit.toLocaleString(undefined, { minimumFractionDigits: 2 })
          : "-",
        debit > 0
          ? debit.toLocaleString(undefined, { minimumFractionDigits: 2 })
          : "-",
        rowBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      ];
    });

    const closingBalance =
      balances?.closingBalance ??
      (typeof data[data.length - 1]?.calculatedBalance === "number"
        ? data[data.length - 1].calculatedBalance
        : currentBalance);

    // Add a Summary Row at the end
    tableRows.push([
      {
        content: "TOTAL FOR PERIOD",
        colSpan: 4,
        styles: { halign: "right", fontStyle: "bold" },
      },
      {
        content: totalCredit.toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
        styles: { fontStyle: "bold" },
      },
      {
        content: totalDebit.toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
        styles: { fontStyle: "bold" },
      },
      {
        content: closingBalance.toLocaleString(undefined, {
          minimumFractionDigits: 2,
        }),
        styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
      },
    ]);

    // --- Generate Table ---
    autoTable(doc, {
      startY: filters.search ? 45 : 40,
      head: [
        [
          "S.No",
          "Date",
          "Description",
          "Destination",
          "Credit",
          "Debit",
          "Balance",
        ],
      ],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: [31, 41, 55],
        halign: "left", // Headers aligned left as requested
        fontSize: 9,
        cellPadding: 3,
      },
      styles: {
        fontSize: 8,
        valign: "middle",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 22 },
        2: { cellWidth: 50 },
        3: { cellWidth: 35 },
        4: { halign: "right", cellWidth: 24 },
        5: { halign: "right", cellWidth: 24 },
        6: { halign: "right", cellWidth: 26 },
      },
      didParseCell: function (data) {
        // Optional: color the Debit text red and Credit green in the table
        if (data.section === "body") {
          if (data.column.index === 4 && data.cell.text[0] !== "-")
            data.cell.styles.textColor = [21, 128, 61]; // Green
          if (data.column.index === 5 && data.cell.text[0] !== "-")
            data.cell.styles.textColor = [185, 28, 28]; // Red
        }
      },
    });

    doc.save(`${account.slug}_statement.pdf`);
  };

  const generateExcel = (data, balances) => {
    const openingBalance =
      (balances && typeof balances.openingBalance === "number"
        ? balances.openingBalance
        : account.initialBalance) || 0;

    let currentBalance = openingBalance;
    let totalCredit = 0;
    let totalDebit = 0;

    const rows = data.map((t, index) => {
      const credit = t.credit || 0;
      const debit = t.debit || 0;
      totalCredit += credit;
      totalDebit += debit;

      if (typeof t.calculatedBalance === "number") {
        currentBalance = t.calculatedBalance;
      } else {
        currentBalance = currentBalance + credit - debit;
      }

      const rowBalance =
        typeof t.calculatedBalance === "number" ? t.calculatedBalance : currentBalance;

      return [
        index + 1,
        formatDate(t.transactionDate),
        t.details || "",
        t.destination ? String(t.destination).trim() : "-",
        credit > 0 ? credit : "",
        debit > 0 ? debit : "",
        rowBalance,
      ];
    });

    const closingBalance =
      balances?.closingBalance ??
      (typeof data[data.length - 1]?.calculatedBalance === "number"
        ? data[data.length - 1].calculatedBalance
        : currentBalance);

    // Header/meta
    const sheetData = [
      [`${account.title}`],
      [`Account Statement: ${account.slug}`],
      [
        `Period: ${filters.startDate || "All"} to ${filters.endDate || "All"}`,
      ],
      filters.search ? [`Filtered by: "${filters.search}"`] : [],
      [],
      ["S.No", "Date", "Description", "Destination", "Credit", "Debit", "Balance"],
      ...rows,
      [],
      ["TOTAL FOR PERIOD", "", "", "", totalCredit, totalDebit, closingBalance],
    ].filter((r) => r.length > 0);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Basic column widths
    ws["!cols"] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 45 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");

    XLSX.writeFile(wb, `${account.slug}_statement.xlsx`);
  };

  const fetchStatementData = async () => {
    const response = await fetch("/api/print-statement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountSlug: account.slug, filters }),
    });

    if (!response.ok) throw new Error("Server error");
    return await response.json();
  };

  const handleExportPdf = async () => {
    setLoading("pdf");
    try {
      const result = await fetchStatementData();

      if (result.transactions?.length > 0) {
        generatePDF(result.transactions, {
          openingBalance: result.openingBalance,
          closingBalance: result.closingBalance,
          currentBalance: result.currentBalance,
        });
      } else {
        alert("No records found for the selected range.");
      }
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportPdf}
        disabled={!!loading}
        className="h-8 px-2 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-md flex items-center gap-2 transition-all disabled:opacity-50"
      >
        {loading === "pdf" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Printer className="w-3.5 h-3.5" />
        )}
        {loading === "pdf" ? "Preparing PDF..." : "Print Statement"}
      </button>

      <button
        onClick={async () => {
          setLoading("excel");
          try {
            const result = await fetchStatementData();
            if (result.transactions?.length > 0) {
              generateExcel(result.transactions, {
                openingBalance: result.openingBalance,
                closingBalance: result.closingBalance,
                currentBalance: result.currentBalance,
              });
            } else {
              alert("No records found for the selected range.");
            }
          } catch (error) {
            alert("Error: " + error.message);
          } finally {
            setLoading(null);
          }
        }}
        disabled={!!loading}
        className="h-8 px-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md flex items-center gap-2 transition-all disabled:opacity-50"
      >
        {loading === "excel" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5" />
        )}
        {loading === "excel" ? "Preparing Excel..." : "Export Excel"}
      </button>
    </div>
  );
}
