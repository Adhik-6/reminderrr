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

export class ReminderService {

  constructor(
    private db: Database.Database,
    private policyEngine: PolicyEngine,
    private deliveryLogger: DeliveryLogger
  ) {}

  async sendReminder(options: SendReminderOptions) {

    const now = options.now ?? new Date();
    const attempt = options.attempt ?? 1;

    const resident = this.db.prepare(
      `SELECT * FROM contacts WHERE resident_id=?`
    ).get(options.residentId) as any;

    const appointment = this.db.prepare(
      `SELECT * FROM appointments WHERE appointment_id=?`
    ).get(options.appointmentId) as any;

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

    const channel =
    options.forceChannel ?? decision.channel!;

    const provider = ProviderFactory.get(channel);

    const recipient = 
        channel === "email"
            ? resident.email
            : channel === "voice"
                ? resident.landline || resident.mobile
                : resident.mobile;

    const body =
      `Reminder: Your ${appointment.service_type} appointment ` +
      `is scheduled for ${appointment.scheduled_at}.`;

    const providerResult = await provider.send({
      recipient,
      body,
      at: now,
      attempt
    });

    this.deliveryLogger.log({
      residentId: resident.resident_id,
      appointmentId: appointment.appointment_id,
      channel: decision.channel,
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