export interface ReminderPayload {
  recipient: string;
  body: string;
  at: Date;
  attempt: number;
}

export interface SendResult {
  status: string;
  detail?: string;
}

export interface Provider {
  send(payload: ReminderPayload): Promise<SendResult>;
}