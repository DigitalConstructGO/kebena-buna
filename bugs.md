# Dashboard bug hunt

Date: 2026-11-20 · Scope: `src/routes/dashboard/**`, the server modules behind it (`src/lib/server/**`), auth/access, and the login flow.

`svelte-check` passes with 0 errors and 0 warnings, so everything below is a logic, security or data-integrity bug that the type checker can't catch. Each item was confirmed by reading the code. Items that need runtime confirmation or code outside this repo (storefront, workers) are listed separately at the end.

## Severity stages

| Stage        | Meaning                                                                                             | Count |
| ------------ | --------------------------------------------------------------------------------------------------- | ----- |
| **Critical** | Exploitable now for account takeover or access from outside. Fix before any deploy.                 | 2     |
| **High**     | Money, stock or permissions go wrong in normal use, or a staff role can do far more than it should. | 13    |
| **Medium**   | Wrong data or broken workflow in realistic cases; data leaks to staff who shouldn't see it.         | 33    |
| **Low**      | Edge cases, missing validation, 500s instead of form errors, inconsistencies.                       | 19    |

## Fix status (2026-11-20)

**64 fixed · 2 partly fixed · 1 open.** Nothing is committed and there are no schema changes, so no migration is needed.

Checks run after the fixes:

- `svelte-check`: 0 errors, 0 warnings.
- `vite build`: passes.
- Dev server against the seeded DB:
  - Every dashboard list page (80) and a sample of detail pages (71, at most two per route) load as Owner with no server errors.
  - Demo sign-up and `/api/auth/sign-up` both return 404.
  - The login rate limit answers 429 after 5 bad tries.
  - View-only roles get 403 on lookup add/edit: Accountant on wholesale tiers, Shop staff on bag sizes, Scanner on slot templates.
- CRIT-01 was checked by reading the code. It was not exercised, because that would mean creating a role in the DB.

### Still to do

- **MED-03:** two-factor sign-in for Owner and Manager. This is a new feature, not a fix, and still needs to be built.
- **HIGH-11:** no job releases expired holds. Bookings created before this fix also need a one-off reconciliation of `visit_slot.held` and `visit_day.held`.
- **LOW-03:** tickets are cancelled after the order's transaction. `cancelTicket` opens its own transaction and can't join the order's, so the two aren't atomic.
- **New permissions:** `messages.manage` and `ai.manage` are granted to Manager only on a fresh install. On an existing DB, tick them for Manager in Admin › Roles; until then Managers can't retry messages, edit templates or take over AI chats.
- **Behaviour changes:**
  - `order.amountRefunded` now means money actually given back (net of the retained fee), and sales figures are net of refunds.
  - Only the Owner role is super admin. A role with every permission ticked no longer is.
  - Station and crop year are locked once a lot exists.
  - Desk check-in only accepts tickets dated today.
  - Packing refuses more than 2% excess roasted coffee.
  - Skipped deliveries no longer count as used. Whether the worker adds a replacement delivery for each skip still needs checking.

---

## Critical

### CRIT-01 · [✅ Fixed] Anyone with `users.manage` can make themselves Owner (super admin)

- **Where:** `src/lib/server/admin.ts:133-167` (`updateUser`), `:96` (`addStaff`), `:169` (`resetPassword`), `:268` (`setRolePermissions`); `src/routes/dashboard/admin/users/[id]/+page.server.ts:191,202`; `src/lib/server/permissions.ts:37`
- **Problem:** None of these check what the caller holds. A non-Owner with `users.manage` can:
  - set their own `roleId` to Owner (the only self-check stops you switching yourself off);
  - create a new Owner account;
  - tick every permission on their own role. `isSuperAdmin` is `permList.length === PERMISSIONS.length`, so that alone makes them super admin;
  - reset the real Owner's password, which signs the Owner out everywhere (account takeover).
