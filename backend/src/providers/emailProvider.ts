import { Provider, ReminderPayload } from "./types";
import { runPythonProvider } from "./PythonProviderRunner";

export class EmailProvider implements Provider {
  send(payload: ReminderPayload) {
    return runPythonProvider("email", payload);
  }
}