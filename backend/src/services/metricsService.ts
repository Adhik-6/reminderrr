import Database from "better-sqlite3";

export interface MetricsSummary {
  workload: {
    appointments: number;
  };
  delivery: {
    attempts: number;
    successful: number;
    failed: number;
    voicemail: number;
    successRate: number;
    coverageRate: number;
    remindersNotDelivered: number;
  };
  channels: Array<{
    channel: string;
    attempts: number;
    delivered: number;
    answered: number;
    voicemail: number;
    failed: number;
  }>;
  compliance: {
    blocked: number;
    residentsBlocked: number;
  };
  retries: {
    retryJobs: number;
    avgAttempts: number;
    maxAttempts: number;
  };
  dataQuality: {
    missingMobile: number;
    missingEmail: number;
  };
}

export class MetricsService {
  constructor(private db: Database.Database) {}

  getSummary(): MetricsSummary {
    const totalAppointments = this.db
      .prepare(`SELECT COUNT(*) as c FROM appointments`)
      .get() as { c: number };

    const delivery = this.db
      .prepare(`
        SELECT
          COUNT(*) as totalAttempts,
          COALESCE(SUM(CASE WHEN status IN ('delivered','answered') THEN 1 ELSE 0 END), 0) as successful,
          COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END), 0) as failed,
          COALESCE(SUM(CASE WHEN detail='voicemail_left' THEN 1 ELSE 0 END), 0) as voicemail
        FROM delivery_log
      `)
      .get() as {
        totalAttempts: number;
        successful: number;
        failed: number;
        voicemail: number;
      };

    const channels = this.db
      .prepare(`
        SELECT
          channel,
          COUNT(*) as attempts,
          COALESCE(SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END), 0) as delivered,
          COALESCE(SUM(CASE WHEN status='answered' THEN 1 ELSE 0 END), 0) as answered,
          COALESCE(SUM(CASE WHEN detail='voicemail_left' THEN 1 ELSE 0 END), 0) as voicemail,
          COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END), 0) as failed
        FROM delivery_log
        GROUP BY channel
      `).all() as Array<{
                    channel: string;
                    attempts: number;
                    delivered: number;
                    answered: number;
                    voicemail: number;
                    failed: number;
                }>;

    const compliance = this.db
      .prepare(`
        SELECT
          COUNT(*) as blocked,
          COUNT(DISTINCT resident_id) as residentsBlocked
        FROM blocked_contacts
      `)
      .get() as { blocked: number; residentsBlocked: number };

    const retries = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN attempt > 1 THEN 1 ELSE 0 END), 0) as retryJobs,
          COALESCE(ROUND(AVG(attempt), 2), 0) as avgAttempts,
          COALESCE(MAX(attempt), 0) as maxAttempts
        FROM reminder_queue
      `)
      .get() as { retryJobs: number; avgAttempts: number; maxAttempts: number };

    const dataQuality = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN mobile IS NULL OR mobile='' THEN 1 ELSE 0 END), 0) as missingMobile,
          COALESCE(SUM(CASE WHEN email IS NULL OR email='' THEN 1 ELSE 0 END), 0) as missingEmail
        FROM contacts
      `)
      .get() as { missingMobile: number; missingEmail: number };

    const totalAttempts = delivery.totalAttempts || 0;
    const appointmentsCount = totalAppointments.c || 0;

    return {
      workload: {
        appointments: appointmentsCount
      },
      delivery: {
        attempts: totalAttempts,
        successful: delivery.successful,
        failed: delivery.failed,
        voicemail: delivery.voicemail,
        successRate: totalAttempts
          ? Number(((delivery.successful / totalAttempts) * 100).toFixed(1))
          : 0,
        coverageRate: appointmentsCount
          ? Number(((delivery.successful / appointmentsCount) * 100).toFixed(1))
          : 0,
        remindersNotDelivered: appointmentsCount - delivery.successful
      },
      channels,
      compliance,
      retries,
      dataQuality
    };
  }
}