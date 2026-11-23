# Kebena Coffee Museum: Questionnaire Answers (Working Draft v0.1)

**Status:** These are draft answers we made up so the build can start. Everything here can change. Facts about Kebena come from kebenageneraltrading.com. Everything else is a default we picked, chosen to be quick to build and easy to change later. Lines marked **[CONFIRM]** need a real answer from the client. Lines marked **[PLACEHOLDER]** are made-up numbers (prices, capacities) that staff can edit in the admin.

**Rule we used:** anything the client might change later (prices, zones, slots, thresholds, roles) is **a setting in the admin**, not hard-coded.

---

## What we know about Kebena (from their website)

- **Company:** Kebena General Trading PLC ("Kebena Trading PLC", "KGT"), a family-owned PLC. The family has grown and traded coffee in the Jimma zone for 30+ years. Sister company: Haider Abamecha Coffee Export.
- **Office:** Foziana Building, 1st floor, Office C1, Labu, Nefas Silk-Lafto, Addis Ababa. Office hours Mon–Fri 08:30–17:00.
- **Coffee infrastructure:** 8 washing stations (3 RFA-certified) and 4 dry mills in the Limu, Mana and Goma districts. Two farms: Gera and Djimmah. About 10,000 outgrower farmers, about 5,400 of them RFA-certified.
- **Origins sold:** Limu, Jimma/Djimmah, Gera, Nekemte, Guji, Sidama, Yirgacheffe, Harar.
- **Grades and processing:** Washed Limu Gr 1–2, Washed Gera Gr 1–2, Unwashed Djimmah Gr 1–5, Unwashed Nekemte Gr 1–5. Product categories: Specialty, Certified, Commercial.
- **Certifications:** RFA (Rainforest Alliance), organic, C.A.F.E. Practices.
- **Brand:** "KEBENA COFFEE". Website copy themes: Premium Quality, Unique Flavor, Sustainable Practices, Cultural Heritage, "Ethiopia, the birthplace of coffee".
- **Contact:** info@kebenageneraltrading.com, +251 912 605 824 (also WhatsApp).
- **Not on the website:** the museum, any retail roasted-coffee sales, any online payments. Today the business is green-coffee export (B2B). This means the museum shop, roasting and ticketing are **new operations**. We have designed the system to start simple.

---

## Key decisions at a glance

| Area | Default we're building |
|---|---|
| Venue | One venue with one ticket. Site A and Site B are stored as separate locations so they can be split later. |
| Currency | ETB only at launch. Prices include VAT (15%). |
| Coffee | Hybrid: core products sold from roasted stock, specialty lots roasted to order. |
| Checkout | Guest checkout allowed. An account is required only for memberships and subscriptions. |
| Payments | Chapa (cards, telebirr, CBE Birr, M-Pesa), plus Telebirr and CBE Birr direct when those merchant accounts are ready. Bank transfer for B2B and groups only. No cash on delivery. |
| Delivery | Own riders in Addis Ababa, priced by zone (sub-city). Free above a set amount. Pickup at the museum. |
| Stock | Three stages: green (kg) → roasted (kg) → packed bags (units). Low-stock level set per product. |
| Traceability | QR code on each bag label that opens the roast batch page, which shows the lot, station and farm. |
| Tickets | Timed entry (1-hour slots). Resident and foreign prices. QR e-ticket. Scanner works offline. |
| Memberships | Individual and Family, 12 months each. Renewal by reminder plus payment link, not automatic charging. |
| Subscriptions | Prepaid bundles (3, 6 or 12 deliveries), every 2 weeks or monthly. Customers can skip, pause or change online. |
| Customer | One account covers orders, tickets, memberships, subscriptions and bookings. |

---

## 1. Languages and locations

**1.1 Records that must be available in every language (Amharic + English)**
- **Both languages, required:** product names and descriptions, product options (roast, grind, size), origin and lot story text, ticket types, membership levels, booking and event listings, form labels, email/SMS notifications, order statuses shown to customers, receipts and e-tickets, and the AI agent knowledge base.
- **One language is enough:** admin-only fields (internal notes, roast logs, staff comments). Customer-entered text is stored as typed.
- Receipts and e-tickets print in the language the customer used when buying. Amharic font: Noto Sans Ethiopic.
- Afaan Oromo is a possible later addition: the language list is a setting, not hard-coded. [CONFIRM]

