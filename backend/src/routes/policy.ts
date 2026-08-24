import { Router } from "express";
import { db } from "../db/database";
import { ReminderContext } from "../policy/types";
import { PolicyEngine } from "../policy/PolicyEngine";

const router = Router();
const policyEngine = new PolicyEngine();

router.post("/evaluate", (req, res) => {

  const { residentId, appointmentId } = req.body;

  try {

    const resident = db.prepare(
      `SELECT * FROM contacts WHERE resident_id = ?`
    ).get(residentId);

    const appointment = db.prepare(
      `SELECT * FROM appointments WHERE appointment_id = ?`
    ).get(appointmentId);

    if (!resident || !appointment) {
      return res.status(404).json({
        success: false,
        error: "Resident or appointment not found."
      });
    }

    const context: ReminderContext = {
      resident: resident as any,
      appointment: appointment as any,
      now: new Date()
    };

    const decision = policyEngine.evaluate(context);

    res.json({
      success: true,
      context,
      decision
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Policy evaluation failed."
    });
  }
});

router.get("/evidence/:residentId", (req, res) => {

  const residentId = req.params.residentId;

  const since = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const contacts = db.prepare(`
    SELECT channel,status,attempted_at
    FROM delivery_log
    WHERE resident_id=?
    AND attempted_at>=?
    ORDER BY attempted_at DESC
  `).all(residentId, since);

  const blocked = db.prepare(`
    SELECT blocked_at,appointment_id,reason
    FROM blocked_contacts
    WHERE resident_id=?
    ORDER BY blocked_at DESC
  `).all(residentId);

  res.json({
    residentId,
    rolling7DayCount: contacts.length,
    contacts,
    blocked
  });

});

export default router;