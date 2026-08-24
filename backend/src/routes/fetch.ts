import { Router } from "express";
import { db } from "../db/database";

const router = Router();

router.get("/", (req, res) => {
  try {
    const {
      lang,
      sms_optout,
      voice_optout,
      email_optout,
      mobile,
      shared_mobile,
      appointments_gt
    } = req.query;

    let sql = `
      SELECT
        c.*,
        COUNT(a.appointment_id) AS appointment_count
      FROM contacts c
      LEFT JOIN appointments a
      ON c.resident_id = a.resident_id
    `;

    const where: string[] = [];
    const params: any[] = [];

    if (lang) {
      where.push("c.language = ?");
      params.push(lang);
    }
    if (sms_optout) {
      where.push("c.sms_optout = ?");
      params.push(sms_optout);
    }
    if (voice_optout) {
      where.push("c.voice_optout = ?");
      params.push(voice_optout);
    }
    if (email_optout) {
      where.push("c.email_optout = ?");
      params.push(email_optout);
    }
    if (mobile === "missing") {
      where.push("(c.mobile IS NULL OR c.mobile = '')");
    }
    if (shared_mobile === "true") {
      where.push(`
        c.mobile IN (
          SELECT mobile
          FROM contacts
          WHERE mobile IS NOT NULL
          AND mobile <> ''
          GROUP BY mobile
          HAVING COUNT(*) > 1
        )
      `);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");

    sql += `
      GROUP BY c.resident_id
    `;
    if (appointments_gt) {
      sql += ` HAVING appointment_count > ?`;
      params.push(Number(appointments_gt));
    }

    sql += ` ORDER BY c.resident_id LIMIT 100`;
    const rows = db.prepare(sql).all(...params);

    res.json({
      success: true,
      count: rows.length,
      filters: req.query,
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Fetch failed."
    });

  }
});

export default router;