**1.2 Site A (indoor halls) and Site B (outdoor square)**
- **One venue, one ticket.** The general-admission ticket covers both sites.
- Capacity is controlled at **Site A** (indoor, the limiting space). Site B has no separate cap.
- Opening hours are the same for both. Each site still has its own hours fields in the admin in case Site B (outdoor) closes earlier or opens for evening events.
- In the data, each site is a separate **location**. This lets us later split tickets, assign bookings (e.g. a coffee ceremony in Site B) and route scanners per site. [CONFIRM]

**1.3 Other locations that sell coffee or hold stock**

| Location | Sells | Holds stock | Notes |
|---|---|---|---|
| Museum shop (Site A) | Packed bags, merchandise | Packed bags | Walk-in sales recorded in the admin (simple POS screen). |
| Museum café / ceremony area (Site B) | Brewed coffee, ceremonies | Roasted kg | We track only the roasted coffee it uses, not café menu sales (out of scope for launch). |
| Roastery | – | Green kg, roasted kg | [CONFIRM] whether it is on site or elsewhere. |
| Warehouse / online fulfilment | Online orders | Green kg, packed bags | Can be the same place as the roastery. |
| Washing stations / dry mills | – | – | Not tracked. They only supply lots (traceability data). |

---

## 2. Products and pricing

**2.1 Options a customer can choose**
- **Bag size:** 250 g, 500 g, 1 kg.
- **Roast level:** Light, Medium, Dark (traditional Ethiopian / jebena roast).
- **Grind:** Whole bean, Jebena (fine traditional), Espresso, Filter / pour-over, French press.
- **Packaging:** Standard bag only at launch. A gift box is planned for later.
- Each product sets which options it allows. For example, a specialty Gera lot might be offered only as Light/Medium.

**2.2 What changes the price**
- Price is set **per product** (the product is the origin and grade, e.g. "Washed Limu Gr 1"). Within a product, **only bag size changes the price**.
- Roast level and grind are free choices.
- Example [PLACEHOLDER]:

| Product | 250 g | 500 g | 1 kg |
|---|---|---|---|
| Kebena House Blend (Commercial) | 450 ETB | 850 ETB | 1,600 ETB |
| Washed Limu Gr 1 (Specialty) | 650 ETB | 1,250 ETB | 2,400 ETB |
| Washed Gera Gr 1 (Specialty, RFA) | 700 ETB | 1,350 ETB | 2,600 ETB |
| Unwashed Djimmah Gr 3 (Commercial) | 400 ETB | 750 ETB | 1,400 ETB |

**2.3 Roast-to-order or from stock**
- **Both.** Each product has a setting: `from stock` or `roast to order`.
- Core products (House Blend, Djimmah, Limu) are sold from roasted stock.
- Specialty and limited lots are roasted to order.
- Roast-to-order products are roasted on fixed **roast days (Tue and Fri)** [PLACEHOLDER], so orders are grouped into batches.

**2.4 Time from order to dispatch**
- Different per product. This is a field on each product:
  - From stock: dispatch within **1 working day**.
  - Roast to order: dispatch within **3 working days** (next roast day + 1 day to rest and pack).
- The product page shows the expected dispatch date, worked out from the roast-day calendar.

**2.5 Selling outside Ethiopia**
- **Not at launch.** Retail checkout is ETB only and delivers within Ethiopia only.
- International visitors can still buy tickets in ETB using Chapa card payments.
- International coffee buyers are sent to the existing export enquiry ("Request Coffee Sample or Order") and to the Phase 2 wholesale portal.
- The system stores prices in a single currency for now, with a currency field already in the data model. Multi-currency can be added later. Exchange rates would be set by hand in the admin. [CONFIRM]

