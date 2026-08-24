import { Provider, ReminderPayload } from "./types";
import { runPythonProvider } from "./PythonProviderRunner";

export class VoiceProvider implements Provider {
  send(payload: ReminderPayload) {
    return runPythonProvider("voice", payload);
  }
}