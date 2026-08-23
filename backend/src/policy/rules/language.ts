import { PolicyDecision, PolicyRule, ReminderContext } from "../types";

export class LanguageRule implements PolicyRule {
  execute(
    context: ReminderContext,
    decision: PolicyDecision
  ): PolicyDecision {

    decision.language = context.resident.language;
    decision.template = "appointment_reminder";

    return decision;
  }
}