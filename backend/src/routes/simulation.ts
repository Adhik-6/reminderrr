import {  Router } from "express";
import { db } from "../db/database";
import { ReminderService } from "../services/reminderService";
import { QueueService } from "../queue/QueueService";
import { DeliveryLogger } from "../services/DeliveryLogger";
import { PolicyEngine } from "../policy/PolicyEngine";

const router = Router();

const queueService = new QueueService(db);
const deliveryLogger = new DeliveryLogger(db);
const policyEngine = new PolicyEngine();
const reminderService = new ReminderService(
  db,
  policyEngine,
  deliveryLogger
);

router.post("/send", async (req, res) => {
  try {
    const result = await reminderService.sendReminder({
      residentId: req.body.residentId,
      appointmentId: req.body.appointmentId,
      now: req.body.simulateTime
        ? new Date(req.body.simulateTime)
        : new Date()
    });

    res.json({
      success: true,
      ...result
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: String(err)
    });

  }

});

router.post("/schedule", (req, res) => {
  const {
    residentId,
    appointmentId,
    delaySeconds = 5
  } = req.body;

  const scheduledFor = new Date(
    Date.now() + delaySeconds * 1000
  );

  queueService.addJob(
    residentId,
    appointmentId,
    scheduledFor
  );

  res.json({
    success: true,
    scheduledFor
  });

});

router.post("/fill-history", (req, res) => {
  const { residentId, appointmentId } = req.body;
  const stmt = db.prepare(`
    INSERT INTO delivery_log
    (
      resident_id,
      appointment_id,
      channel,
      status,
      detail,
      attempted_at,
      body_preview
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    residentId,
    appointmentId,
    "sms",
    "delivered",
    "",
    new Date(Date.now()-2*24*60*60*1000).toISOString(),
    "Test"
  );

  stmt.run(
    residentId,
    appointmentId,
    "voice",
    "answered",
    "",
    new Date(Date.now()-1*24*60*60*1000).toISOString(),
    "Test"
  );
  res.json({ success: true });
});

router.delete("/reset", (_, res) => {
  db.exec(`
    DELETE FROM delivery_log;
    DELETE FROM blocked_contacts;
    DELETE FROM reminder_queue;
  `);
  res.json({ success: true });
});

router.post("/run-all", (_, res) => {
  const appointments =
    db.prepare(`
      SELECT
        appointment_id,
        resident_id
      FROM appointments
      ORDER BY scheduled_at ASC
    `).all() as any[];

  let seconds = 0;
  for (const appt of appointments) {
    queueService.addJob(
      appt.resident_id,
      appt.appointment_id,
      new Date(Date.now() + seconds * 1000)
    );
    seconds += 0.05;
  }

  res.json({
    success: true,
    queued: appointments.length
  });
});

export default router;