# ZAAD — Landing Page Design Brief

**For:** Design team
**Product:** ZAAD — Mahallu Management Platform
**Goal of this document:** Give you everything you need to understand the product and design a landing page that explains it, earns trust, and gets Mahallu committees to request a demo.
**Status:** Product is built and in use. Items marked **Confirm** need an answer from the product owner before final design.

---

## 1. The product in one breath

**ZAAD is a digital office for a Mahallu.** A Mahallu is the community that forms around a Juma Masjid (mosque) in Kerala, India. ZAAD lets the Mahallu committee keep every family's record, collect dues, issue marriage and death certificates, run welfare and Zakat, keep the accounts and report back to the community, all in one secure system that also works on a phone. Families get their own portal to see their records, payments and certificates.

> **Short version for a hero:** Know every family. Serve every need. Develop the community.

---

## 2. Background you need (what is a Mahallu?)

If you are not familiar with the context, read this first. It changes how the page should feel.

- In Kerala, almost every Muslim family belongs to a **Mahallu**: the local community attached to a mosque, much like a parish.
- The Mahallu is run by an elected **committee** (President, Secretary, Treasurer and members), usually volunteers with day jobs.
- The committee is responsible for far more than the mosque building. They:
  - keep a register of every family and member
  - collect a regular membership due from each family, called **Varisangya**
  - register **Nikah** (marriages) and deaths, and issue certificates and **NOCs** (No Objection Certificates)
  - manage the burial ground (**Qabaristan**)
  - collect and distribute **Zakat** (obligatory charity) and run welfare for poor families, widows, orphans and the sick
  - run the **Madrasa** (religious school) and other institutes, with staff and salaries
  - hold committee meetings, run programs and look after mosque assets
  - present the accounts to the community every year
- **Today most of this lives in paper registers, notebooks, Excel sheets and WhatsApp groups.** Records get lost, accounts are hard to audit, the same family is entered three times, and nobody can quickly answer "how many families need help?".

**ZAAD replaces that with one system.** The spec puts the goal this way: not just to digitise the paperwork, but to give every Mahallu a working model of an ideal, well-run community.

### The questions ZAAD helps a Mahallu answer

These come straight from the product vision and make strong landing-page material:

1. Who are our families?
2. What are their needs?
3. Who needs education support?
4. Who is eligible to receive Zakat, and who can give it?
5. Which elderly people need support?
6. How are our finances being managed?
7. What has the Mahallu achieved this year?
8. What should we improve next year?

---

## 3. Who the landing page is for

| Audience | Who they are | What they care about | What the page must do for them |
|---|---|---|---|
| **Committee leaders** (primary buyer) | President, Secretary, Treasurer of a Mahallu. Often aged 40–65, comfortable with WhatsApp and a smartphone, not with "software". | Less paperwork, honest accounts, looking organised in front of the community, not losing records. | Make it feel simple, trustworthy and made for *them*. Get them to request a demo. |
| **Multi-Mahallu bodies** | Federations, district or regional groups, or anyone running several mosques. | One view across many Mahallus, consistent records. | Show that ZAAD handles many Mahallus from one account. |
| **Office staff and volunteers** | Survey volunteers, madrasa accountants, clerks. | Easy data entry on a phone, clear tasks. | Reassure that it is easy to learn. |
| **Community members (families)** | Ordinary members, often sent to the page by their committee. | Seeing their own record, paying Varisangya, getting certificates without visiting the office. | Explain the member portal and how to sign in. |

**Design for the committee leader first.** If a 55-year-old Mahallu secretary understands the page on their phone, everyone else will too.

---

## 4. Brand

### Name
**ZAAD** stands for **Z**enith of **A**dministration **A**nd **D**evelopment.

Optional brand story (**Confirm** with the owner before using): *zād* (زاد) is Arabic for "provision": what you carry for a journey. It appears in a well-known Qur'anic phrase about the best provision. It is a good fit for a product that equips a community, but the owner should approve its use.

### Logo
Files in the repo:

| File | What it is | Use |
|---|---|---|
| [mahallu-cms/public/logo.png](../mahallu-cms/public/logo.png) | Full wordmark: mark + "ZAAD" + tagline, transparent background, 2022×778 | Header, footer, hero |
| [mahallu-cms/public/icon.png](../mahallu-cms/public/icon.png) | Square mark on a white rounded tile, 256px | App icon, small spaces |
| [mahallu-cms/public/favicon.png](../mahallu-cms/public/favicon.png) | High-res square mark | Favicon, social cards |
| `mahallu-cms/public/Logo-512x512.png`, `Icon-512x512.png` | Older 512px versions | Check before using; may be outdated |

