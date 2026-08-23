import { PolicyDecision, PolicyRule, ReminderContext } from "../types";

export class OptOutRule implements PolicyRule {
  execute(
    context: ReminderContext,
    decision: PolicyDecision
  ): PolicyDecision {

    if (!decision.channel) return decision;

    const r = context.resident;

    if (decision.channel === "sms" && r.sms_optout === "Y") {
      return {
        ...decision,
        allowed: false,
        reason: "Resident has opted out of SMS."
      };
    }

    if (decision.channel === "voice" && r.voice_optout === "Y") {
      return {
        ...decision,
        allowed: false,
        reason: "Resident has opted out of voice calls."
      };
    }

    if (decision.channel === "email" && r.email_optout === "Y") {
      return {
        ...decision,
        allowed: false,
        reason: "Resident has opted out of email."
      };
    }

    return decision;
  }
}