import { Provider } from "./types";

import { SMSProvider } from "./smsProvider";
import { VoiceProvider } from "./voiceProvider";
import { EmailProvider } from "./emailProvider";

export class ProviderFactory {

  static get(channel: "sms" | "voice" | "email"): Provider {

    switch (channel) {

      case "sms":
        return new SMSProvider();

      case "voice":
        return new VoiceProvider();

      case "email":
        return new EmailProvider();

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }

  }

}