**2.6 VAT and TIN**
- Prices are shown **including 15% VAT**. Receipts show the VAT breakdown.
- Receipts show **Kebena's TIN and VAT registration number** on every receipt.
- **Customer TIN** is an optional field at checkout ("Need a VAT invoice for your business?"). It is required for wholesale (Phase 2).
- [CONFIRM] with Kebena's accountant whether online receipts must also be issued through a registered fiscal/sales-register machine, or whether system-generated invoices are enough.

**2.7 Discounts at launch**
- **Discount codes: yes.** Both percentage off and fixed amount off. Settings per code: minimum order, expiry date, usage limit, and whether it applies to coffee, tickets or both.
- **Gift cards: no** (later phase).
- **Bundles:** built as normal products (e.g. "Origins Discovery Set: 3 × 250 g" with its own price and stock). This needs no special bundle logic.
- **Member discount** is applied automatically (see 7.2). It does not stack with codes; the better of the two applies.

---

## 3. Orders, payment and delivery

**3.1 Guest or account**
- Customers can **check out as guests**, and are offered the option to create an account after paying.
- An **account is required** for memberships, subscriptions and wholesale.
- Login: phone number + OTP (SMS), with email + password as an option. Many customers have a phone but not an active email address.

**3.2 Order steps**

```
Pending payment → Paid → Roasting* → Packed → Out for delivery  → Delivered
                                         └→ Ready for pickup → Collected
Side states: Cancelled, Refunded, Partially refunded, Payment failed
* Roasting is used only for roast-to-order items.
```

**3.3 When customers are notified (SMS + email, in their language)**
- **Paid:** order confirmation and receipt.
- **Roasting:** "Your coffee is being roasted today" (roast-to-order only; this is good for the brand story).
- **Out for delivery** (with rider phone number) / **Ready for pickup.**
- **Delivered / Collected:** thank-you message with a review link.
- Telegram notifications through the AI agent bot are planned for Phase 2.

**3.4 Cancellations and refunds**
- Customers can **cancel online up to the "Roasting" step** for roast-to-order items, or **until "Packed"** for stock items. The refund goes back through the same payment method.
- After that, cancellation is staff-only.
- **Partial refunds: yes, staff only** (e.g. one item out of stock or damaged). Only the Manager or Owner role can issue refunds.

**3.5 Delivery pricing: by zone, free above an amount**

| Zone | Areas | Fee [PLACEHOLDER] |
|---|---|---|
| Zone 1 | Nefas Silk-Lafto, Kirkos, Lideta, Bole | 150 ETB |
| Zone 2 | Arada, Addis Ketema, Kolfe Keranio, Yeka, Gullele | 200 ETB |
| Zone 3 | Akaky Kaliti, Lemi Kura, outskirts | 250 ETB |
| Outside Addis | Regional cities, by courier | 400 ETB + quote for heavy orders |
| Pickup at museum | – | Free |

- **Free delivery in Addis above 3,000 ETB** [PLACEHOLDER].
- Members get free delivery in Addis on every order (see 7.2).
- Zones, fees and the free-delivery amount are all editable in the admin.

**3.6 Who delivers**
- **Within Addis:** Kebena's own staff/riders at launch. The admin assigns the rider and the rider's phone is sent to the customer.
- **Outside Addis:** a courier (e.g. Ethiopian Postal Service EMS or a private courier). Staff enter the tracking number by hand.
- A courier API integration can come later. [CONFIRM] which courier.

**3.7 Pickup at the museum**
- **Yes, from the museum shop at Site A,** during opening hours. The customer shows the order QR code from their confirmation.

**3.8 Payment methods at launch**
- **Chapa:** the main gateway. One integration covers Visa/Mastercard (needed for foreign visitors), telebirr, CBE Birr, M-Pesa and bank apps. **If only one merchant account is ready by launch, this is the one.**
- **Telebirr (direct)** and **CBE Birr (direct):** added once those merchant accounts are active. The brief requires both. If they are late, Chapa covers both wallets in the meantime.
- **Bank transfer:** only for school/group bookings and wholesale, against an invoice. Staff mark these as paid by hand.
- **Cash on delivery:** **no** at launch (risk of unpaid roast-to-order orders). It can be turned on later for stock items in Addis.
- **Cash / card at the front desk:** walk-in tickets and shop sales are recorded in the admin as "paid at desk".
- **[CONFIRM] Which merchant accounts already exist?** This is the item most likely to delay launch, so start these applications on Day 1.

