import { Provider, ReminderPayload } from "./types";
import { runPythonProvider } from "./PythonProviderRunner";

export class SMSProvider implements Provider {
  send(payload: ReminderPayload) {
    return runPythonProvider("sms", payload);
  }
}