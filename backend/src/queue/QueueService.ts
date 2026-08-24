import Database from "better-sqlite3";

export interface QueueJob {
  job_id: number;
  resident_id: string;
  appointment_id: string;
  scheduled_for: string;
  status: string;
  attempt: number;
}

export class QueueService {

  constructor(private db: Database.Database) {}

  addJob(
    residentId: string,
    appointmentId: string,
    scheduledFor: Date
  ) {

    const stmt = this.db.prepare(`
      INSERT INTO reminder_queue
      (resident_id, appointment_id, scheduled_for)
      VALUES (?, ?, ?)
    `);

    console.log("Adding job:", {
        residentId,
        appointmentId,
        scheduledFor: scheduledFor.toISOString()
    });

    return stmt.run(
      residentId,
      appointmentId,
      scheduledFor.toISOString()
    );
  }

    claimDueJobs(limit = 20): QueueJob[] {

    const claimTransaction = this.db.transaction((limit: number) => {

        const jobs = this.db.prepare(`
        SELECT *
        FROM reminder_queue
        WHERE status = 'pending'
        AND scheduled_for <= ?
        ORDER BY scheduled_for
        LIMIT ?
        `).all(
        new Date().toISOString(),
        limit
        ) as QueueJob[];

        if (jobs.length === 0) {
        return jobs;
        }

        const markStmt = this.db.prepare(`
        UPDATE reminder_queue
        SET status = 'processing'
        WHERE job_id = ?
        `);

        for (const job of jobs) {
        markStmt.run(job.job_id);
        }

        return jobs;
    });

    return claimTransaction(limit);
    }

  markCompleted(jobId: number) {

    this.db.prepare(`
      UPDATE reminder_queue
      SET
        status='completed',
        processed_at=CURRENT_TIMESTAMP
      WHERE job_id=?
    `).run(jobId);

  }

  markFailed(jobId: number) {

    this.db.prepare(`
      UPDATE reminder_queue
      SET
        status='failed',
        processed_at=CURRENT_TIMESTAMP
      WHERE job_id=?
    `).run(jobId);

  }

}