---

## 4. Stock, roasting and traceability

**4.1 Stages to count: all three**

```
GREEN LOT (kg) ──roast batch──► ROASTED (kg) ──packing run──► PACKED BAGS (units per product + size)
```

**4.2 Units**
- Green beans: **kg per lot**.
- Roasted beans: **kg per roast batch**.
- Packed bags: **number of bags per product, size and roast level**. Grind is chosen at packing, so ground and whole bean come from the same roasted stock.
- Café use: kg of roasted coffee taken out of stock as "internal use".

**4.3 Low-stock alerts**
- **Set per product** (and per green lot), with a default if left blank:
  - Green lot: alert below **60 kg** (one bag) [PLACEHOLDER].
  - Roasted: alert below **10 kg** [PLACEHOLDER].
  - Packed bags: alert below **10 bags** per size [PLACEHOLDER].
- Alerts show on the dashboard and go out as a daily email/Telegram message to the Manager and Roaster.

**4.4 Current stock records**
- Assumption: Excel or paper. [CONFIRM]
- **We will provide an import template (CSV/Excel)** with one sheet each for Green lots, Roasted stock and Packed bags. The client fills it in, and we import it on Day 4.
- If no file arrives, staff do an opening stock count directly in the admin.

**4.5 Lot ID format**
- We suggest this format, so it carries meaning and sorts well: `KGT-{STATION}-{CROPYEAR}-{SEQ}`
  - Example: `KGT-LIM-2026-014` is the 14th lot from the Limu station, crop year 2026.
  - Station codes: `LIM` Limu, `MAN` Mana, `GOM` Goma, `GER` Gera Farm, `DJM` Djimmah Farm, plus one code for each of the 8 washing stations.
- If Kebena already uses an export/ECX/ECTA lot or contract number, we store it in a separate "External reference" field. [CONFIRM] and send an example.

**4.6 Blends and splits**
- **Yes to both.** One roast batch can use several lots, with kg per lot recorded (for blends like the House Blend). One lot can be split across many batches.
- The system works out traceability for blends automatically. The bag's QR page shows every lot in the blend.

**4.7 Roast batch record**

| Field | Required | Notes |
|---|---|---|
| Batch ID | auto | Format `RB-YYMMDD-NN` |
| Date and time | yes | |
| Roaster (staff member) | yes | The logged-in user |
| Roasting machine | optional | For when there is more than one roaster |
| Lot(s) + kg per lot | yes | At least one lot |
| Weight in (green kg) | yes | Taken out of green stock |
| Weight out (roasted kg) | yes | Added to roasted stock |
| Weight loss % | auto | Flagged if outside 12–20% |
| Roast level | yes | Light, Medium or Dark |
| Roast time (min) | optional | |
| Drop temperature | optional | |
| Cupping score / notes | optional | |
| Linked orders | auto | For roast-to-order |

**4.8 Lot details stored**
- Farm or washing station
- Region and zone (e.g. Oromia › Jimma › Limu)
- Altitude (m)
- Variety (e.g. Ethiopian heirloom, 74110, 74112)
- Processing (Washed, Natural/Unwashed)
- Grade (1–5)
- Harvest / crop year
- Certifications (RFA, Organic, C.A.F.E. Practices)
- Number of contributing farmers (optional)
- Cupping score (optional)
- Photo
- Short story text in both languages
- Only **station, region, process and crop year are required**. Everything else is optional, so lots can be entered quickly.

**4.9 Traceability for customers**
- **Per bag, through a QR code on the label.** The packing run prints a label with the roast batch ID and QR code. Scanning it opens a public page showing the batch (roast date, roast level), its lot(s), the washing station or farm, region, altitude, process and certification, plus a map pin and photo.
- The product page also has a general "Where this comes from" section.
- This is cheap to build because one label is printed per packing run, not one per bag.