- **Scenario:** The Owner gives an "Office admin" `users.manage` to onboard staff. That person opens their own user page, picks Owner and saves.
- **Fix:**
  - Only a super admin may assign or remove the Owner role, reset or disable an Owner, or change a role's grants.
  - Everyone else may only grant permissions they hold, and may not edit their own role or `roleId`.

### CRIT-02 · [✅ Fixed] Public sign-up is still open through the scaffold demo route

- **Where:** `src/routes/demo/better-auth/login/+page.server.ts:40-61` (tracked in git)
- **Problem:** `handleClosed` in `hooks.server.ts` blocks `/api/auth/sign-up*`, but the leftover `?/signUpEmail` action calls `auth.api.signUpEmail` on the server, which bypasses that block and signs the new user in.
- **Scenario:** Anyone on the internet POSTs to `/demo/better-auth/login?/signUpEmail` and gets a session. That reaches `/dashboard`, `/dashboard/account` and every uploaded file (HIGH-02).
- **Fix:** Delete `src/routes/demo/`. Also set `emailAndPassword.disableSignUp: true` in `auth.ts` and create accounts only through the admin and storefront code.

---

## High

### HIGH-01 · [✅ Fixed] Lookup screens let view-only staff add and edit records

- **Where:** pages that spread `crud.actions` from `contentCrud`/`localizedCrud`, whose `add`/`edit` check no permission (`node_modules/@nahu/admin-kit/dist/server/crud.js`; only delete calls `requireSuperAdmin`):

  | Page                                                           | Route gate         |
  | -------------------------------------------------------------- | ------------------ |
  | `catalog/{bag-sizes,categories,roast-levels,grinds,packaging}` | `catalog.view`     |
  | `origins/{regions,varieties,certifications}`                   | `origins.view`     |
  | `stock/machines`                                               | `stock.view`       |
  | `wholesale/tiers`                                              | `wholesale.view`   |
  | `subscriptions/plans`                                          | `memberships.view` |
  | `visits/slot-templates`                                        | `visits.view`      |
  | `admin/templates`                                              | `messages.view`    |

- **Scenario:**
  - A read-only accountant sets a wholesale tier's `discountPct` to 100.
  - Shop staff set the 1 kg bag size to `grams=1`, so packing (`stock.ts:382`) uses no roasted coffee.
  - A scanner changes slot capacities.
  - A support role rewrites the customer SMS template for `order.paid`.
- **Fix:** Give `localizedCrud`/`contentCrud` a `permission` option that calls `requirePermission` in add and edit, or wrap the actions on each page. `admin/templates` needs a new `messages.manage` permission.

### HIGH-02 · [✅ Fixed] Private uploads are served to any signed-in account

- **Where:** `src/routes/dashboard/files/[name]/+server.ts:2` re-exports the kit's `GET`; `access.ts:62` gives `files/` `permission: null`.
- **Problem:** The store holds wholesale trade licences (`tradeLicenceFile`) and member photos (`memberships.schema.ts:129`). Customers, switched-off staff (MED-01) and demo sign-ups (CRIT-02) are all signed-in users. Responses are also cached `immutable` for a year.
- **Fix:** `export const GET = createFileHandler({ canRead: (l) => l.isSuperAdmin || l.permList.length > 0 })`, or check that the user is active staff.

### HIGH-03 · [✅ Fixed] The same order can be refunded more than once

- **Where:** `src/lib/server/orders.ts:165-195`, `252-258`
- **Problem:** `refundable()` subtracts only `refundedQuantity`, which changes when a refund _succeeds_. The cap `amountPaid - amountRefunded` ignores refunds that are requested, approved or processing.
- **Scenario:** Two "refund everything" requests on a 1,000 ETB order are both created and approved. The order ends with `amountRefunded` = 2,000.
- **Fix:** When requesting, subtract open (not failed) refunds' quantities and amounts. Check the remaining amount again when marking a refund succeeded.

### HIGH-04 · [✅ Fixed] A double-submitted refund pays out twice

