const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");

const requireAdmin = (req, res, next) => {
  const userType = req.user.userType || req.user.user_type;
  if (userType !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Get all trips (public) - RETURNS ALL TRIPS WITHOUT FILTERING
router.get("/", async (req, res) => {
  try {
    console.log("🚀 GET /api/trips - Fetching all trips");
    const query = "SELECT * FROM trips ORDER BY id ASC";
    const result = await pool.query(query);
    console.log("✅ Success - Returned", result.rows.length, "trips");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ success: true, trips: result.rows });
  } catch (error) {
    console.error("❌ ERROR fetching trips:", error.message);
    res.status(500).json({ error: "Failed to fetch trips", details: error.message });
  }
});

// Get single trip (by ID or slug)
router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    
    // Check if it's a numeric ID or a slug
    const isNumericId = /^\d+$/.test(idOrSlug);
    
    let result;
    if (isNumericId) {
      result = await pool.query("SELECT * FROM trips WHERE id = $1", [idOrSlug]);
    } else {
      // Try to find by slug
      result = await pool.query("SELECT * FROM trips WHERE slug = $1", [idOrSlug]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const tripId = result.rows[0].id;
    const dates = await pool.query(
      "SELECT * FROM trip_dates WHERE trip_id = $1 ORDER BY date",
      [tripId],
    );

    res.json({
      success: true,
      trip: { ...result.rows[0], dates: dates.rows },
    });
  } catch (error) {
    console.error("Error fetching trip:", error);
    res.status(500).json({ error: "Failed to fetch trip" });
  }
});

// Admin: Create trip
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      slug,
      tripType,
      shortTitle,
      description,
      mainImage,
      adultPrice,
      childPrice,
      currency,
      durationText,
      location,
      isFlexibleDate,
      isFixedDate,
      isPopular,
      isTripOfWeek,
      isDeal,
      isGoodbyeSharm,
      isActive,
    } = req.body;

    if (!title || !slug) {
      return res.status(400).json({ error: "Title and slug are required" });
    }

    const result = await pool.query(
      `INSERT INTO trips (
        title, slug, trip_type, short_title, description, main_image, 
        adult_price, child_price, currency, duration_text, location, is_flexible_date, 
        is_fixed_date, is_popular, is_trip_of_week, is_deal, 
        is_goodbye_sharm, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        title,
        slug,
        tripType || null,
        shortTitle || null,
        description || null,
        mainImage || null,
        adultPrice || null,
        childPrice || null,
        currency || "USD",
        durationText || null,
        location || null,
        isFlexibleDate || false,
        isFixedDate || false,
        isPopular || false,
        isTripOfWeek || false,
        isDeal || false,
        isGoodbyeSharm || false,
        isActive !== false,
      ],
    );

    res.status(201).json({ success: true, trip: result.rows[0] });
  } catch (error) {
    console.error("Error creating trip:", error);
    res
      .status(500)
      .json({ error: "Failed to create trip", details: error.message });
  }
});

// Admin: Update trip
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const allowedFields = [
      "title",
      "slug",
      "trip_type",
      "short_title",
      "description",
      "main_image",
      "adult_price",
      "child_price",
      "currency",
      "duration_text",
      "location",
      "is_flexible_date",
      "is_fixed_date",
      "is_popular",
      "is_trip_of_week",
      "is_deal",
      "is_goodbye_sharm",
      "is_active",
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(fields).forEach((key) => {
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (allowedFields.includes(dbKey)) {
        updates.push(`${dbKey} = $${paramCount}`);
        values.push(fields[key]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(id);
    const query = `UPDATE trips SET ${updates.join(", ")}, updated_at = NOW() 
                   WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    res.json({ success: true, trip: result.rows[0] });
  } catch (error) {
    console.error("Error updating trip:", error);
    res.status(500).json({ error: "Failed to update trip" });
  }
});

// Admin: Delete trip
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM trips WHERE id = $1 RETURNING id",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    res.json({ success: true, message: "Trip deleted successfully" });
  } catch (error) {
    console.error("Error deleting trip:", error);
    res.status(500).json({ error: "Failed to delete trip" });
  }
});

// Admin: Add trip date
router.post("/:id/dates", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tripDate, price, slots } = req.body;

    if (!tripDate) {
      return res.status(400).json({ error: "Trip date is required" });
    }

    const result = await pool.query(
      `INSERT INTO trip_dates (trip_id, date, price, slots)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, tripDate, price || null, slots || 20],
    );

    res.status(201).json({ success: true, date: result.rows[0] });
  } catch (error) {
    console.error("Error adding trip date:", error);
    res.status(500).json({ error: "Failed to add trip date" });
  }
});

// Admin: Delete trip date
router.delete(
  "/:id/dates/:dateId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { dateId } = req.params;
      const result = await pool.query(
        "DELETE FROM trip_dates WHERE id = $1 RETURNING id",
        [dateId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Trip date not found" });
      }

      res.json({ success: true, message: "Trip date deleted successfully" });
    } catch (error) {
      console.error("Error deleting trip date:", error);
      res.status(500).json({ error: "Failed to delete trip date" });
    }
  },
);

module.exports = router;