**4.10 Accounting and ERP**
- Assumption: Kebena's accountant uses Peachtree or similar. [CONFIRM]
- **No live integration at launch.** The admin provides **CSV/Excel exports** (daily sales, VAT summary, refunds, stock value) that the accountant imports. A direct integration can be scoped after launch.

---

## 5. Staff accounts and permissions

**5.1 Roles**

| Role | Can see | Can change |
|---|---|---|
| **Owner / Admin** | Everything, including reports and finance | Everything: users and roles, prices, settings, refunds |
| **Manager** | All orders, stock, tickets, bookings, members, reports | Orders, refunds, discount codes, stock adjustments, bookings, ticket slots and capacity, staff assignment. Not: users/roles, payment settings |
| **Shop staff / Fulfilment** | Orders, packed stock, customers (contact info only) | Order status (packed, out for delivery, collected), packing runs, desk sales. Not: refunds or prices |
| **Roaster** | Green and roasted stock, lots, roast batches, roast-to-order queue | Create roast batches, create and edit lots, green stock receipts. Not: orders or customers |
| **Front desk** | Today's tickets, bookings, members, form submissions | Sell walk-in tickets, check in visitors, update booking status, look up members |
| **Ticket scanner** | Scanner screen only | Scan and check in. Nothing else |
| **Content editor** | CMS pages, posts, media, product text | Page/blog content and translations, product descriptions. Not: prices or stock |
| **Accountant (read-only)** | Sales, VAT and refund reports, exports | Nothing |

- Each staff member gets their own login. Shared logins are not allowed. Owner and Manager logins require 2FA.
- An activity log records price changes, refunds and stock adjustments.

**5.2 Reports**

| Report | How often | Who |
|---|---|---|
| Sales summary (shop + tickets + memberships), with VAT | Daily (auto email at 21:00) + on-demand | Owner, Manager, Accountant |
| Best sellers by product, size and roast | Weekly | Owner, Manager |
| Ticket sales and check-ins by day and time slot; resident vs foreign split | Daily | Owner, Manager, Front desk |
| Active members and subscriptions; renewals due in the next 30 days | Weekly | Owner, Manager |
| Stock levels and low-stock list | Daily | Manager, Roaster |
| Stock value (green + roasted + packed) | Monthly | Owner, Accountant |
| Roast yield (weight loss % by batch and lot) | Monthly | Roaster, Manager |
| Bookings and form submissions by status | Weekly | Manager |
| Discount code usage | On demand | Owner, Manager |

---

## 6. Tickets and visits

**6.1 Ticket types and prices** [PLACEHOLDER]

| Ticket | Ethiopian resident | Foreign visitor |
|---|---|---|
| Adult | 200 ETB | 1,000 ETB |
| Student (valid student ID) | 100 ETB | 500 ETB |
| Child (6–12) | 75 ETB | 400 ETB |
| Child under 6 | Free (still needs a ticket for the count) | Free |
| Group (10+ people, per person) | 150 ETB | 800 ETB |
| School group (per student, invoice) | 50 ETB | – |
| Add-on: Coffee ceremony | 300 ETB | 600 ETB |
| Members | Free (see 7.2) | Free |

**6.2 Checking resident vs foreign at the entrance**
- The e-ticket and the scanner screen show the ticket type in large, colour-coded text (e.g. **RESIDENT · ADULT** in green, **FOREIGN · ADULT** in blue).
- Staff ask resident and student ticket holders for ID. Accepted ID: Kebele ID, Fayda national ID, driving licence, residence permit or student ID.
- If the ID doesn't match, the front desk **upgrades the ticket**: the visitor pays the difference at the desk, and the change is logged.
- At checkout, the buyer ticks a box: "I will show a valid Ethiopian ID / residence permit at entry."

**6.3 Date, time slots and capacity**
- **Timed entry:** set date + 1-hour slots, from 09:00 to 17:00 (last entry 16:00) [PLACEHOLDER].
- **Capacity: 50 visitors per slot, 400 per day** [PLACEHOLDER]. This is set per slot in the admin.
- Walk-up sales at the front desk use the same capacity, so the venue never oversells.
- Closed days (e.g. Monday) and holidays are set on a calendar. The calendar should include Ethiopian holidays and the Ethiopian calendar display (e.g. Meskel, Timket). [CONFIRM opening days]