- **Where:** `src/routes/dashboard/orders/refunds/[id]/+page.server.ts:136-147`; `src/lib/server/orders.ts:239-247`
- **Problem:** The refund is read outside the transaction with no lock, and the status update doesn't check the old status.
- **Scenario:** Two concurrent "succeed" POSTs both pass the `approved → succeeded` check. The refund counters go up twice and two store-credit rows are inserted.
- **Fix:** `select … for update` inside the transaction, or `update … where status = 'approved'` and check how many rows changed.

### HIGH-05 · [✅ Fixed] Paying an invoice never updates its order

- **Where:** `src/lib/server/orders.ts:138-162`
- **Problem:** The payment row gets `orderId`, but the order's `amountPaid`, `paymentState` and `status` are never changed.
- **Scenario:** A wholesale invoice is paid in full, but the order still shows the full balance and stays `pending_payment`. Staff record the payment again on the order, so it is counted twice.
- **Fix:** When `inv.orderId` is set, lock the order and apply the `recordOrderPayment` logic in the same transaction.

### HIGH-06 · [✅ Fixed] Order payments lose updates, accept overpayment and skip VAT receipt numbers

- **Where:** `src/lib/server/orders.ts:101-135`; `src/routes/dashboard/orders/[id]/+page.server.ts:364`
- **Problem:**
  - The order is read without a lock, outside the transaction, and saved as `amountPaid = stale + amount`.
  - Nothing refuses an amount above the balance, or a payment on an order that is already paid.
  - A covering payment overwrites `partially_refunded` with `paid`.
- **Scenario:** A double click inserts two payment rows, but `amountPaid` counts only one. Both requests call `nextNumber('receipt:2026')`, so a receipt number is used up and the sequence has a gap.
- **Fix:** Re-read the order `for update` inside the transaction and refuse `amount > total - amountPaid`. Issue a receipt number only while the locked row's number is still null.

### HIGH-07 · [✅ Fixed] VAT receipt numbers have the year hard-coded (breaks on 2027-01-01)

- **Where:** `src/lib/server/orders.ts:126`
- **Problem:** Receipts are numbered `` `R-26-…` `` from `nextNumber(tx, 'receipt:2026')`.
- **Scenario:** From 1 January 2027, six weeks away, receipts are still numbered R-26 and the 2026 sequence never resets.
- **Fix:** Derive the year from the local date of `paidAt`, as `memberships.ts:34` already does.

### HIGH-08 · [✅ Fixed] Transferred green coffee arrives at zero cost

- **Where:** `src/lib/server/stock.ts:465-466`, called from `transferStock` (`:534`)
- **Problem:** On `transfer_in`, the cost comes from `greenCost(tx, lotId, toLocationId)`, which is the destination's cost and 0 at a new location.
- **Scenario:** 100 kg at 600 ETB/kg moves to a new site and arrives at 0 ETB/kg. Roasts there have zero cost of goods, so stock value is understated.
- **Fix:** Read the source cost once in `transferStock` and pass it as `costPerKg` for the incoming half.

### HIGH-09 · [✅ Fixed] Skipped subscription deliveries are counted as used

- **Where:** `src/routes/dashboard/subscriptions/[id]/+page.server.ts:162-173` (`refreshNext`); UI text at `+page.svelte:67,101`
- **Problem:** `deliveriesUsed` counts `'skipped'`, but Pause and Skip tell staff that the delivery "stays prepaid and is not lost".
- **Scenario:** A customer on a 6-delivery bundle pauses for 3 months. "Left" drops to 0, the top-up reminder fires, and a cancel then refunds nothing.
- **Fix:** Stop counting `'skipped'`, or add a replacement delivery for each skip.

### HIGH-10 · [✅ Fixed] "Bring back" works on cancelled subscriptions

- **Where:** `src/routes/dashboard/subscriptions/[id]/+page.server.ts:179-203` (`setDelivery`); `+page.svelte:45`
- **Problem:** Cancel changes only `scheduled` deliveries. Future `skipped` ones can still be brought back, because `setDelivery` doesn't check the subscription's status.
- **Scenario:** Someone brings back a skipped delivery on a cancelled, refunded subscription. It gets roasted and shipped.
- **Fix:** Refuse unless the status is `active` or `paused`. Cancel should also cancel future `skipped` rows.

