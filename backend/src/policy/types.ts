export interface Resident {
  resident_id: string;
  name: string;
  mobile: string | null;
  landline: string | null;
  email: string | null;

  preferred_channel: string;
  language: string;

  sms_optout: string;
  voice_optout: string;
  email_optout: string;
}

export interface Appointment {
  appointment_id: string;
  scheduled_at: string;
  location: string;
  service_type: string;
  status: string;
}

export interface ReminderContext {
  resident: Resident;
  appointment: Appointment;
  now: Date;
}

export interface PolicyDecision {
  allowed: boolean;
  channel?: "sms" | "voice" | "email";
  language?: string;
  template?: string;
  reason?: string;
}

export interface PolicyRule {
  execute(
    context: ReminderContext,
    decision: PolicyDecision
  ): PolicyDecision;
}