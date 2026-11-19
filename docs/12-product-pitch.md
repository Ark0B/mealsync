# 12 · Product pitch outline (10 minutes)

1. **The card** (1 min). Hold up a real handwritten mess card. "This is how 600 students prove they paid for food."
2. **What it costs** (1.5 min). Fraud (borrowed cards, screenshot payments, second plates), wasted money on missed meals, wasted food, late students without food. Use the **real numbers from the survey** (`01-discovery/findings.md`).
3. **MealSync in one sentence** (0.5 min). Every plate, payment and subscription verified, and students get credit for meals they skip.
4. **Live demo** (4 min):
   - student subscribes and pays → pass on the phone;
   - staff scans → SERVE (VEG ONLY) → scans again → refused, already served;
   - a 2-minute-old screenshot → refused;
   - student skips tomorrow's lunch → credit → manager's headcount drops by one;
   - complaint → escalated → committee resolves; poll → one vote each;
   - manager downloads the CSV and opens it in Excel; fraud-signals report.
5. **How we engineered it** (2 min). Incremental + Scrum, SRS → traceability → 128 tests at 95 % coverage, CI on MySQL, ADRs, three change requests (two accepted, one deferred, with reasons).
6. **Beyond our campus** (0.5 min). One deployment per institution; plans, prices and rules are data; Razorpay-compatible payment verification.
7. **Ask** (0.5 min). A pilot with one mess counter for two weeks.

Demo prep: seed the database the night before; open the student pass and the scanner side by side; have a screenshot of an old pass ready.
