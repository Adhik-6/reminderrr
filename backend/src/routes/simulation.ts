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

export default router;