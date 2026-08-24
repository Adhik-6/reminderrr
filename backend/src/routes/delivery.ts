import { Router } from "express";
import { db } from "../db/database";

const router = Router();

router.get("/log", (req, res) => {

  try {
    const logs = db.prepare(`
      SELECT
        id,
        resident_id,
        appointment_id,
        channel,
        status,
        detail,
        attempted_at,
        body_preview
      FROM delivery_log
      ORDER BY attempted_at DESC
      LIMIT 100
    `).all();

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Could not fetch delivery log."
    });

  }

});

export default router;