**6.4 Ticket validity**
- **One full day, on the booked date.** The first scan checks the visitor in. Re-entry is allowed the same day: a second scan shows "Re-entry – first checked in at 10:14".
- The time slot controls arrival only. Visitors can stay as long as they like.
- The ticket covers both Site A and Site B.

**6.5 Changes and refunds**
- **Change of date:** free, online, up to **24 hours before** the slot, subject to availability.
- **Refund:** online, up to **48 hours before** the slot, minus a payment-processing fee. After that, no refund (rescheduling still allowed until 24 h before).
- If the museum cancels (closure or event), customers get a full refund automatically.

**6.6 Schools and groups**
- **Yes.** Schools and groups of 10+ use a booking request form. Staff confirm the date and slot (this reserves capacity) and send an invoice. Payment is by bank transfer, or online through a payment link.
- Once paid, the group gets **one group QR code** with a headcount, and staff can check in part of the group if not everyone arrives.
- Unpaid group holds are released automatically after **7 days** [PLACEHOLDER].

**6.7 Internet at the entrance**
- **Assume no.** The scanner is built **offline-first**. It runs in the browser on a phone or tablet (no app store needed), downloads the day's ticket list at opening, and verifies signed QR codes without internet. Check-ins sync when the connection returns.
- If two scanners are offline, the same ticket could get in twice. This risk is accepted, and the case is flagged when the scanners sync.

---

## 7. Memberships and coffee subscriptions

**7.1 Membership levels** [PLACEHOLDER]

| Level | Price / year | Covers |
|---|---|---|
| **Individual** | 1,500 ETB | 1 named adult |
| **Family** | 3,500 ETB | 2 adults + up to 3 children under 18 |
| **Student** | 750 ETB | 1 student with valid ID |
| **Patron (Coffee Circle)** | 10,000 ETB | Family benefits + 250 g specialty coffee each month + private cupping session once a year |

- All memberships last **12 months from the date of purchase**.

**7.2 Benefits the system applies automatically**
- **Free entry.** The member's QR code works at the scanner, and members can reserve a free time slot online.
- **Shop discount: 10%** (Patron: 15%), applied automatically when logged in.
- **Free delivery in Addis** on every order.
- **Member-only events:** visible and bookable only when logged in as a member.
- **Monthly coffee (Patron only):** the system creates a monthly order automatically, using the subscription engine.
- **Applied by staff:** guest passes, ceremony discounts and anything else ad hoc.

**7.3 Who a membership covers**
- Individual, Student and Patron: one person. Family: up to 5 named people under one account. Each person gets their own QR code (or one family QR code that checks in a set number of people).

**7.4 Auto-renewal**
- **No automatic charging at launch.** Local gateways don't reliably support it.
- Instead, the system sends **renewal reminders with a one-click payment link** at **14 days before**, **on the expiry date** and **7 days after** expiry, by SMS and email.
- The membership has a **7-day grace period**, then lapses.
- The data model keeps a "renewal method" field, so automatic charging can be added later if Chapa or Telebirr supports it.

**7.5 Coffee subscriptions**
- **Frequency:** every 2 weeks or monthly. Weekly is not offered (it adds roasting load).
- **Payment: prepaid bundles of 3, 6 or 12 deliveries**, with 5% / 10% / 15% off. Bundles avoid the recurring-payment problem. When one delivery is left, the customer gets a top-up reminder with a payment link.
- **Customers can, online:**
  - change the product, size, roast or grind (until 2 days before the next roast day)
  - **skip** a delivery
  - **pause** for up to 3 months
  - **cancel**: unused prepaid deliveries can be refunded or turned into store credit [CONFIRM which]
- Subscription orders are linked to roast days and show up in the roaster's queue automatically.

---

## 8. Bookings, events and forms

**8.1 What visitors can book** [PLACEHOLDER times and prices]

