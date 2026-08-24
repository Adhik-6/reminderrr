import { QueueService } from "./QueueService";
import { PolicyEngine } from "../policy/PolicyEngine";
import { DeliveryLogger } from "../services/DeliveryLogger";
import { ReminderService } from "../services/reminderService";
import { db } from "../db/database";

const queueService = new QueueService(db);

const policyEngine = new PolicyEngine();

const deliveryLogger = new DeliveryLogger(db);

const reminderService = new ReminderService(
  db,
  policyEngine,
  deliveryLogger
);

let isProcessing = false;

async function processJobs() {

  if (isProcessing) return;

  isProcessing = true;

  try {

    const jobs = queueService.claimDueJobs();

    if (jobs.length > 0) {
      console.log(`Found ${jobs.length} due job(s).`);
    }

    for (const job of jobs) {

      console.log(`Processing Job #${job.job_id}`);

      try {

        const result = await reminderService.sendReminder({
          residentId: job.resident_id,
          appointmentId: job.appointment_id,
          attempt: job.attempt
        });

        queueService.markCompleted(job.job_id);

        console.log(
          `✓ Job #${job.job_id} completed (${result.providerResult?.status ?? "blocked"})`
        );

      } catch (err) {

        console.error(`✗ Job #${job.job_id} failed`, err);

        queueService.markFailed(job.job_id);

      }

    }

  } finally {

    isProcessing = false;

  }

}

console.log("Worker started.");
setInterval(processJobs, 1000);