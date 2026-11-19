# ADR-0004: Server-side payment verification through a gateway adapter

- Status: Accepted · Deciders: Arkodyuti, Tarun

## Context
Today students prove payment by showing a screenshot. That is the single easiest fraud. A real gateway (Razorpay, PayU, Cashfree) needs a merchant account with business KYC, which only the university can open.

## Decision
Use the standard **order → checkout → signature** flow:
1. The server creates an order for an amount *it* computed.
2. The gateway collects the money and returns `paymentId` + `signature`.
3. The server checks `signature == HMAC_SHA256(orderId + "|" + paymentId, keySecret)` in constant time. Only then is anything activated, in the same transaction as marking the payment paid.

This is exactly Razorpay's documented verification scheme. In development (`PAYMENT_MODE=mock`), `POST /api/payments/mock-checkout/:orderId` plays the gateway and produces a correctly signed result. Going live means: create real orders through the gateway SDK in `createOrder`, open Razorpay Checkout in the browser instead of calling mock-checkout, set `PAYMENT_SECRET` to the key secret, and set `PAYMENT_MODE=razorpay` (which disables the mock route). Adding a webhook for payments where the browser closes mid-flow is backlog item B-03.

## Consequences
+ Screenshot payments are impossible, and the demo works with no merchant account.
+ Verification is idempotent (safe to retry).
− The mock route must never be enabled in production. Guarded by `PAYMENT_MODE`; covered in the release checklist.
