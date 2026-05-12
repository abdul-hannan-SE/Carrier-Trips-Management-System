"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import connectDB from "@/app/lib/dbConnect";
import Account from "@/app/lib/models/Account";
import Transaction from "@/app/lib/models/Transaction";
import { requireAccountingAccess, requireSuperAdmin } from "@/app/lib/auth/getSession";
import mongoose from "mongoose";

export async function getAccounts(searchParams = {}) {
  try {
    // Only accounting roles (super_admin, sub_admin) can access accounting
    await requireAccountingAccess();
  } catch (error) {
    return {
      accounts: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }
  
  await connectDB();

  const page = parseInt(searchParams.page) || 1;
  const limit = parseInt(searchParams.limit) || 10;
  const search = searchParams.search || "";
  const currency = searchParams.currency || "";

  const query = {};

  // Search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  // Currency filter
  if (currency && currency !== "all") {
    query.currency = currency;
  }

  try {
    // Get total count for pagination
    const total = await Account.countDocuments(query);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Get paginated accounts
    const accounts = await Account.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      accounts: JSON.parse(JSON.stringify(accounts)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    return {
      accounts: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }
}
export async function getAccountsCount() {
  try {
    // Only accounting roles (super_admin, sub_admin) can access accounting
    await requireAccountingAccess();
    await connectDB();
    const totalAccounts = await Account.countDocuments();
    return totalAccounts;
  } catch (error) {
    // If not super admin or other error, return 0
    return 0;
  }
}
export async function createAccount(formData) {
  try {
    // Only accounting roles (super_admin, sub_admin) can create accounts
    await requireAccountingAccess();
  } catch (error) {
    return { error: "Access denied: Accounting access required" };
  }
  
  await connectDB();

  try {
    const title = formData.get("title");
    const slug = formData.get("slug");
    const initialBalance = parseFloat(formData.get("initialBalance"));
    const currency = formData.get("currency");
    const currencySymbol = formData.get("currencySymbol");

    // Validate input
    if (!title || !slug || !currency || !currencySymbol) {
      return { error: "All fields are required" };
    }

    if (isNaN(initialBalance)) {
      return { error: "Initial balance must be a valid number" };
    }

    // Check if account with same slug exists
    const existingAccount = await Account.findOne({
      slug: slug.toLowerCase().trim(),
    });
    if (existingAccount) {
      return { error: "Account with this slug already exists" };
    }

    // Create new account
    const account = new Account({
      title: title.trim(),
      slug: slug.toLowerCase().trim(),
      initialBalance: parseFloat(initialBalance) || 0,
      currentBalance: parseFloat(initialBalance) || 0,
      currency: currency.trim(),
      currencySymbol: currencySymbol.trim(),
    });

    await account.save();

    revalidatePath("/");
    return { success: true, message: "Account created successfully" };
  } catch (error) {
    // Return more specific error message
    if (error.code === 11000) {
      return { error: "Account with this slug already exists" };
    }
    if (error.message) {
      return { error: error.message };
    }
    return {
      error: "Failed to create account. Please check all fields and try again.",
    };
  }
}

export async function updateAccount(formData) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    return { error: "Access denied: Super admin required" };
  }

  await connectDB();

  const accountId = formData.get("accountId");
  const title = formData.get("title");
  const slug = formData.get("slug");
  const currency = formData.get("currency");
  const currencySymbol = formData.get("currencySymbol");

  if (!accountId || !title || !slug || !currency || !currencySymbol) {
    return { error: "All fields are required" };
  }

  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    return { error: "Invalid accountId" };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const existing = await Account.findById(accountId).session(session);
    if (!existing) {
      return { error: "Account not found" };
    }

    const nextSlug = slug.toLowerCase().trim();
    if (nextSlug !== existing.slug) {
      const slugTaken = await Account.findOne({
        slug: nextSlug,
        _id: { $ne: existing._id },
      })
        .session(session)
        .lean();
      if (slugTaken) {
        return { error: "Account with this slug already exists" };
      }
    }

    existing.title = title.trim();
    existing.slug = nextSlug;
    existing.currency = currency.trim();
    existing.currencySymbol = currencySymbol.trim();

    await existing.save({ session });

    // Keep transactions in sync with updated slug/currency
    await Transaction.updateMany(
      { accountId: existing._id },
      {
        $set: {
          accountSlug: existing.slug,
          currency: existing.currency,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    revalidatePath("/accounting");
    revalidatePath("/");

    return { success: true, message: "Account updated successfully" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error?.code === 11000) {
      return { error: "Account with this slug already exists" };
    }
    return { error: error?.message || "Failed to update account" };
  }
}

export async function deleteAccount(accountId) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    return { error: "Access denied: Super admin required" };
  }

  await connectDB();

  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
    return { error: "Invalid accountId" };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const account = await Account.findById(accountId).session(session);
    if (!account) {
      return { error: "Account not found" };
    }

    // Delete all related transactions (account is being removed)
    await Transaction.deleteMany({ accountId: account._id }).session(session);
    await Account.deleteOne({ _id: account._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    revalidatePath("/accounting");
    revalidatePath("/");

    return { success: true, message: "Account deleted successfully" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return { error: error?.message || "Failed to delete account" };
  }
}
