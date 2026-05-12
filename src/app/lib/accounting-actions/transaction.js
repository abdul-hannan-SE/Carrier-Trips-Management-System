"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/app/lib/dbConnect";
import Account from "@/app/lib/models/Account";
import Transaction from "@/app/lib/models/Transaction";
import { requireAccountingAccess, requireSuperAdmin } from "@/app/lib/auth/getSession";

import mongoose from "mongoose";

function parseDatetimeLocalToDate(value) {
  // `datetime-local` input sends "YYYY-MM-DDTHH:mm" (no timezone).
  // In Node, `new Date(str)` treats this as UTC and can shift the day.
  // Parse it as local time explicitly.
  if (!value || typeof value !== "string") return null;
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s || 0)
  );
}

function parseDateOnlyToDate(value) {
  // `date` input sends "YYYY-MM-DD" (no timezone).
  // In Node, `new Date("YYYY-MM-DD")` is treated as UTC and can shift the day.
  // Parse as local midnight.
  if (!value || typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0);
}

export async function createTransaction(formData) {
  try {
    // Only accounting roles (super_admin, sub_admin) can create transactions
    await requireAccountingAccess();
  } catch (error) {
    return { error: "Access denied: Accounting access required" };
  }
  
  await connectDB();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const accountId = formData.get("accountId");
    const type = formData.get("type");
    const amount = Number(formData.get("amount"));
    const creditAmount = Number(formData.get("creditAmount"));
    const debitAmount = Number(formData.get("debitAmount"));
    const details = formData.get("details");
    const destination = formData.get("destination")?.trim() || null;
    const debitType = formData.get("debitType");
    const rateOfExchange = formData.get("rateOfExchange")
      ? Number(formData.get("rateOfExchange"))
      : null;

    const transactionDateRaw = formData.get("transactionDate");
    const transactionDate =
      parseDatetimeLocalToDate(transactionDateRaw) ||
      parseDateOnlyToDate(transactionDateRaw) ||
      (transactionDateRaw ? new Date(transactionDateRaw) : null) ||
      new Date();

    /* =====================
       Validation
    ===================== */
    if (!accountId || !type || !details) {
      return { error: "Account, type, and details are required" };
    }

    // Destination is optional for all transaction types.
    // Only require it when user explicitly marks a DEBIT/BOTH as a transfer.
    if ((type === "debit" || type === "both") && debitType === "transfer" && !destination) {
      return { error: "Destination is required for transfers" };
    }

    if (type === "both") {
      if (!creditAmount && !debitAmount) {
        return { error: "Credit or debit amount is required" };
      }
      if (creditAmount < 0 || debitAmount < 0) {
        return { error: "Amounts must be positive" };
      }
    } else {
      if (!amount) {
        return { error: "Amount is required" };
      }
      if (amount < 0) {
        return { error: "Amount must be positive" };
      }
    }

    /* =====================
       Get Account (locked)
    ===================== */
    const account = await Account.findById(accountId).session(session);
    if (!account) {
      return { error: "Account not found" };
    }

    let credit = 0;
    let debit = 0;

    if (type === "credit") credit = amount;
    if (type === "debit") debit = amount;
    if (type === "both") {
      credit = creditAmount || 0;
      debit = debitAmount || 0;
    }

    const newBalance = account.currentBalance + credit - debit;

    /* =====================
       Update Balance (atomic)
    ===================== */
    account.currentBalance = newBalance;
    await account.save({ session });

    /* =====================
       Create Transaction
    ===================== */
    await Transaction.create(
      [
        {
          accountId,
          accountSlug: account.slug,
          credit,
          debit,
          currency: account.currency,
          details,
          destination: destination || null,
          rateOfExchange,
          transactionDate,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    revalidatePath("/");

    return {
      success: true,
      message: "Transaction recorded successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return { error: "Failed to create transaction" };
  }
}

export async function getAllTransactions(filters = {}) {
  try {
    // Only accounting roles (super_admin, sub_admin) can access transactions
    await requireAccountingAccess();
  } catch (error) {
    return {
      transactions: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
      totalAmount: 0,
    };
  }
  
  await connectDB();

  try {
    const {
      startDate,
      endDate,
      search,
      type,
      accountSlug,
      accountIds,
      page = 1,
      limit = 50,
    } = filters;

    const matchStage = {};

    /* =======================
       Account Filter
    ======================= */
    if (accountSlug) {
      matchStage.accountSlug = accountSlug;
    } else if (Array.isArray(accountIds) && accountIds.length > 0) {
      matchStage.accountId = {
        $in: accountIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    /* =======================
       Date Filter (Exact / Range)
    ======================= */
    if (startDate || endDate) {
      const dateQuery = {};

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        dateQuery.$gte = start;
        dateQuery.$lte = end;
      } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(startDate);
        end.setHours(23, 59, 59, 999);

        dateQuery.$gte = start;
        dateQuery.$lte = end;
      }

      matchStage.transactionDate = dateQuery;
    }

    /* =======================
       Type Filter
    ======================= */
    if (type === "credit") {
      matchStage.credit = { $gt: 0 };
    } else if (type === "debit") {
      matchStage.debit = { $gt: 0 };
    }

    /* =======================
       Search Filter
    ======================= */
    if (search) {
      matchStage.$or = [
        { details: { $regex: search, $options: "i" } },
        { destination: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    /* =======================
       Aggregation Pipeline
    ======================= */
    const pipeline = [
      { $match: matchStage },

      { $sort: { transactionDate: -1, createdAt: -1 } },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },

            {
              $lookup: {
                from: "accounts",
                localField: "accountId",
                foreignField: "_id",
                as: "account",
              },
            },
            { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

            {
              $project: {
                _id: { $toString: "$_id" }, // Convert ObjectId to string
                accountId: { $toString: "$accountId" }, // Convert accountId to string
                transactionDate: {
                  $dateToString: {
                    format: "%Y-%m-%dT%H:%M:%S.%LZ",
                    date: "$transactionDate",
                  },
                },
                credit: 1,
                debit: 1,
                details: 1,
                destination: 1,
                rateOfExchange: 1,
                createdAt: {
                  $dateToString: {
                    format: "%Y-%m-%dT%H:%M:%S.%LZ",
                    date: "$createdAt",
                  },
                },
                account: {
                  title: "$account.title",
                  slug: "$account.slug",
                  currency: "$account.currency",
                  currencySymbol: "$account.currencySymbol",
                },
              },
            },
          ],

          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Transaction.aggregate(pipeline);

    const transactions = result.data || [];
    const total = result.totalCount[0]?.count || 0;

    // Convert MongoDB aggregation result to plain objects
    const plainTransactions = transactions.map((transaction) => {
      const plain = { ...transaction };

      // Ensure all dates are strings
      if (plain.transactionDate && typeof plain.transactionDate === "object") {
        plain.transactionDate = plain.transactionDate.toISOString();
      }

      if (plain.createdAt && typeof plain.createdAt === "object") {
        plain.createdAt = plain.createdAt.toISOString();
      }

      return plain;
    });

    return {
      transactions: plainTransactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    return {
      transactions: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }
}

export async function getAccountTransactions(accountSlug, filters = {}) {
  return getAllTransactions({ ...filters, accountSlug });
}

export async function updateTransaction(formData) {
  try {
    // Allow sub_admin to edit transactions
    await requireAccountingAccess();
  } catch (error) {
    return { error: "Access denied: Accounting access required" };
  }

  await connectDB();

  const transactionId = formData.get("transactionId");
  const accountId = formData.get("accountId");
  const type = formData.get("type");
  const amount = Number(formData.get("amount"));
  const creditAmount = Number(formData.get("creditAmount"));
  const debitAmount = Number(formData.get("debitAmount"));
  const details = formData.get("details");
  const destination = formData.get("destination")?.trim() || null;
  const debitType = formData.get("debitType");
  const rateOfExchange = formData.get("rateOfExchange")
    ? Number(formData.get("rateOfExchange"))
    : null;

  const transactionDateRaw = formData.get("transactionDate");
  const transactionDate =
    parseDatetimeLocalToDate(transactionDateRaw) ||
    parseDateOnlyToDate(transactionDateRaw) ||
    (transactionDateRaw ? new Date(transactionDateRaw) : null) ||
    new Date();

  if (!transactionId || !accountId) {
    return { error: "Transaction and account are required" };
  }

  if (!type || !details) {
    return { error: "Type and details are required" };
  }

  // Destination is optional for all transaction types.
  // Only require it when user explicitly marks a DEBIT/BOTH as a transfer.
  if ((type === "debit" || type === "both") && debitType === "transfer" && !destination) {
    return { error: "Destination is required for transfers" };
  }

  if (type === "both") {
    if (!creditAmount && !debitAmount) {
      return { error: "Credit or debit amount is required" };
    }
    if (creditAmount < 0 || debitAmount < 0) {
      return { error: "Amounts must be positive" };
    }
  } else {
    if (!amount) {
      return { error: "Amount is required" };
    }
    if (amount < 0) {
      return { error: "Amount must be positive" };
    }
  }

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    return { error: "Invalid transactionId" };
  }

  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    return { error: "Invalid accountId" };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const existingTx = await Transaction.findById(transactionId).session(session);
    if (!existingTx) {
      return { error: "Transaction not found" };
    }

    const oldAccount = await Account.findById(existingTx.accountId).session(
      session
    );
    if (!oldAccount) {
      return { error: "Account not found" };
    }

    const newAccount = await Account.findById(accountId).session(session);
    if (!newAccount) {
      return { error: "Account not found" };
    }

    const oldEffect = (existingTx.credit || 0) - (existingTx.debit || 0);
    let newCredit = 0;
    let newDebit = 0;
    if (type === "credit") newCredit = amount;
    if (type === "debit") newDebit = amount;
    if (type === "both") {
      newCredit = creditAmount || 0;
      newDebit = debitAmount || 0;
    }
    const newEffect = newCredit - newDebit;

    if (oldAccount._id.toString() === newAccount._id.toString()) {
      // Same account: apply delta
      const delta = newEffect - oldEffect;
      oldAccount.currentBalance = (oldAccount.currentBalance || 0) + delta;
      await oldAccount.save({ session });
    } else {
      // Different accounts: reverse old then apply new
      oldAccount.currentBalance = (oldAccount.currentBalance || 0) - oldEffect;
      newAccount.currentBalance = (newAccount.currentBalance || 0) + newEffect;
      await oldAccount.save({ session });
      await newAccount.save({ session });
    }

    existingTx.accountId = newAccount._id;
    existingTx.accountSlug = newAccount.slug;
    existingTx.credit = newCredit;
    existingTx.debit = newDebit;
    existingTx.currency = newAccount.currency;
    existingTx.details = details;
    existingTx.destination = destination || null;
    existingTx.rateOfExchange = rateOfExchange;
    existingTx.transactionDate = transactionDate;

    await existingTx.save({ session });

    await session.commitTransaction();
    session.endSession();

    revalidatePath("/accounting");
    revalidatePath("/");

    return { success: true, message: "Transaction updated successfully" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return { error: error?.message || "Failed to update transaction" };
  }
}

export async function deleteTransaction(transactionId) {
  try {
    // Allow sub_admin to delete transactions
    await requireAccountingAccess();
  } catch (error) {
    return { error: "Access denied: Accounting access required" };
  }

  await connectDB();

  if (!transactionId || !mongoose.Types.ObjectId.isValid(transactionId)) {
    return { error: "Invalid transactionId" };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const existingTx = await Transaction.findById(transactionId).session(session);
    if (!existingTx) {
      return { error: "Transaction not found" };
    }

    const account = await Account.findById(existingTx.accountId).session(session);
    if (!account) {
      return { error: "Account not found" };
    }

    const effect = (existingTx.credit || 0) - (existingTx.debit || 0);
    account.currentBalance = (account.currentBalance || 0) - effect;
    await account.save({ session });

    await Transaction.deleteOne({ _id: existingTx._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    revalidatePath("/accounting");
    revalidatePath("/");

    return { success: true, message: "Transaction deleted successfully" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return { error: error?.message || "Failed to delete transaction" };
  }
}

// Account statement helper: computes opening/closing balances and
// running balances on the server, with filtering and pagination.
export async function getAccountStatementTransactions(accountSlug, filters = {}) {
  try {
    // Only accounting roles (super_admin, sub_admin) can access statements
    await requireAccountingAccess();
  } catch (error) {
    return {
      transactions: [],
      total: 0,
      totalPages: 1,
      openingBalance: 0,
      closingBalance: 0,
      totalCredit: 0,
      totalDebit: 0,
    };
  }

  await connectDB();

  try {
    const {
      startDate,
      endDate,
      search,
      type = "all",
      page = 1,
      limit = 25,
    } = filters;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 25);
    const skip = (pageNum - 1) * limitNum;

    // Load account to get balances/currency
    const account = await Account.findOne({ slug: accountSlug }).lean();
    if (!account) {
      return {
        transactions: [],
        total: 0,
        totalPages: 1,
        openingBalance: 0,
        closingBalance: 0,
        totalCredit: 0,
        totalDebit: 0,
      };
    }

    // Build period date range
    let startDateObj = null;
    let endDateObj = null;

    if (startDate && endDate) {
      startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);

      endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
    } else if (startDate) {
      startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);

      endDateObj = new Date(startDate);
      endDateObj.setHours(23, 59, 59, 999);
    }

    // Opening balance before the selected period
    let openingBalance = account.initialBalance || 0;
    if (startDateObj) {
      const priorAgg = await Transaction.aggregate([
        {
          $match: {
            accountSlug,
            transactionDate: { $lt: startDateObj },
          },
        },
        {
          $group: {
            _id: null,
            totalCredit: { $sum: "$credit" },
            totalDebit: { $sum: "$debit" },
          },
        },
      ]);

      if (priorAgg.length > 0) {
        const prior = priorAgg[0];
        openingBalance += (prior.totalCredit || 0) - (prior.totalDebit || 0);
      }
    }

    // Base query for the selected period and filters
    const baseQuery = { accountSlug };

    if (startDateObj && endDateObj) {
      baseQuery.transactionDate = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    if (type === "credit") {
      baseQuery.credit = { $gt: 0 };
    } else if (type === "debit") {
      baseQuery.debit = { $gt: 0 };
    }

    if (search && search.trim() !== "") {
      baseQuery.$or = [
        { details: { $regex: search, $options: "i" } },
        { destination: { $regex: search, $options: "i" } },
      ];
    }

    // Aggregate period totals and total record count without loading all docs
    const totalsAgg = await Transaction.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalCredit: { $sum: "$credit" },
          totalDebit: { $sum: "$debit" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalCredit = totalsAgg[0]?.totalCredit || 0;
    const totalDebit = totalsAgg[0]?.totalDebit || 0;
    const total = totalsAgg[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));

    const closingBalance = openingBalance + totalCredit - totalDebit;

    if (total === 0) {
      return {
        transactions: [],
        total,
        totalPages,
        openingBalance,
        closingBalance,
        totalCredit,
        totalDebit,
      };
    }

    // We want newest transactions on page 1.
    // To keep running balances correct, compute them in reverse (from closingBalance).
    let startingBalanceForPage = closingBalance;
    if (skip > 0) {
      // Sum the effect (credit - debit) of the `skip` newest transactions,
      // then subtract it from closingBalance to get the balance just before this page begins.
      const pageOffsetAgg = await Transaction.aggregate([
        { $match: baseQuery },
        { $sort: { transactionDate: -1, createdAt: -1, _id: -1 } },
        { $limit: skip },
        {
          $group: {
            _id: null,
            totalCredit: { $sum: "$credit" },
            totalDebit: { $sum: "$debit" },
          },
        },
      ]);

      if (pageOffsetAgg.length > 0) {
        const offset = pageOffsetAgg[0];
        const offsetEffect =
          (offset.totalCredit || 0) - (offset.totalDebit || 0);
        startingBalanceForPage = closingBalance - offsetEffect;
      }
    }

    // Fetch only the current page of transactions (newest first)
    const pageTransactions = await Transaction.find(baseQuery)
      .sort({ transactionDate: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Attach running balance (balance after each transaction) in newest-first order
    let currentBalance = startingBalanceForPage;
    const plainTransactions = pageTransactions.map((t) => {
      const credit = t.credit || 0;
      const debit = t.debit || 0;

      // In newest-first order, currentBalance starts at closing balance (or page-start balance)
      // which represents the balance AFTER applying this transaction and all older ones.
      const runningBalance = currentBalance;

      // Move backwards for the next (older) transaction
      currentBalance = currentBalance - credit + debit;

      return {
        _id: t._id.toString(),
        accountId: t.accountId?.toString?.() ?? null,
        transactionDate: t.transactionDate?.toISOString?.() ?? null,
        credit,
        debit,
        details: t.details ?? "",
        destination: t.destination ?? null,
        rateOfExchange: t.rateOfExchange ?? null,
        createdAt: t.createdAt?.toISOString?.() ?? null,
        runningBalance,
      };
    });

    return {
      transactions: plainTransactions,
      total,
      totalPages,
      openingBalance,
      closingBalance,
      totalCredit,
      totalDebit,
    };
  } catch (error) {
    return {
      transactions: [],
      total: 0,
      totalPages: 1,
      openingBalance: 0,
      closingBalance: 0,
      totalCredit: 0,
      totalDebit: 0,
    };
  }
}
