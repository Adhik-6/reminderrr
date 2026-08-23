import { PolicyDecision, PolicyRule, ReminderContext } from "../types";

export class QuietHoursRule implements PolicyRule {
  execute(
    context: ReminderContext,
    decision: PolicyDecision
  ): PolicyDecision {

    const hour = context.now.getHours();

    if (hour >= 21 || hour < 8) {
      return {
        ...decision,
        allowed: false,
        reason: "Reminder blocked during quiet hours."
      };
    }

    return decision;
  }
}