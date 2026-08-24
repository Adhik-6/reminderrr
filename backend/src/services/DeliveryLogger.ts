import Database from "better-sqlite3";

interface DeliveryLogEntry {
  residentId: string;
  appointmentId: string;
  channel: "sms" | "voice" | "email";
  status: string;
  detail?: string;
  attemptedAt: Date;
  bodyPreview: string;
}

export class DeliveryLogger {

  constructor(private db: Database.Database) {}

  log(entry: DeliveryLogEntry) {

    const stmt = this.db.prepare(`
      INSERT INTO delivery_log (
        resident_id,
        appointment_id,
        channel,
        status,
        detail,
        attempted_at,
        body_preview
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.residentId,
      entry.appointmentId,
      entry.channel,
      entry.status,
      entry.detail ?? "",
      entry.attemptedAt.toISOString(),
      entry.bodyPreview.slice(0, 60)
    );
  }

}