**What the mark looks like:** a mosque dome / arch outline in a green gradient (bright lime on the left to deep forest green on the right), with a stylised **"Z"** inside it and a **gold dot** above the Z. The wordmark "ZAAD" is set in a heavy, rounded geometric sans in deep green.

Notes for the designer:
- The small tagline under the wordmark in `logo.png` is not legible at web sizes. Reset the tagline in live type next to the logo instead.
- The wordmark is dark green on transparent. On dark backgrounds, place it on a white chip (this is what the app does) or ask for a reversed version (**Confirm** whether one exists; if not, it is worth making one).
- The arch shape in the mark is a strong graphic motif. Use it for image masks, section dividers or card shapes.

### Colours

The app itself uses these values. Keep the landing page consistent with them so the jump from website to product feels seamless.

| Role | Hex | Where it comes from |
|---|---|---|
| Primary green | `#298959` | Main UI colour: buttons, active states |
| Deep green | `#15603B` | Accent text in the app; close to the wordmark colour |
| Wordmark green | eyedrop from `logo.png` (around `#0E5A3A`) | Logo |
| Lime highlight | eyedrop from the mark (bright yellow-green) | Logo gradient: use sparingly as a highlight |
| Gold | `#EAB308` (app); the logo dot is a warmer gold, so eyedrop it | Accent, the gold dot. Use for small highlights, not large areas |
| Ink (text) | `#192024` | Body text |
| Muted text | `#5D696F` | Secondary text |
| Soft green tint | `#E9F2ED` | Tinted backgrounds, badges |
| Surface | `#F5F6F7` | Section backgrounds |
| Border | `#DEE1E7` | Lines, card borders |

The app also has a **dark mode**, so a dark landing-page variant would match the product.

### Typography
- **Manrope** (weights 400–800) is the app's typeface for headings and body. It is free on Google Fonts.
- **Noto Sans Malayalam** is paired with it for Malayalam text. If the page will have Malayalam copy (see section 12), use this pairing so both scripts sit well together.

### Personality
Calm, trustworthy, organised, warm. Think "well-run community office", not "flashy tech startup". Respectful of faith without being decorative or preachy.

---

## 5. Key messages

Use these as the backbone of the page. Copywriters can rephrase; the meaning should stay.

1. **Everything about your Mahallu, in one place.** Families, members, dues, certificates, welfare, accounts and reports, with no more scattered registers.
2. **Know every family.** A complete, up-to-date record of every household, built from a structured field survey.
3. **Transparent finances the community can trust.** Proper double-entry accounts, receipts and year-end statements.
4. **No deserving family left behind.** Welfare and Zakat are tracked from application to distribution.
5. **Certificates in minutes, verifiable by anyone.** Nikah, death and NOC certificates carry a QR code that anyone can scan to check they are genuine.
6. **Built for real Mahallu committees.** Works on a phone, signs in with a one-time code on your phone number, and sends reminders on WhatsApp.
7. **Private by design.** Each person sees only what their role allows. Sensitive records are locked to named people.
8. **See how your Mahallu is doing.** An annual "State of the Mahallu" report and a Development Index score across 12 areas of community life.

### Taglines already in the product spec
- "Connecting Families. Strengthening Faith. Serving the Community."
- "Know Every Family. Serve Every Need. Develop the Community."

### Hero headline options
- *Know every family. Serve every need.*
- *Your whole Mahallu, in one place.*
- *The digital office for your Mahallu.*
- *From paper registers to a Mahallu that runs itself.*

Current copy on the app's sign-in screen, for tone reference: "A cleaner control center for your Mahallu operations."

---

## 6. What the product does (feature inventory)

This is grouped into **pillars** that work as landing-page sections. Everything in this section is **built and available today**, unless it is marked otherwise.

### Pillar 1: Know every family
- **Family records:** every household gets a unique Family ID, with house name and number, address (ward, area, district, PIN), head of family, contact details and Varisangya grade (A–D).
- **Member records:** every person, with age, gender, relationship, education, occupation, blood group, health and economic status. Members are never hard-deleted, so history is kept.
- **Approval flow:** families entered by field volunteers stay pending until the committee approves them.
- **Field survey and demographics:** a structured survey of the whole Mahallu (households, population, age groups, students, employment, widows, orphans, people with disabilities and more), with reminders when a re-survey is due.
- **Locality facilities:** a map of nearby schools, hospitals, institutions and other facilities.
- **Clusters:** the Mahallu can be split into small groups of 10–15 households, each with a coordinator team that visits families and keeps data fresh.
- **Community registers, generated automatically from family data:** Zakat payers, Zakat beneficiaries, job seekers, skilled workers, students and marriageable members.

