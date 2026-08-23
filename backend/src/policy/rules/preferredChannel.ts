import { PolicyDecision, PolicyRule, ReminderContext } from "./../types";

export class PreferredChannelRule implements PolicyRule {
  execute(
    context: ReminderContext,
    decision: PolicyDecision
  ): PolicyDecision {

    const preferred = context.resident.preferred_channel?.toLowerCase();

    if (preferred === "voice") decision.channel = "voice";
    else if (preferred === "email") decision.channel = "email";
    else decision.channel = "sms";

    return decision;
  }
}