import Database from "better-sqlite3";

export interface QueueJob {
  job_id: number;
  resident_id: string;
  appointment_id: string;
  scheduled_for: string;
  status: string;
  attempt: number;

  current_channel?: string;
  fallback_index: number;
  next_attempt_at?: string;
  last_error?: string;
}

export class QueueService {

  constructor(private db: Database.Database) {}

    addJob(
        residentId: string,
        appointmentId: string,
        scheduledFor: Date
    ) {
        const stmt = this.db.prepare(`
        INSERT INTO reminder_queue (
            resident_id,
            appointment_id,
            scheduled_for,
            next_attempt_at,
            current_channel,
            fallback_index )
        VALUES (?, ?, ?, ?, 'sms', 0)
        `);

        return stmt.run(
        residentId,
        appointmentId,
        scheduledFor.toISOString(),
        scheduledFor.toISOString()
        );
    }

    claimDueJobs(limit = 20): QueueJob[] {
        const tx = this.db.transaction((limit: number) => {

            const jobs = this.db.prepare(`
            SELECT *
            FROM reminder_queue
            WHERE status='pending'
            AND COALESCE(next_attempt_at, scheduled_for) <= ?
            ORDER BY COALESCE(next_attempt_at, scheduled_for)
            LIMIT ?
            `).all(
            new Date().toISOString(),
            limit
            ) as QueueJob[];

            const stmt = this.db.prepare(`
            UPDATE reminder_queue
            SET status='processing'
            WHERE job_id=?
            `);

            jobs.forEach(j => stmt.run(j.job_id));

            return jobs;

        });

        return tx(limit);
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

    markFailed(jobId: number, error: string) {
    this.db.prepare(`
        UPDATE reminder_queue
        SET
        status='failed',
        last_error=?,
        processed_at=CURRENT_TIMESTAMP
        WHERE job_id=?
    `).run(error, jobId);
    }

    rescheduleJob(
        jobId: number,
        nextAttempt: Date,
        attempt: number,
        fallbackIndex: number,
        channel: string,
        error: string
    ) {
        this.db.prepare(`
            UPDATE reminder_queue
            SET
            status='pending',
            attempt=?,
            fallback_index=?,
            current_channel=?,
            next_attempt_at=?,
            last_error=?
            WHERE job_id=?
        `).run(
            attempt,
            fallbackIndex,
            channel,
            nextAttempt.toISOString(),
            error,
            jobId
        );
    }
}