### Pillar 2: Registrations and certificates
- **Nikah (marriage) registration**, **death registration**, **Nikah NOC** and **common NOC**.
- **Marriage assistance** applications.
- **Certificates are issued as PDFs with a certificate number and a QR code.** Anyone can scan the QR code, or enter the number on a public verification page, to confirm it is genuine. *This is a strong visual moment for the page.*
- **Change requests:** members ask for corrections to their own records and the committee approves them.
- Members can **apply for an NOC, register a nikah or report a death** from their own portal.

### Pillar 3: Collections and finance
- **Varisangya (membership dues)** per family or per member, with dues tracking and collection history.
- **Zakat collection.**
- **Collection reminders**, including via **WhatsApp**.
- **PDF receipts and invoices.**
- **Full double-entry accounting** for the Mahallu: accounts, ledgers, categories, day book, trial balance, balance sheet, ledger report, income and expenditure, and a consolidated report.
- **Separate books for each institute** (madrasa and so on), each with the same set of reports.
- **Petty cash and wallets.**
- **Members submit payments with proof**, and the committee approves or rejects them. *Note: there is no built-in online card or UPI payment gateway yet. Don't design "Pay now with card" flows.* (**Confirm** if this is planned.)

### Pillar 4: Welfare and Zakat
- **Welfare applications** from families, with verification and approval.
- **Welfare schemes** the Mahallu runs (for example monthly support, medical help, education help).
- **Zakat management:** payers, beneficiaries and distribution records.
- **Emergency relief** cases: application, verification, approval and follow-up.

### Pillar 5: Mosque and governance
- **Mosque profile:** capacity, facilities, Imam, Mu'azzin, Khateeb and staff.
- **Mahallu committee with office bearers**, plus other **committees** (Zakat, education, welfare and so on), with members, roles and terms.
- **Meetings:** agenda, minutes, decisions and attendees.
- **Programs and events.**
- **Assets** register.
- **Community development projects:** roads, water, sanitation, facilities, with cost, funding, progress and completion.
- **Cemetery (Qabaristan) records:** graves, the deceased, burial location and family details.
- **Health:** blood donor directory, medical camps and health resources.
- **Inheritance case tracking.** It records cases and refers them to qualified scholars; it does not issue rulings.

### Pillar 6: Institutes and education
- **Institutes** (madrasa, schools, other bodies) with their own **staff** and **salary** management.
- **Scholarships** and **academic support** programs.

### Pillar 7: Communication
- **Announcements.**
- **Push notifications** to members, to everyone or to targeted groups, with a sent history.
- **Banners and community feeds** that members see in their portal.
- **WhatsApp** for sign-in codes and dues reminders.
- **Support tickets** from members.

### Pillar 8: Insight and reports
- **Dashboard** with community and finance snapshots at a glance.
- **Reports:** demographics, area-wise, blood bank, orphans, welfare, education, community, and **data quality** (which records are incomplete).
- **Annual "State of the Mahallu" report:** population, education, finance, welfare, Zakat, programs and achievements in one document, ready for the annual general meeting.
- **Mahallu Development Index:** a single score built from **12 areas**: Family Data, Worship, Education, Welfare, Zakat, Economy, Youth, Women, Health, Finance, Governance and Community. It shows where the Mahallu is strong and what to improve. *This is a signature feature. A radar or wheel chart of the 12 areas makes a memorable hero or section visual.*
- **AI Assistant:** committee admins can ask questions in plain language, such as *"How many families need financial assistance?"* or *"What were our welfare expenses last year?"* It answers only from that Mahallu's own data, and only data the user is allowed to see. (**Confirm** whether to market this as "new" or "beta".)

### Pillar 9: Member portal (for families)
- **Sign in with your phone number** using a one-time code. No password to remember.
- See your **profile** and your **family**.
- See your **Varisangya** and **payment history**, and submit payments.
- Track your **requests** and download your **NOCs and certificates**.
- **Apply** for an NOC, register a nikah or report a death without visiting the office.
- If you are the **head of the family**, you can manage your family's details.
- Receive **notifications** and see **community feeds**.

### Pillar 10: Security and privacy
- **Five roles**, each seeing only what it needs:
  - **Super Admin:** runs the platform across many Mahallus
  - **Mahallu Admin:** the committee
  - **Survey User:** field volunteers who collect family data
  - **Institute User:** madrasa or institute accountants
  - **Member:** families, who see only their own records