### HIGH-11 · [🟡 Partly fixed] Booking holds never reserve capacity

- **Where:** `src/routes/dashboard/bookings/[id]/+page.server.ts:219-234` (schedule), `:253` (cancel)
- **Problem:** `heldPlaces` is saved on the booking only. Nothing ever changes `visitSlot.held` or `visitDay.held`.
- **Scenario:** Staff hold 40 places for a school group, but the slot keeps selling them and is oversold.
- **Fix:** In the same transaction, move `held` by the change in `heldPlaces`, using the `moveCounters` capacity check. Release the places on cancel or expiry.

### HIGH-12 · [✅ Fixed] Messages and webhooks can be changed with view-only access

- **Where:** `src/routes/dashboard/admin/messages/[id]/+page.server.ts:38` (retry/skip); `admin/webhooks/[id]/+page.server.ts:20` (replay)
- **Problem:** There is no `messages.manage` permission, so these actions need only `messages.view`.
- **Scenario:** Anyone allowed to view messages can requeue them or replay payment webhooks, and the payment worker processes the event again.
- **Fix:** Add `messages.manage` and require it in retry, skip and replay (and on templates, see HIGH-01).

### HIGH-13 · [✅ Fixed] Switched-off or deleted accounts can still sign in

- **Where:** `src/lib/server/auth.ts` (no check on `isActive`/`deletedAt`); `src/routes/login/+page.server.ts:19`; `hooks.server.ts:56-63`
- **Problem:** Switching an account off deletes its sessions, but `signInEmail` never checks `isActive`. The schema says a switched-off account cannot sign in.
- **Scenario:** A fired employee logs back in and reaches the dashboard shell, their account page and every uploaded file (HIGH-02).
- **Fix:** Add a better-auth `databaseHooks.session.create.before` that rejects inactive or deleted users, and clear `locals.user` for them in `handleBetterAuth`.

---

## Medium

### Auth & access

- **MED-01 · [✅ Fixed] Open redirect after login via a tab character**
  - Where: `src/routes/login/+page.server.ts:30-31`.
  - The regex `^\/(?![/\\])` accepts `/\t/evil.com`. Browsers strip the tab, so it resolves to `//evil.com`. A phishing link `/login?redirectTo=/%09/evil.com` sends the user there after a real login.
  - Fix: resolve `new URL(to, event.url)`, require the same origin, and redirect to `pathname + search`.
- **MED-02 · [✅ Fixed] No rate limit on `/login`**
  - Where: `src/routes/login/+page.server.ts:19`.
  - Calling `auth.api.signInEmail` on the server skips better-auth's limiter, so passwords can be guessed without limit.
  - Fix: use the kit's `takeToken`, keyed by IP and by email.
- **MED-03 · [⛔ Open] Required 2FA for Owner/Manager is not implemented** (questionnaire 5.1)
  - The column exists and the UI shows "Two-factor: Off", but there is no `twoFactor` plugin and nothing enforces it.
  - Fix: add the plugin, and gate those roles until it is enabled.

### Orders, customers & wholesale

- **MED-04 · [✅ Fixed] Store-credit payments never debit the credit ledger**
  - Where: `src/lib/schemas/orders.ts:20`, `src/lib/server/orders.ts:101-117`.
  - The balance is never checked or reduced, so the same 500 ETB of credit can pay many orders.
  - Fix: check `creditOf` and insert a negative `storeCredit` row in the same transaction.
- **MED-05 · [✅ Fixed] A partly paid order that is cancelled can't be refunded**
  - Where: `orders.ts:118-124,179`; `orders/[id]/+page.server.ts:394-397`.
  - `requestRefund` requires `paid` or `partially_refunded`, but a part-paid order stays `unpaid`, so the money paid is stuck.
  - Fix: allow a refund whenever `amountPaid - amountRefunded > 0`.
