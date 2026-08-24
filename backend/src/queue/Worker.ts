import { QueueService } from "./QueueService";
import { PolicyEngine } from "../policy/PolicyEngine";
import { DeliveryLogger } from "../services/DeliveryLogger";
import { ReminderService } from "../services/reminderService";
import { db } from "../db/database";

const queueService = new QueueService(db);
const reminderService = new ReminderService(
  db,
  new PolicyEngine(),
  new DeliveryLogger(db)
);

const CHANNELS = ["sms", "voice", "email"] as const;

let isProcessing = false;

console.log("Worker started.");

function retryDelay(detail: string) {

  switch (detail) {
    case "busy":
      return 10;
    case "no_answer":
      return 15;
    case "carrier_rejected":
      return 30;
    case "soft_bounce":
      return 60;
    default:
      return null;
  }

}

async function processJobs() {

  if (isProcessing) return;
  isProcessing = true;

  try {
    const jobs = queueService.claimDueJobs();

    if (jobs.length) console.log(`Found ${jobs.length} due job(s).`);
    for (const job of jobs) {
      const channel = CHANNELS[job.fallback_index] ?? "sms";
      console.log(`Job #${job.job_id} -> ${channel}`);

      try {
        const result =
          await reminderService.sendReminder({
            residentId: job.resident_id,
            appointmentId: job.appointment_id,
            attempt: job.attempt,
            forceChannel: channel
          });
          
        // Policy blocked the reminder before reaching a provider.
        if (!result.decision.allowed) {
          if (result.decision.reason === "Reminder blocked during quiet hours.") {
            const nextHour = new Date();
            nextHour.setHours(nextHour.getHours() + 1);
            queueService.rescheduleJob(
              job.job_id,
              nextHour,
              job.attempt,
              job.fallback_index,
              channel,
              "quiet_hours"
            );
            console.log("🌙 Quiet hours – postponed for one hour.");
          } else {
            // Regulatory block or another permanent policy block.
            queueService.markCompleted(job.job_id);
            console.log(`🚫 ${result.decision.reason}`);
          }
          continue;
        }
        const status = result.providerResult?.status;
        const detail = result.providerResult?.detail || "";

        // SUCCESS
        if (
          status === "delivered" ||
          status === "answered" ||
          detail === "voicemail_left"
        ) {
          queueService.markCompleted(job.job_id);
          console.log(`✓ Completed via ${channel}`);
          continue;
        }

        // RETRY
        const delay = retryDelay(detail);
        if (delay && job.attempt < 3) {
          queueService.rescheduleJob(
            job.job_id,
            new Date(Date.now() + delay * 60 * 1000),
            job.attempt + 1,
            job.fallback_index,
            channel,
            detail
          );
          console.log(`↺ Retry ${channel} in ${delay} min`);
          continue;
        }

        // FALLBACK
        const nextIndex = job.fallback_index + 1;
        if (nextIndex < CHANNELS.length) {
          queueService.rescheduleJob(
            job.job_id,
            new Date(),
            job.attempt,
            nextIndex,
            CHANNELS[nextIndex],
            detail
          );
          console.log(`➡ Falling back to ${CHANNELS[nextIndex]}`);
        } else {
          queueService.markFailed(
            job.job_id,
            detail
          );
          console.log(`✗ Permanent failure`);
        }
      } catch (err) {
        console.error(err);
        queueService.markFailed(job.job_id, "worker_error" );
      }
    }
  } finally {
    isProcessing = false;
  }
}

setInterval(processJobs, 1000);