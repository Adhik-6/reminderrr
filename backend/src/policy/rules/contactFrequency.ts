import Database from "better-sqlite3";
import { PolicyDecision, PolicyRule, ReminderContext } from "../types";

export class ContactFrequencyRule implements PolicyRule {

  constructor(private db: Database.Database) {}

  execute(
    context: ReminderContext,
    decision: PolicyDecision
  ): PolicyDecision {

    const sevenDaysAgo = new Date(
      context.now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM delivery_log
      WHERE resident_id = ?
      AND attempted_at >= ?
    `).get(
      context.resident.resident_id,
      sevenDaysAgo
    ) as any;

    if (row.count >= 2) {

      this.db.prepare(`
        INSERT INTO blocked_contacts
        (
          resident_id,
          appointment_id,
          reason,
          contacts_last_7_days
        )
        VALUES (?, ?, ?, ?)
      `).run(
        context.resident.resident_id,
        context.appointment.appointment_id,
        "Regulator limit: two contacts in rolling seven days.",
        row.count
      );

      return {
        ...decision,
        allowed: false,
        reason: "Regulator limit reached."
      };

    }
    return decision;
  }
}