- **MED-06 · [✅ Fixed] The refund "Restock" box does nothing**
  - Where: `orders.ts:249-280`.
  - `refundLine.restock` is saved, but `decideRefund` never puts any stock back.
  - Fix: on success, call `adjustStock` for restock lines.
- **MED-07 · [✅ Fixed] The retained processing fee is never deducted**
  - Where: `orders.ts:192-206,261-277`.
  - `feeRetained` is saved, but the full amount is still refunded, and nothing checks `0 ≤ fee ≤ amount`.
  - Fix: pay out `amount - feeRetained` and validate the fee.
- **MED-08 · [✅ Fixed] Anonymising a customer leaves their personal data**
  - Where: `src/lib/server/customers.ts:85-116`.
  - These keep the person's details:
    - `order.contactName/Phone/Email`, `customerTin`, `deliveryAddress`, `ipAddress`;
    - `invoice.billing*`;
    - ticket holder names.
  - The orders list still shows and searches the name (`orders/+page.server.ts:67`).
  - Fix: redact those columns in the same transaction.
- **MED-09 · [✅ Fixed] The wholesale account page sends the whole customer directory to read-only users**
  - Where: `wholesale/accounts/[id]/+page.server.ts:110,172`.
  - `customerOptions()` (every customer's name and phone or email, unbounded) goes to anyone with `wholesale.view`.
  - Fix: load it only for `wholesale.manage`, or use a search endpoint.

### Catalog, origins & stock

- **MED-10 · [✅ Fixed] A stock count can overwrite sales made while it is posting**
  - Where: `stock.ts:590-609`.
  - The difference is worked out from an unlocked read and then added to the locked balance, so a sale in between is lost.
  - Fix: work out the difference inside the locked read.
- **MED-11 · [✅ Fixed] Sold-out items never show as low stock**
  - Where: `stockReads.ts:146,171,201`.
  - The queries filter `kg > 0` / `units > 0`, so items at 0, the most urgent, are left out.
  - Fix: left-join balances onto lots and sizes instead.
- **MED-12 · [✅ Fixed] Packing doesn't check the roast level against the source batches**
  - Where: `stock.ts:354-441`.
  - A Light batch can be packed as "Dark".
  - Fix: refuse a mismatch, or take the level from the batches.
- **MED-13 · [✅ Fixed] Packing accepts any excess of roasted coffee**
  - Where: `stock.ts:383-385`.
  - A typo of 100 kg for ten 1 kg bags uses 100 kg; the extra 90 kg vanishes with no waste entry.
  - Fix: add an upper tolerance, or record the excess as waste.
- **MED-14 · [✅ Fixed] A lot can be deleted while it still has coffee on hand**
  - Where: `origins/lots/[id]/+page.server.ts:364-380`.
  - The coffee stays in the stock value, but the lot disappears from every picker, so its stock can never be adjusted to zero.
  - Fix: refuse the delete while `green_stock.kg > 0` or the lot has movements.
- **MED-15 · [✅ Fixed] Deleting a product or size ignores subscriptions, plans and bags on hand**
  - Where: `catalog/products/[id]/+page.server.ts:489-509`; `deleteVariant` has no checks at all.
  - Live subscriptions and `monthlyCoffeeVariantId` end up pointing at a deleted size.
  - Fix: refuse the delete while any of these exist.
- **MED-16 · [✅ Fixed] A deleted size can never be added back**
  - Where: `db/catalog.schema.ts:140,154`.
  - The unique indexes on `sku` and `(product_id, bag_size_id)` include soft-deleted rows, so re-adding the size gives "Size already exists" with no visible row.
  - Fix: suffix the SKU on delete, or make the indexes ignore deleted rows.

### Visits, memberships & bookings

- **MED-17 · [✅ Fixed] Activating a lapsed membership keeps its old, expired dates**
  - Where: `memberships/[id]/+page.server.ts:184-189`.
  - `dates = m.startsOn ? {} : termDates(...)`. The action also has no status check, no audit and no transaction.
  - Fix: recompute `termDates` when the term has already ended, refuse `cancelled`, and audit the change.
- **MED-18 · [✅ Fixed] Renew has no server-side guard**
  - Where: `memberships/[id]/+page.server.ts:208-219`.
  - A double-click creates two pending renewals, each with new member cards.
  - Fix: lock the row and refuse if a renewal already exists or the status doesn't allow it.
- **MED-19 · [✅ Fixed] Changing a ticket type's capacity flag corrupts slot counters**
  - Where: `visits.ts:159,215,237`.
  - Cancel and reschedule read the type's current `countsTowardCapacity`, not the value it had at sale.
  - Fix: store the flag on the ticket at sale.
- **MED-20 · [✅ Fixed] Moving a ticket within the same day is refused when the day is full**
  - Where: `visits.ts:213-216,180-184`.
  - The day cap is checked before the source slot is released, although a same-day move changes nothing.
  - Fix: skip the day check for same-day moves.
- **MED-21 · [✅ Fixed] The reschedule dropdown shows times 3 hours early**
  - Where: `visits/tickets/[id]/+page.server.ts:131`.
  - `date_format(starts_at)` runs on a UTC connection, so a 09:00 slot shows as 06:00.
  - Fix: format with `localClock`, or use `convert_tz`.
- **MED-22 · [✅ Fixed] Cancelling an event ticket never frees the place**
  - Where: `visits.ts:237`.
  - `event.registered` is never decremented, so the event looks full, and `saveEvent` refuses to lower capacity.
  - Fix: decrement `registered` under a lock.
- **MED-23 · [✅ Fixed] "Generate sessions" re-creates sessions staff cancelled**
  - Where: `bookings.ts:200`.
  - Cancelled sessions are left out of the `existing` set, and there is no unique index on `(bookableId, startsAt)`.
  - Fix: count cancelled sessions as existing, filtering only on `deletedAt`.
- **MED-24 · [✅ Fixed] Changing a session's or event's times leaves staff assignments on the old times**
  - Where: `bookings/sessions/[id]/+page.server.ts:102-105`; `events.ts:274`.
  - The double-booking check then misses real clashes and reports false ones.
  - Fix: update the assignments in the same transaction.
- **MED-25 · [✅ Fixed] Raising a booking's party size past capacity gives a 500**
  - Where: `bookings/[id]/+page.server.ts:242-243`, `:178`.
  - The raw `booking_session_capacity_chk` SQL error reaches the user.
  - Fix: check capacity first and return a form error.
- **MED-26 · [✅ Fixed] Event staff assignment has no double-booking check**
  - Where: `visits/events/[id]/+page.server.ts:148`.
  - It inserts directly, skipping `overlapsFor`.
  - Fix: go through `assignStaff`.

### Content, messages, settings & reports

- **MED-27 · [✅ Fixed] "Send again" can send a message twice**
  - Where: `admin/messages/[id]/+page.server.ts:40-46`.
  - Only `sent` is refused, so a message that is `sending` can be requeued, and the update doesn't check the status.
  - Fix: allow only `failed`/`skipped`, and make the update conditional on the status.
- **MED-28 · [✅ Fixed] Content save errors come out wrong (arguments swapped)**
  - Where: `src/lib/server/content.ts:81,96,264`.
  - These calls do `new WriteRefused(message, field)`, but the signature is `(field, message)`. A duplicate slug shows a toast that just says "slug", with no inline error.
  - Fix: swap the arguments.
- **MED-29 · [✅ Fixed] The pages list drops grandchildren, and parent loops are allowed**
  - Where: `content/pages/+page.server.ts:37-38`; `content.ts:96`.
  - Third-level pages never appear, and an A↔B loop hides both pages.
  - Fix: build the tree recursively, and check ancestors on save.
- **MED-30 · [✅ Fixed] Sales by day is grouped by UTC date**
  - Where: `dashboard.ts:110-113`; `reports.ts:134-138`.
  - Sales between 00:00 and 02:59 Addis time land on the previous day, so the chart total no longer matches the "Sales" figure.
  - Fix: group by `date(convert_tz(paidAt,'+00:00','+03:00'))`.
- **MED-31 · [✅ Fixed] Saving a page or post after Publish probably puts it back to draft (needs a UI check)**
  - Where: `content/pages/[id]/+page.svelte`, `posts/[id]`.
  - The header Publish/Archive buttons set `page.form`, so Superforms doesn't refresh the main form's status, and the next Save sends the old status.
  - Fix: remove the status from the main form, or `reset({ data })` after a status change.
- **MED-32 · [✅ Fixed] Tour hotspot links accept any URL, including `javascript:`**
  - Where: `src/lib/schemas/content.ts:122,129`.
  - This is XSS if the public tour puts the URL in an `href`.
  - Fix: allow only http/https or `/` paths.
- **MED-33 · [✅ Fixed] Tour scene addresses can crash with a 500**
  - Where: `content.ts` `saveScene`.
  - There is no free-address check, the form allows 150 characters while the column holds 64, and deleting a scene doesn't free its address.
  - Fix: add the free-address check, cap the length at 64, and suffix the address on delete.

---

## Low

- **LOW-01 · [✅ Fixed] Role and user validation gaps**
  - Where: `admin.ts`.
  - A deleted or inactive `roleId` can be assigned, which silently leaves the user with no permissions.
  - The last-Owner check counts outside the transaction, so two Owners demoting each other at once leaves none.
  - `deleteRole` needs only `users.manage`, while every kit delete needs a super admin.
- **LOW-02 · [✅ Fixed] AI chat take-over needs only `ai.view`**
  - Where: `content/ai/[id]/+page.server.ts:48`.
  - Taking over silently replaces another staff member's hand-off.
- **LOW-03 · [🟡 Partly fixed] Cancelling an order leaves its tickets, bookings and memberships valid**
  - Where: `orders/[id]/+page.server.ts:379-399`.
- **LOW-04 · [✅ Fixed] A store-credit debit can push the balance negative**
  - Where: `customers/[id]/+page.server.ts:470-493`.
  - The expiry is also built in the server's time zone (`new Date('…T23:59:59')`) instead of with `fromLocal`.
- **LOW-05 · [✅ Fixed] Discount codes accept invalid settings**
  - Where: `src/lib/schemas/orders.ts:66-85`.
  - Accepted today: an expiry before the start, limits of 0 or below, a limit below the used count.
- **LOW-06 · [✅ Fixed] Changing a lot's station or crop year keeps the old lot code**
  - Where: `origins/lots/[id]/+page.server.ts:345-353`.
- **LOW-07 · [✅ Fixed] Unknown ids crash with a TypeError (500) instead of a form error**
  - A stale packed `itemId` in `changePacked` (`stock.ts:188-217`).
  - An unknown `stationId` in `nextLotCode` (`origins.ts:100-101`).
- **LOW-08 · [✅ Fixed] Edit actions save the record named by the form's hidden `id`, not the URL**
  - Where: products `:334`, variants `:296`, customer and wholesale `edit`.
- **LOW-09 · [✅ Fixed] Subscription Pause and Resume have no status check**
  - Where: `subscriptions/[id]/+page.server.ts:217-239`.
  - They work on cancelled or completed subscriptions. Resume also has no audit, and the 3-month maximum pause isn't enforced.
- **LOW-10 · [✅ Fixed] Membership terms overflow at month end**
  - Where: `memberships.ts:57-61` (`addMonths`).
  - Aug 31 plus 6 months gives Mar 2, not Feb 28.
  - The renew dialog also hard-codes "twelve-month".
- **LOW-11 · [✅ Fixed] Reschedule and check-in accept the wrong slots or dates**
  - Reschedule accepts past slots and slots at another location (the list is only filtered in `load`).
  - Desk check-in accepts a ticket for any visit date.
- **LOW-12 · [✅ Fixed] `generateSessions` uses the server's local "today"**
  - Where: `bookings.ts:180`.
  - On a UTC server between 00:00 and 03:00 Addis time, the last day is lost.
  - Fix: use `localToday()`.
- **LOW-13 · [✅ Fixed] Missing validation in visits and plans**
  - Slot templates and membership terms don't check that the end is after the start.
  - Plan limits (`maxAdults`/`maxChildren`) aren't enforced when adding members.
  - A duplicate ticket-type or plan code gives a 500.
- **LOW-14 · [✅ Fixed] The inbox "book" action can create duplicate bookings**
  - Where: `inbox/[id]/+page.server.ts:103`.
  - `BOOKABLE_FORMS` is checked only in the UI, and nothing checks for a booking that already exists.
- **LOW-15 · [✅ Fixed] The default language can be removed by editing**
  - Where: `admin/languages/+page.server.ts:61`.
  - Edit can untick `isDefault` or switch the default language off.
- **LOW-16 · [✅ Fixed] Home page and Reports disagree on sales**
  - Where: `dashboard.ts:31` vs `reports.ts:35`.
  - They treat refunds differently, and neither filters `order.deletedAt`.
- **LOW-17 · [✅ Fixed] Content address lengths**
  - Delete trims the address to 120 characters (`content.ts:181`), so long addresses collide and give a 500.
  - The form allows 150 characters for a page address, but the column holds 120.
- **LOW-18 · [✅ Fixed] Settings and locations validation gaps**
  - Renaming a setting's key onto an existing key gives a 500 (`settings/+page.server.ts:68`).
  - Taxes and audiences allow more than one default.
  - Opening hours accept a last entry after closing, and holidays accept an opening time after closing.
  - Location parent loops are only blocked one level deep.
- **LOW-19 · [✅ Fixed] "Bookings this week" on the home page counts 8 days**

---

## Suspected, not verified

These need a runtime test or code that isn't in this repo.

- **Wholesale accounts:**
  - Edits after approval (TIN, licence) skip re-approval.
  - Credit limits are never enforced (likely a storefront checkout matter).
  - An account with invoices but no orders can be deleted.
- **Stock and orders:** Order stock reservation and release don't exist in the dashboard, so cancel and refund can't put stock back.
- **Invoice payments:** accepted on already-paid invoices; `paidAt` uses the server's clock time.
- **Gateway response:** the payment detail page shows the raw gateway JSON (possibly personal data) to `orders.view`.
- **Stock dialogs:** changing "Stage" may keep the chosen item, posting a lot id as a batch id. This depends on the kit's combo picker.
- **Search:** `LIKE` on JSON name columns matches the `en`/`am` keys.
- **Pickers:** they don't filter inactive rows (roast levels, lots, machines).
- **Count sheet:** "12,5" becomes NaN, so the line is treated as "not counted".
- **Group check-ins:** a partly checked-in group can be cancelled or moved as a whole.
- **Deadlocks:** `rescheduleTicket` lock order can deadlock on opposite moves (500).
- **Concurrent runs:** concurrent `generateDays` runs can roll back the whole batch.
- **Unique indexes on soft-deleted rows:** a deleted slot template or message template still blocks re-adding the same key.
- **Webhook replay:** it can run on events with an invalid signature. Whether that is safe depends on the worker.
- **Permission gaps:** `loadGrant`'s count-based `isSuperAdmin` could break if stale permission rows remain in the DB.
- **AI chats:** they show the customer's phone to `ai.view` holders.
- **Public site:** content images served via `fileUrl()` (`/dashboard/files/…`) would redirect public visitors to the login page.

## Checked and fine

- Type check: `svelte-check` reports 0 errors and 0 warnings across 7,348 files.
- Rich text: `sanitizeRichHtml` is applied on save for pages, posts, products and events, and every `{@html}` in the dashboard renders sanitised content.
- Access rules: every dashboard route has one, every rule's prefix points to a real route, and every nav link resolves.
- Tax rates are entered as 0–100 percent consistently; no server code computes tax from them.
