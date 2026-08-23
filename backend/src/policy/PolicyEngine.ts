import { ReminderContext, PolicyDecision, PolicyRule } from "./types";

import { PreferredChannelRule } from "./rules/preferredChannel";
import { OptOutRule } from "./rules/optOut";
import { QuietHoursRule } from "./rules/quietHours";
import { LanguageRule } from "./rules/language";

export class PolicyEngine {

  private rules: PolicyRule[];

  constructor() {
    this.rules = [
      new PreferredChannelRule(),
      new OptOutRule(),
      new QuietHoursRule(),
      new LanguageRule()
    ];
  }

  evaluate(context: ReminderContext): PolicyDecision {

    let decision: PolicyDecision = {
      allowed: true
    };

    for (const rule of this.rules) {

      decision = rule.execute(context, decision);

      if (!decision.allowed) {
        break;
      }
    }

    return decision;
  }
}