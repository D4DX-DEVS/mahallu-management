# Accounting behaviour that needs a decision

Status: **behaviour is unchanged on purpose.** Each item below describes what the code does today
(traced from the source, not assumed), what the concern is, and which decision is needed and who owns it.
Nothing here was changed by the deployment-security work. No accounting policy was invented.

## 1. Petty cash: float and replenishment postings

### What the code does today

`controllers/pettyCashController.ts`, `services/ledgerPostingService.ts`.

| Event | Petty-cash record | Ledger entry (via `postLedgerEntry`) | Bank account balance |
|---|---|---|---|
| Fund created with float F | `PettyCash.currentBalance = F`, a `float` transaction | **Expense** F in ledger "Petty Cash" (source `petty_cash`, sourceId = fund) | first active institute account `-F` |
| Expense E recorded | `currentBalance -= E`, an `expense` transaction (`postedToLedger=false`) | **none yet** | unchanged |
| Replenish (spent S = float - balance) | `currentBalance` reset to F, a `replenishment` transaction of S | each unposted expense posted as an **expense** E in ledger "Petty Cash Expenses" (source `petty_cash`, sourceId = expense) | first active institute account `-E` for each expense (total `-S`) |
| Replenishment transaction itself | recorded | **no ledger entry** for the replenishment | no movement of its own |

### Is the audit concern real?

Partly, and it depends on what the float is meant to be:

- **Cash movement: consistent.** The bank is reduced by F when the float is withdrawn and by S when the box is
  topped up, which is what happens in reality.
- **Income-and-expenditure (P&L): overstated.** The float is booked as an *expense* when the fund is created. The same
  rupees are booked as expenses *again* when they are spent (at replenishment). A fund with float F that has spent S
  shows expenses of F + S, although only S was ever spent; F is cash moved into the petty-cash box (a transfer to cash
  in hand), not a cost. The float stays counted as an expense permanently, and also if the fund is later closed with
  cash left over (there is no closing or return-of-float flow at all).
- **Timing:** expenses reach the ledger only at replenishment, so between replenishments the books show the float as
  spent but none of the real expenses.
- A failed expense posting at replenishment is retried at the next replenishment (the response carries `ledgerPending`).

### Decision required (accountant / product owner)

1. Is the float an **expense** (current behaviour), or a **transfer to cash in hand** (an asset that is later expensed
   as it is spent)?
2. Are petty-cash expenses recognised **when spent** or **when replenished** (current behaviour)?
3. What happens to the float when a fund is **closed** (return the balance to the bank, or write it off)?
4. Do existing ledger entries need correcting, and from which date?

Where the change goes: `createPettyCash` (float posting), `recordExpense` (posting at spend time),
`replenishPettyCash` (posting and the replenishment transaction), plus a close-fund flow and a data correction
for already-posted entries. `reverseLedgerEntry` already supports source `petty_cash`.

## 2. Manual ledger items do not move account balances

`controllers/masterAccountController.ts` `createLedgerItem` saves a `LedgerItem` with `source = 'manual'` and nothing
else. Only `postLedgerEntry` (used by collections, salary, petty cash, welfare, zakat distribution) increments or
decrements an `InstituteAccount` / `MahalluAccount` balance. So a hand-entered income or expense appears in the day
book and reports but the bank balance does not change, and the day-book total no longer reconciles to the account
balances once manual entries exist. Editing or deleting a manual item likewise never touches a balance.

### Decision required

Should a manual ledger item (a) stay a bookkeeping-only note, (b) move a chosen account's balance (then it needs an
`accountId` on the form, validation that the account belongs to the same institute / Mahallu, and reversal on edit and
delete), or (c) be split into two entry kinds ("memo" and "bank transaction")?

Where the decision belongs: product/accounting owner; code in `createLedgerItem`, `updateLedgerItem`,
`deleteLedgerItem` and the CMS ledger-item form.

## 3. Postings hit the "first active account"

