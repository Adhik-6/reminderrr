#!/usr/bin/env python3

import json
import sys
from datetime import datetime

from channels import send_sms, send_voice, send_email


def main():
    if len(sys.argv) != 6:
        print(json.dumps({
            "status": "failed",
            "detail": "invalid_arguments"
        }))
        sys.exit(1)

    channel = sys.argv[1]
    recipient = sys.argv[2]
    body = sys.argv[3]
    at_str = sys.argv[4]
    attempt = int(sys.argv[5])

    at = datetime.fromisoformat(at_str)

    if channel == "sms":
        result = send_sms(recipient, body, at, attempt)
    elif channel == "voice":
        result = send_voice(recipient, body, at, attempt)
    elif channel == "email":
        result = send_email(recipient, body, at, attempt)
    else:
        result = {
            "status": "failed",
            "detail": "unknown_channel"
        }

    print(json.dumps(result))


if __name__ == "__main__":
    main()