| Bookable | Slots | Max group | Price | Paid in advance? |
|---|---|---|---|---|
| **Guided tour** (Amharic or English) | 10:00, 13:00, 15:00 daily | 20 | Ticket price + 150 ETB | Yes, online |
| **Coffee ceremony experience** (Site B) | 11:00, 14:00, 16:00 | 12 | 300 ETB resident / 600 ETB foreign | Yes, online |
| **Cupping / tasting session** | Saturday 10:00 | 10 | 500 ETB | Yes, online |
| **Private event / venue hire** | By enquiry | By quote | By quote | Deposit by invoice |
| **School visit** | By enquiry (weekday mornings) | 40 | See 6.1 | Invoice |

**8.2 Staff assignment**
- **Yes, for guided tours, ceremonies, cupping sessions and private events.** The booking has an "assigned staff" field.
- A calendar view shows each guide's assignments.
- Assignment is manual. The system warns if the same person is double-booked.
- Bookings without an assigned staff member 24 hours before the start are flagged on the dashboard.

**8.3 Events**
- **Both free and ticketed events.** Every event requires **registration**, so the venue knows numbers and can enforce capacity. Free events get a free QR registration.
- Ticketed events use the same ticket and QR system as entry tickets.
- Each event can be marked **public** or **members only**.

**8.4 Form fields**

| Form | Required | Optional |
|---|---|---|
| **Booking** (tour, ceremony, cupping) | Name, phone, email, date and slot, number of people, language (Amharic or English) | Special requests, accessibility needs |
| **Group / school booking** | Organisation name, contact person, phone, email, preferred date(s), group size, age range | TIN (for invoice), special requests |
| **Private event enquiry** | Name, phone, email, event type, preferred date, guest count | Budget, catering needs, message |
| **Event registration** | Name, phone, email, number of attendees | Marketing consent |
| **Feedback** | Rating (1–5), message | Name, email, visit date |
| **General enquiry** | Name, email or phone, subject, message | – |

- All forms include a spam check (invisible captcha) and an optional marketing consent tick box. The box is never pre-ticked.

**8.5 Submission workflow**

```
New → In progress → Confirmed → Done
                 └→ Cancelled / Declined
```

- New submissions go to a shared inbox in the admin. The Front desk handles bookings and enquiries; the Manager handles private events and groups.
- Every change of status is logged with the staff member and time.
- **Confirmed** and **Cancelled** send an automatic email/SMS to the visitor.
- The Manager gets an alert for anything left in **New** for more than 24 hours.

---

## 9. Customers and existing data

**9.1 One account for everything**
- **Yes.** One customer account, identified by phone number, covers shop orders, tickets, memberships, subscriptions, bookings and event registrations.
- Guest orders are linked to the account automatically when the customer later registers with the same phone or email.

**9.2 Existing lists to import**
- Assumption: little or nothing at retail level. The current website has a newsletter signup, so **that list should be exported and imported**. [CONFIRM] what exists.
- Format: we provide a CSV template (name, phone, email, language, consent yes/no, consent date, source).
- Contacts from export buyers are B2B. They stay out of the retail list and go into the Phase 2 wholesale portal.

**9.3 Marketing and consent**
- **Yes, they will market.** Consent is recorded **separately for email, SMS and Telegram**, with the date, time and source of each consent.
- Every message includes an unsubscribe link (email) or STOP keyword (SMS).
- Imported contacts without recorded consent are **not** messaged until they opt in.
- This follows Ethiopia's Personal Data Protection Proclamation (No. 1321/2024). [CONFIRM with legal]

**9.4 Data retention**

| Data | Kept for |
|---|---|
| Orders, invoices, payments, VAT records | **10 years** (tax record-keeping requirement; [CONFIRM] with accountant) |
| Customer accounts | Until deleted by the customer, or **3 years of inactivity**. After that, personal details are removed and orders are kept without names. |
| Ticket check-in logs | 2 years |
| Form submissions (enquiries, feedback) | 2 years |
| Marketing consent records | As long as the contact exists + 3 years after opting out |
| Staff activity logs | 5 years |

- Customers can download or delete their data from their account page (deletion keeps the anonymised financial records).

---

## 10. Virtual tour

