# Sprint Backlog

Priority order. Do not start an item until all higher items are done or explicitly skipped.

---

## P0 — Blockers (fix before anything else)
- [ ] Verify Budget page shows Hebrew category names (not raw IDs like "food") — needs browser check
- [ ] Verify Assets, Loans, Goals pages have no fake data / broken flows — needs audit pass

---

## P1 — Core Quality
- [ ] Income type (Stage 1): add income sub-type picker using `sub_category` field (zero DB change)
  - See `docs/INCOMES_MODEL.md` Stage 1
- [ ] Audit + fix: BudgetPage, AssetsPage, LoansPage, GoalsPage (one pass per module)
- [ ] Add panel RTL fix: change `left-0` panels to `right-0` in TransactionsPage + IncomesPage
- [ ] Settings persistence: wire notifications/appearance sections to DB

---

## P2 — Attribution Expansion
- [ ] Income attribution (Stage 2): add `attributed_to_type` to income rows (couple/family)
  - See `docs/INCOMES_MODEL.md` Stage 2
- [ ] Payment source received-into semantics (Stage 3): filter to bank/cash for income form
- [ ] Payment source owner_member_id: add to payment_sources table + Settings UI

---

## P3 — Analytics Improvements
- [ ] Income analytics section in ExpenseAnalysisPage or new IncomeAnalysisPage
- [ ] Dashboard health score: confirm sub-score formulas for budget adherence + emergency fund + net worth trend
- [ ] Budget page improvements: over-budget visual alerts, monthly carry-forward

---

## P4 — Polish and Scale
- [ ] Voice input: real implementation (when explicitly requested)
- [ ] Calculators page: real financial calculators (mortgage, loan, savings)
- [ ] Guides page: real Hebrew financial guides content
- [ ] Goals page: savings progress, contributions
- [ ] Loans page: payment schedule, payoff date calculation

---

## Deferred / Not In Scope
- Split ratios for attribution (50/50 or custom) — deferred
- Expected income tracking — deferred (Stage 4)
- CSV import — not planned
- Push notifications — not planned
- Multi-currency — not planned