- **Sensitive records are locked down.** Welfare, health, inheritance and similar records are visible only to people specifically granted access.
- **One-time-code sign-in** and an optional **two-factor login** setting.
- **Activity logs:** every important action is recorded.
- **Each Mahallu's data is fully separated** from every other Mahallu's.

### Pillar 11: Works for every kind of mosque, and for many at once
- When a Mahallu registers it picks a type: **Fully Functional Mahallu**, **Partially Functional Mahallu**, **Urban Mosque** or **Musalla / Prayer Space**.
- **Modules can be switched on or off per Mahallu** (27 modules), so a small musalla isn't overwhelmed and a large Mahallu gets everything.
- **One account can manage many Mahallus.** The long-term vision grows from one Mahallu to a district to a state-level network, with only anonymised insights shared upwards and never individual family data.

### Built but not yet launched (don't feature as available)
These modules exist in the system but are **hidden in the current version** by decision of leadership. Either leave them off the page or show them in a clearly labelled **"Coming soon"** strip. (**Confirm** which.)

- Qard Hasan (interest-free loans)
- Employment and economic development (job seekers, vacancies, skills training)
- Youth volunteer wing (Janazah help, patient transport, emergency response)
- Religious services (Khutbah archive, Khateeb database)
- Counselling (marriage, family, career, with confidential case handling)
- Maslahat (dispute resolution and family reconciliation)
- Library and reading room
- Madrasa classes, attendance and exams

---

## 7. Suggested page structure

This is a recommendation, not a rule. Order sections by what a committee leader needs to hear first.

1. **Header:** logo, links (Features · For members · Security · FAQ), a secondary **Sign in** button and a primary **Request a demo** button.
2. **Hero:** headline, a one-line subhead, the primary CTA, and a product visual: dashboard on a laptop with the member portal on a phone beside it.
3. **The problem, before and after:** paper registers, notebooks and WhatsApp chaos on one side; one organised system on the other. Short and visual.
4. **Pillars overview:** 6–8 cards (icon, title, one line each) drawn from section 6.
5. **Feature deep-dives**, as alternating image and text rows. Pick the strongest:
   - Know every family (family profile and survey)
   - Varisangya and transparent accounts (collections and balance sheet)
   - Certificates you can verify (certificate PDF with QR, plus the verification screen)
   - Welfare and Zakat (application to distribution)
   - State of the Mahallu and the Development Index (the 12-area chart)
   - AI Assistant (a question and its answer)
6. **Who uses ZAAD:** the five roles as simple cards or a diagram.
7. **For families:** member portal on a phone, with the 3–4 things members can do.
8. **Security and privacy:** short, reassuring, with concrete points from Pillar 10.
9. **Fits every mosque:** the 4 Mahallu types plus "switch modules on as you grow".
10. **How to get started:** 3 steps. Suggested: *Register your Mahallu → Add your families (survey) → Go live and invite members.* (**Confirm** the real onboarding process.)
11. **Coming soon** (optional): the roadmap modules.
12. **FAQ** (see section 9).
13. **Final CTA band:** "Bring your Mahallu online" with **Request a demo**, plus WhatsApp contact if available.
14. **Footer:** logo, tagline, contact, links, member sign-in, company name.

### Calls to action
- **Primary:** Request a demo / Talk to us (WhatsApp is likely the most natural channel for this audience; **Confirm**)
- **Secondary:** Sign in (to the app)
- **Members:** "Member? Sign in with your phone number"

---

## 8. Visual and imagery guidance

**Do**
- **Show the real product.** Clean screenshots or mockups of the actual app are the most convincing thing on the page. List of screens to capture is below.
- Use the **arch shape from the logo** as a recurring motif (image masks, frames, section shapes).
- Use **Islamic geometric patterns**, subtly, as texture: low contrast, in the green tints.
- Prefer **Kerala context**: Kerala mosque architecture (sloped tiled roofs, white and green mosques, coconut palms), local village settings. This should feel like home to a Kerala Mahallu, not like a generic Gulf skyline.
- Design **mobile-first**. Most of this audience will open the page on a phone, often from a WhatsApp link.
- Keep text large and contrast high, since many readers are older.

