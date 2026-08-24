import { PolicyDecision, PolicyRule, ReminderContext } from "../types";

export class ChannelSelectionRule implements PolicyRule {

  execute(
    context: ReminderContext,
    decision: PolicyDecision
  ): PolicyDecision {

    const r = context.resident;

    const candidates: ("sms" | "voice" | "email")[] = [];

    const preferred = (r.preferred_channel || "sms").toLowerCase();

    const available = {
      sms: !!r.mobile,
      voice: !!(r.landline || r.mobile),
      email: !!r.email
    };

    const pushIfAvailable = (channel: "sms" | "voice" | "email") => {
      if (available[channel] && !candidates.includes(channel)) {
        candidates.push(channel);
      }
    };

    switch (preferred) {

      case "voice":
        pushIfAvailable("voice");
        pushIfAvailable("sms");
        pushIfAvailable("email");
        break;

      case "email":
        pushIfAvailable("email");
        pushIfAvailable("sms");
        pushIfAvailable("voice");
        break;

      default:
        pushIfAvailable("sms");
        pushIfAvailable("voice");
        pushIfAvailable("email");
    }

    if (candidates.length === 0) {
      return {
        ...decision,
        allowed: false,
        reason: "No usable contact method."
      };
    }

    decision.channelCandidates = candidates;
    decision.channel = candidates[0];

    return decision;
  }

}