**10.1 What hotspots link to**
- **Yes, both.**
  - **Product hotspots:** e.g. the roasting display or origin wall links to the matching coffee product, a lot story or the origins map.
  - **Booking hotspots:** e.g. the ceremony area in Site B links to "Book a coffee ceremony"; the tour start links to "Book a guided tour".
  - **Info hotspots:** history text, images or video in both languages, edited in the CMS.
- Hotspot targets are set in the CMS, so staff can change links without the tour being rebuilt.

---

## 11. Phase 2: wholesale portal

**Scope:** the portal sells **roasted coffee to cafés, hotels, restaurants, offices and retailers**. Green-coffee export stays Kebena's existing offline process (quote and contract). The portal only has a "Request green coffee quote / sample" form that sends export buyers to the export team.

**11.1 Details a business must provide**
- Business name
- Business type (café, hotel, restaurant, office, retailer, exporter)
- **Trade/business licence number + upload**
- **TIN** (required)
- VAT registration number (if registered)
- Contact person name, phone and email
- Delivery address (multiple allowed)
- Billing address
- Expected monthly volume (kg)

**11.2 Approval**
- **Yes, manual approval** by the Manager or Owner before the business can see wholesale prices or order. The applicant gets an email/SMS when approved or declined.

**11.3 Wholesale pricing**
- **Fixed quantity tiers** as the default, plus an **optional discount % per customer** that the Owner sets for key accounts. Prices are per kg excluding VAT [PLACEHOLDER]:

| Tier | Monthly order | Price vs retail 1 kg |
|---|---|---|
| Tier 1 | 5–19 kg | −20% |
| Tier 2 | 20–49 kg | −27% |
| Tier 3 | 50 kg + | −33% |

**11.4 Minimum order**
- **5 kg per order** [PLACEHOLDER]. Coffee is sold in 1 kg bags, with mixed products allowed.

**11.5 Payment terms**
- **Prepay by default** (Chapa or bank transfer).
- **Credit is an approved exception, set per customer:**
  - default credit limit **50,000 ETB**
  - **net 30 days**
  - set by the Owner only
- The system blocks new credit orders when a customer is over their limit or has an overdue invoice. It sends invoice reminders at 7 days before the due date, on the due date, and 7 days overdue.

---

## 12. Checklist of files and access

| Item | Who | Notes |
|---|---|---|
| [ ] Current stock list | Client | **We send the import template on Day 1.** |
| [ ] Product list with options and prices | Client | We pre-fill a draft from the website's 4 products + the table in 2.2. The client only corrects it. |
| [ ] Example lot records and roast batch records | Client (roaster) | We send blank templates matching 4.7 and 4.8. |
| [ ] Ticket, membership and subscription price lists | Client | The client approves or edits the placeholders in 6.1, 7.1 and 7.5. |
| [ ] Existing customer/member/subscriber lists | Client | At least the website newsletter export. |
| [ ] Staff names, emails, phones and roles | Client | Use the role list in 5.1. |
| [ ] Telebirr, Chapa and CBE Birr merchant account details | Client | **Most urgent.** Start the Chapa application on Day 1. |
| [ ] Kebena TIN + VAT registration number | Client | Needed for receipts (2.6). |
| [ ] Logo files (SVG/PNG, light and dark) | Client | The website already has `kebena-light.png`; we need the originals. |
| [ ] Farm and washing station photos, GPS locations, altitude | Client | For the origins map and traceability pages. |
| [ ] Opening days, hours and holiday closures | Client | For 6.3. |
| [ ] Amharic translations reviewed by a native speaker | Client | We supply first drafts; the client signs off. |

---

## Open questions to settle first (they block the build)

1. **Merchant accounts:** which of Chapa, Telebirr and CBE Birr exist today? This affects checkout on Day 4.
2. **Roastery:** where is it, and is there one roasting machine or several? This affects stock locations and roast days.
3. **Opening days and hours** for the museum. This affects the ticket calendar.
4. **Fiscal receipts:** do online receipts need to go through a registered sales-register machine? This affects receipt and invoice output.
5. **Resident/foreign pricing:** is the client comfortable with ID checks at the door? This affects ticket types and scanner screens.
