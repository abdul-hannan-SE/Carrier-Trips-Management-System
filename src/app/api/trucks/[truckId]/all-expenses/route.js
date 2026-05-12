import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Expense from "@/app/lib/models/Expense";
import Carrier from "@/app/lib/models/Carrier";
import { getSession } from "@/app/lib/auth/getSession";

const VALID_CATEGORIES = [
  "fuel",
  "driver_rent",
  "taxes",
  "tool_taxes",
  "on_road",
  "maintenance",
  "tyre",
  "others",
];

function buildDateQuery(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const q = {};
  if (startDate) {
    const sd = new Date(startDate);
    sd.setHours(0, 0, 0, 0);
    q.$gte = sd;
  }
  if (endDate) {
    const ed = new Date(endDate);
    ed.setHours(23, 59, 59, 999);
    q.$lte = ed;
  }
  return Object.keys(q).length ? q : null;
}

// GET - All expenses related to a truck:
// - direct truck expenses (Expense.truck = truckId)
// - trip expenses for trips assigned to this truck (Expense.carrier where Carrier.truck = truckId)
export async function GET(request, { params }) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { truckId } = resolvedParams;
    if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
      return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
    }
    const truckObjectId = new mongoose.Types.ObjectId(truckId);

    // Authorization: user must own truck (unless super_admin)
    const Truck = (await import("@/app/lib/models/Truck")).default;
    const truck = await Truck.findById(truckObjectId).select("userId").lean();
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }
    if (
      session.role !== "super_admin" &&
      truck.userId?.toString() !== session.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "25", 10) || 25;
    const skip = (page - 1) * limit;
    const categoryRaw = (searchParams.get("category") || "").trim();
    const category =
      categoryRaw && VALID_CATEGORIES.includes(categoryRaw) ? categoryRaw : "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const dateQuery = buildDateQuery(startDate, endDate);

    // Find trip ids for this truck (permissions already checked via truck ownership)
    const tripIds = await Carrier.find({ truck: truckObjectId })
      .select("_id tripNumber name")
      .lean();
    const carrierIds = tripIds.map((t) => t._id);

    // Build base match for related expenses
    // Fuel is created on the trip and then auto-synced to truck using `syncedFromExpense`.
    // To prevent double-counting, exclude synced truck-fuel entries and rely on trip fuel.
    const relatedMatch = {
      $or: [
        // Direct truck expenses (exclude synced fuel duplicates)
        {
          truck: truckObjectId,
          $or: [
            { category: { $ne: "fuel" } },
            { syncedFromExpense: { $exists: false } },
            { syncedFromExpense: null },
          ],
        },
        // Trip expenses for trips assigned to this truck
        ...(carrierIds.length ? [{ carrier: { $in: carrierIds } }] : []),
      ],
    };

    if (category) relatedMatch.category = category;
    if (dateQuery) relatedMatch.date = dateQuery;

    const [facetResult] = await Expense.aggregate([
      { $match: relatedMatch },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: "$category",
                totalAmount: { $sum: "$amount" },
                totalLiters: { $sum: { $ifNull: ["$liters", 0] } },
              },
            },
          ],
          summaryBySource: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $ifNull: ["$carrier", false] },
                    "trip",
                    "truck",
                  ],
                },
                totalAmount: { $sum: "$amount" },
              },
            },
          ],
          expenses: [
            { $sort: { date: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "carriers",
                localField: "carrier",
                foreignField: "_id",
                as: "carrier",
              },
            },
            {
              $unwind: {
                path: "$carrier",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                category: 1,
                amount: 1,
                details: 1,
                liters: 1,
                pricePerLiter: 1,
                tyreNumber: 1,
                tyreInfo: 1,
                meterReading: 1,
                date: 1,
                createdAt: 1,
                updatedAt: 1,
                truck: 1,
                carrier: {
                  _id: "$carrier._id",
                  tripNumber: "$carrier.tripNumber",
                  name: "$carrier.name",
                },
              },
            },
          ],
          count: [{ $count: "total" }],
        },
      },
    ]);

    const total = facetResult?.count?.[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const summaryResults = facetResult?.summary || [];
    const summarySourceResults = facetResult?.summaryBySource || [];
    const expenses = facetResult?.expenses || [];

    const summaries = {
      totalExpense: 0,
      totalFuelLiters: 0,
      byCategory: {},
      bySource: {
        trip: 0,
        truck: 0,
      },
    };
    for (const cat of VALID_CATEGORIES) summaries.byCategory[cat] = 0;
    summaryResults.forEach((r) => {
      const cat = r._id;
      const amount = r.totalAmount || 0;
      if (VALID_CATEGORIES.includes(cat)) {
        summaries.byCategory[cat] = amount;
      }
      summaries.totalExpense += amount;
      if (cat === "fuel") {
        summaries.totalFuelLiters = r.totalLiters || 0;
      }
    });

    summarySourceResults.forEach((r) => {
      const src = r._id;
      const amount = r.totalAmount || 0;
      if (src === "trip") summaries.bySource.trip += amount;
      else if (src === "truck") summaries.bySource.truck += amount;
    });

    const serializedExpenses = expenses.map((e) => {
      const isTruckExpense = !!e.truck && !e.carrier?._id;
      return {
        _id: e._id?.toString?.() || e._id,
        source: isTruckExpense ? "truck" : "trip",
        category: e.category,
        amount: e.amount || 0,
        details: e.details || "",
        liters: e.liters ?? null,
        pricePerLiter: e.pricePerLiter ?? null,
        tyreNumber: e.tyreNumber ?? null,
        tyreInfo: e.tyreInfo ?? null,
        meterReading: e.meterReading ?? null,
        date: e.date,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        truck: e.truck?.toString?.() || e.truck || null,
        carrier: e.carrier?._id
          ? {
              _id: e.carrier._id?.toString?.() || e.carrier._id,
              tripNumber: e.carrier.tripNumber || null,
              name: e.carrier.name || null,
            }
          : null,
      };
    });

    return NextResponse.json({
      expenses: serializedExpenses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      summaries,
    });
  } catch (error) {
    console.error("Error fetching all truck expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 },
    );
  }
}