`ledgerPostingService.resolveAccount`: for an institute posting it takes the **oldest active `InstituteAccount`** of
that institute (`status: 'active'`, sorted by `createdAt`); for a Mahallu-level posting the oldest active
`MahalluAccount`. The `paymentMethod` carried on the entry (cash, bank, upi, cheque) is stored but **not used** to pick
the account, so an institute that has a bank account and a cash account sees every posting, cash or not, land on
whichever account was created first. The chosen account is pinned on the item (`accountId`, `accountType`), so a
reversal returns the money to the same account; items created before this was added fall back to the lookup above.
If no active account exists the entry is posted without moving any balance.

### Decision required

How should the account be chosen: by payment method (a mapping such as cash -> the cash account), by an explicit
account on each transaction (collections, salary, welfare forms would need an account picker), or a configured default
account per institute / Mahallu? What should happen when no account matches (refuse, or post without a balance move
as today)?

Where the decision belongs: product/accounting owner; code in `resolveAccount` and the callers of `postLedgerEntry`.

## 4. Other open items found by the final audit (behaviour unchanged unless stated)

These are decisions or small gaps, not implementation bugs. None was changed.

1. **Petty cash: no duplicate protection.** Creating a fund and recording an expense have no idempotency
   key, so a double click records two (two floats would post two ledger entries). Qard repayments already
   use an optional `clientRequestId` with a unique partial index; the same pattern would fit, but it needs
   a field on `PettyCash` / `PettyCashTransaction` and an entry in the index preflight. Decide whether to
   add it.
2. **Petty cash float posting failure.** If the ledger entry for the float cannot be posted at fund
   creation, the request answers 201 with `ledgerPending: 1`, records one reconciliation issue and keeps the
   fund; nothing retries the float entry. Decide whether the create should instead fail and remove the
   fund, or keep the warning behaviour.
3. **Opening balances.** Bank accounts (institute and Mahallu) and master wallets accept an opening
   `balance` on create only. It is not posted to the ledger and not audited. Decide whether an opening
   balance should post an opening-balance ledger entry.
4. **Dashboard bank balance.** `GET /dashboard/financial-summary` sums the balances of active INSTITUTE
   accounts only, while Mahallu-level collections post to Mahallu accounts and the balance sheet includes
   them; it also classifies this month's entries by the ledger's type (accounting reports use the entry's
   own type). Decide whether the dashboard "available balance" should include Mahallu accounts.
5. **Collections "Total Amount".** The list and overview totals include pending member submissions
   (`totalAmount`); `verifiedAmount` and `pendingAmount` are returned beside it. Decide whether the card
   should show verified money only.
6. **Zakat summary versus annual report.** The zakat summary counts only verified payments as collected; the
   annual report's zakat "collected" includes pending. Decide which meaning the annual report should use.
7. **Qard, relief, scholarships and marriage assistance** track amounts but never post to the ledger or
   move a bank balance (welfare posts only when disbursed "via ledger"; zakat distribution only when
   `postToLedger` is set). Decide which of these are cash movements that belong in the books.
8. **A defaulted qard loan with money owed** cannot be repaid or closed through the API.
9. **No maker/checker.** The same administrator can create, verify, edit and delete a payment.
10. **Reconciliation records for collections and zakat distributions** now carry `stepsDone` (the steps that
    had completed, oldest first) and `undoFailed` in their `state`, so an administrator knows what to
    check. They still carry no amounts; the entity id is the pointer to the record.

Fixed by the final audit because they were implementation bugs, not policy: concurrent edits of a salary
payment could leave the payment and its ledger entry out of step (the edit is now version-checked and
re-synced); the consolidated report counted Mahallu-level entries twice and dropped institutes that only
had a bank balance; trial balance, balance sheet, income and expenditure and consolidated reports dropped
entries whose ledger document is missing; the balance sheet total bank balance was summed over a capped
listing; and the reconciliation scrubber now removes phone numbers glued to words and Basic credentials.
