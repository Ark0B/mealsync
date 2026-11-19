# ADR-0005: Server-issued rotating HMAC pass for counter verification

- Status: Accepted · Deciders: Arkodyuti, Sania (UX), counter-staff interview pending

## Context
We need to verify a student in about 2 seconds at a busy counter, without cards, RFID hardware or biometric data.

## Options
| Option | Problem |
|---|---|
| Static QR on an ID card | Photocopy / screenshot / lend works forever |
| Roll number typed by staff | Slow; anyone can say a roll number |
| RFID / NFC cards | Hardware cost; cards still lendable |
| Face recognition | Privacy, consent, cost, accuracy; overkill |
| **Rotating signed QR (TOTP-like)** | Needs a phone with network, which we mitigate |

## Decision
The server issues `MS1.<userId>.<step>.<HMAC>` with 30-second steps. The scanner accepts the current and previous step. Serving is recorded under a UNIQUE (user, date, meal) key. Every refused attempt is logged with its reason.

## Consequences
+ A screenshot is useless after at most 60 s, and a lent phone still only gets one plate.
+ Fraud becomes measurable (fraud-signals report).
− A student without a working phone cannot be served automatically. Fallbacks: manual code, and B-06 "staff lookup by roll number with photo" in v1.1.
− The pass endpoint is called every 30 s per open app. Trivial load (one HMAC, no DB write).