**Avoid**
- Desert, camel and generic "Arabian" clichés.
- Qur'anic verses, the name of Allah or other sacred text used as decoration or filler.
- Stock photos of people that feel foreign to Kerala. If you show people, keep them in modest dress, in a Kerala setting, and get sign-off from the owner. Illustration, hands, architecture or silhouettes are safer choices.
- **Real member data in mockups.** Never use real names, phone numbers or family details from the live system. Use clearly fictional demo data.
- Overpromising: no "online card payments" and no "SMS and email campaigns" (these aren't built), and no hidden modules shown as available.

### Screens worth capturing for mockups
Capture these with demo data:
1. Admin dashboard (community and finance snapshots)
2. Families list and a single family profile
3. Varisangya / collections screen
4. Balance sheet or income and expenditure report
5. A Nikah or death certificate PDF, showing the QR code
6. The public certificate verification page (`/verify/<certificate-no>`)
7. Development Index (12-area chart)
8. Annual "State of the Mahallu" report
9. AI Assistant: a question with its answer
10. Member portal on a phone: dashboard, payments, certificates
11. Sign-in screen with the phone-number one-time code

---

## 9. FAQ content (draft)

- **Is our data safe?** Each Mahallu's data is kept fully separate. People see only what their role allows, sensitive records are restricted to named people, and every important action is logged.
- **Who can see welfare or health records?** Only users the committee has specifically given access to.
- **Does it work on a phone?** Yes. The whole system works on a phone, a tablet or a computer.
- **Do members need a password?** No. Members sign in with their phone number and a one-time code.
- **Can we use it for more than one mosque?** Yes. One account can manage many Mahallus, each with its own data and settings.
- **We're a small mosque. Is it too much for us?** No. Choose your mosque type and switch on only the modules you need.
- **Can members pay online?** Members can submit their payments with proof, and the committee approves them. (**Confirm** wording and any gateway plans.)
- **Is it available in Malayalam?** **Confirm.** The app's fonts support Malayalam text, but confirm whether the interface itself is translated.
- **Is there a mobile app?** **Confirm.** The web app is fully mobile-friendly and has push notifications. Check whether a store app exists.
- **How much does it cost?** **Confirm.**

---

## 10. Glossary

Use these terms on the page as the community uses them, and add a short explanation the first time each appears if the page is meant for wider audiences.

| Term | Meaning |
|---|---|
| **Mahallu** | The local Muslim community attached to a Juma Masjid, like a parish |
| **Juma Masjid** | Mosque where Friday congregational prayer is held |
| **Musalla** | A smaller prayer space without Friday prayer |
| **Varisangya** | Regular membership dues each family pays to the Mahallu |
| **Nikah** | Islamic marriage |
| **NOC** | No Objection Certificate, e.g. when a member marries in another Mahallu |
| **Zakat** | Obligatory annual charity |
| **Sadaqah** | Voluntary charity |
| **Qard Hasan** | Interest-free loan |
| **Qabaristan** | Burial ground |
| **Janazah** | Funeral prayer and rites |
| **Madrasa** | Religious school |
| **Khateeb / Khutbah** | Preacher / Friday sermon |
| **Imam / Mu'azzin** | Prayer leader / caller to prayer |
| **Maslahat** | Reconciliation and dispute settlement |

---

## 11. Facts you can safely quote

These numbers come from the product itself. Don't invent user counts, Mahallu counts or testimonials. Ask the owner for real ones.

- **27** switchable modules
- **5** user roles
- **12** areas in the Mahallu Development Index
- **4** mosque types supported
- **3** certificate types (Nikah, death, NOC), each verifiable by QR code
- Clusters of **10–15** households

---

## 12. Open questions for the product owner

Please resolve these before final design:

1. **CTA and contact:** demo form, WhatsApp number, phone or email? Which is primary?
2. **Pricing:** show it, show "contact us", or leave it out?
3. **Social proof:** how many Mahallus use ZAAD today? Any committee testimonials, or logos of partner bodies?
4. **Company:** what name, address and legal entity go in the footer?
5. **Domain and sign-in URL** for the "Sign in" button.
6. **Language:** English only, or English plus Malayalam?
7. **Mobile app:** is there a Play Store or App Store app to link to?
8. **Hidden modules:** leave them off the page, or show a "Coming soon" strip?
9. **Online payments:** is a payment gateway planned? This changes the copy.
10. **Brand assets:** is there a vector (SVG) logo and a reversed (light-on-dark) version?
11. **"Zaad = provision" story:** approved for use?
12. **AI Assistant:** market it as "new", "beta", or not yet?

---

*Prepared from the product's source code and functional specification. Source spec: [mahallu-cms/MUSLIM_MAHALLU_MANAGEMENT_ERP_Detailed.md](../mahallu-cms/MUSLIM_MAHALLU_MANAGEMENT_ERP_Detailed.md).*
