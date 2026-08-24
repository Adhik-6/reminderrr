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

export default router;