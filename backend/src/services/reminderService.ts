import Database from "better-sqlite3";
import { PolicyEngine } from "../policy/PolicyEngine";
import { ReminderContext } from "../policy/types";
import { ProviderFactory } from "../providers/providerFactory";
import { DeliveryLogger } from "./DeliveryLogger";

interface SendReminderOptions {
  residentId: string;
  appointmentId: string;
  now?: Date;
  attempt?: number;
  forceChannel?: "sms" | "voice" | "email";
}

function buildReminderMessage(
  serviceType: string,
  scheduledAt: string,
  location: string,
  language: string = "en"
): string {
  const prefix = language === "en" ? "Reminder" : `Reminder (in ${language})`;
  return `${prefix}: Your ${serviceType} appointment is scheduled for ${scheduledAt} at ${location}.`;
}

export class ReminderService {
  constructor(
    private db: Database.Database,
    private policyEngine: PolicyEngine,
    private deliveryLogger: DeliveryLogger
  ) {}

  async sendReminder(options: SendReminderOptions) {
    const now = options.now ?? new Date();
    const attempt = options.attempt ?? 1;

    const resident = this.db
      .prepare(`SELECT * FROM contacts WHERE resident_id=?`)
      .get(options.residentId) as any;

    const appointment = this.db
      .prepare(`SELECT * FROM appointments WHERE appointment_id=?`)
      .get(options.appointmentId) as any;

    if (!resident || !appointment) {
      throw new Error("Resident or appointment not found.");
    }

    const context: ReminderContext = {
      resident,
      appointment,
      now
    };

    const decision = this.policyEngine.evaluate(context);

    if (!decision.allowed || !decision.channel) {
      return {
        decision,
        providerResult: null
      };
    }

    const channel = options.forceChannel ?? decision.channel;

    const provider = ProviderFactory.get(channel);

    // 1. Ensure recipient is typed as a defined string
    const recipient: string =
      (channel === "email"
        ? resident.email
        : channel === "voice"
        ? resident.landline || resident.mobile
        : resident.mobile) ?? "";

    if (!recipient) {
      throw new Error(`No valid contact endpoint found for channel: ${channel}`);
    }

    // 2. Fallback for optional decision.language
    const body = buildReminderMessage(
      appointment.service_type ?? "",
      appointment.scheduled_at ?? "",
      appointment.location ?? "",
      decision.language ?? "en"
    );

    const providerResult = await provider.send({
      recipient,
      body,
      at: now,
      attempt
    });

    // 3. Pass non-null 'channel' variable instead of 'decision.channel'
    this.deliveryLogger.log({
      residentId: resident.resident_id,
      appointmentId: appointment.appointment_id,
      channel: channel,
      status: providerResult.status,
      detail: providerResult.detail,
      attemptedAt: now,
      bodyPreview: body
    });

    return {
      decision,
      providerResult,
      channel
    };
  }
}