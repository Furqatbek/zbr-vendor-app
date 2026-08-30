# AI Designer Prompt — Google Play Promo Screenshots

Prompts for generating the Play Store screenshot set for **ZBR Owner**
(`uz.zbr.vendor`), plus the exact Play Console specs each asset must meet.

> **These are marketing frames built *around* real screenshots — not
> replacements for them.** Google requires screenshots to show actual in-app
> content. Capture the real screens first (`docs/PLAY_SUBMISSION.md` §5 lists
> which), then use these prompts to design the surrounding frame, headline and
> background. Generating a fake UI and passing it off as the app is a
> misrepresentation takedown risk.

---

## 1. Required sizes — Play needs BOTH phone and tablet

| Slot | Required | Recommended size | Orientation |
|---|---|---|---|
| **Phone** | **2–8** (mandatory) | **1080 × 1920** | Portrait |
| **7-inch tablet** | up to 8 | **1200 × 1920** | Portrait |
| **10-inch tablet** | up to 8 | **1600 × 2560** | Portrait |

Hard constraints for every image:
- PNG or JPEG, **no alpha channel**
- Each side between **320 px and 3840 px**
- Longest side **at most 2×** the shortest side
- Max **8 MB** per image

**All portrait.** The app is locked to portrait (`orientation: "portrait"` in
`app.json`), so landscape tablet frames would misrepresent it.

⚠️ **Supply the tablet sets.** Without 7" and 10" screenshots the listing is
still publishable, but Play will not surface the app properly on tablets and
Chromebooks, and the listing shows stretched phone art to those users. Produce
at least 4 for each tablet slot.

---

## 2. Brand kit (give this to the model verbatim)

```
BRAND: ZBR Owner — restaurant partner app for the ZBR delivery platform (Uzbekistan)

Logo mark: angular geometric "Z" built from three orange shards — a slanted
top bar, a thin rising diagonal, and a slanted bottom bar. Flat, no gradient,
no outline, no drop shadow.

Colours:
  Brand dark      #17140F   (promo backgrounds, icon tile)
  Brand orange    #FF6B00   (logo mark, promo accents)
  App accent      #FF5A1F   (accent INSIDE app screenshots — slightly different
                             from the logo orange; do not "correct" it)
  App surface     #FFFFFF   cards
  App background  #F9FAFB   screen background
  Text primary    #000000
  Text secondary  #6B7280
  Success         #22C55E   Ready / paid states
  Warning         #F59E0B   Preparing state
  Danger          #EF4444   Cancelled / decline

Typography: clean geometric sans (Work Sans, Inter, or similar). Headlines
bold and tight. No script, no serif, no outlined or 3D type.

Tone: professional operational tool for a busy kitchen. Confident and calm.
NOT a consumer food-delivery ad — no photos of food, no appetite appeal, no
smiling stock-photo people, no confetti, no 3D renders.
```

---

## 3. Master prompt (frame template)

Paste this, then append one "SCREEN" block from §4.

```
Design a Google Play Store screenshot for an Android business app.

CANVAS: 1080 x 1920 px, portrait, flat PNG, no transparency.
[for 7" tablet use 1200 x 1920 — for 10" tablet use 1600 x 2560]

LAYOUT (strict):
- Solid background #17140F filling the whole canvas.
- A thin vertical #FF6B00 bar, 10 px wide, flush to the left edge.
- Headline in the TOP 22% of the canvas: bold geometric sans, white,
  2 lines maximum, left-aligned with a 90 px left margin. Large and legible
  when the image is scaled to 25% of its size.
- One short supporting line under the headline in #B2B2B2, regular weight,
  about 45% of the headline size.
- A single Android phone mockup occupying the LOWER 70% of the canvas,
  centred horizontally, tilted 0 degrees (perfectly straight), with a subtle
  soft shadow. Realistic thin bezels, rounded corners, no visible brand,
  no hand holding it, no desk, no background scene.
- The phone screen is a placeholder rectangle of #F9FAFB where a real app
  screenshot will be composited. Do NOT invent app UI inside it.
- Bottom 6% of the canvas left clear.

STYLE: flat, high contrast, generous whitespace, no gradients, no glow,
no noise texture, no photographic background, no 3D perspective.
Absolutely no text other than the headline and supporting line.
Do not draw any logo, badge, star rating, award ribbon, or app-store button.
```

**Then append the SCREEN block for the frame you're generating.**

---

## 4. The screenshot set — headline + which real screen to composite

Order matters: the first two carry almost all the conversion weight, since most
users never scroll the strip.

### 1 — Never miss an order
```
SCREEN: Orders board.
HEADLINE: "Never miss an order"
SUPPORTING: "A loud alert the moment one arrives — even with the phone locked."
COMPOSITE: the Orders tab showing the New / Preparing / Ready sections with
three or four live order cards and the revenue summary at the top.
```

### 2 — Accept in one tap
```
SCREEN: Incoming order alert.
HEADLINE: "Accept in one tap"
SUPPORTING: "Confirm the order and set a prep time without leaving the kitchen."
COMPOSITE: the full-screen new-order alert with the order number, customer
name, items and the slide-to-accept control.
```

### 3 — Every order, start to finish
```
SCREEN: Order detail.
HEADLINE: "Every order, start to finish"
SUPPORTING: "Track preparing, ready, picked up and delivered at a glance."
COMPOSITE: the order detail screen showing the status stepper, the courier
card with the call button, and the itemised price summary.
```

### 4 — Your menu, always current
```
SCREEN: Menu management.
HEADLINE: "Your menu, always current"
SUPPORTING: "Edit items, variants and prices. Mark anything out of stock instantly."
COMPOSITE: the Menu tab with category tabs and item cards showing photos,
prices and in-stock toggles.
```

### 5 — Know what you earned
```
SCREEN: Reports.
HEADLINE: "Know what you earned"
SUPPORTING: "Revenue, order counts and payouts by day, week or month."
COMPOSITE: the Reports tab with the period selector, the large revenue
figure, the trend chart and the payout summary.
```

### 6 — Hear your customers
```
SCREEN: Reviews.
HEADLINE: "Hear your customers"
SUPPORTING: "Ratings and reviews for your restaurant in one place."
COMPOSITE: the Reviews tab with the average rating, the star-distribution
bars and two or three review cards.
```

### Tablet variants
Use screenshots **1, 3, 4, 5** for both tablet slots. Same headlines. Change
only the canvas size and this layout line:

```
LAYOUT OVERRIDE (tablet): canvas 1200 x 1920 (7") or 1600 x 2560 (10").
Keep the headline in the top 20%. Replace the phone mockup with a single
Android TABLET mockup in portrait, occupying the lower 72%, centred, straight,
thin bezels. Increase the left margin to 120 px. Do not place two devices
side by side and do not add a landscape device.
```

---

## 5. Language

The app ships **Uzbek (Latin), Uzbek (Cyrillic), Russian and English**.

Produce the **primary market language first** — for Uzbekistan that is Uzbek
Latin and/or Russian, not English. Play lets you upload a separate screenshot
set per listing locale, and localised screenshots measurably outperform English
ones in non-English markets.

Uzbek Latin headlines for the set above:
1. `Birorta buyurtmani o'tkazib yubormang`
2. `Bir teginishda qabul qiling`
3. `Har bir buyurtma — boshidan oxirigacha`
4. `Menyungiz doim dolzarb`
5. `Daromadingizni biling`
6. `Mijozlaringizni eshiting`

**Have a native speaker check these before publishing** — I generated them from
the app's own translation strings, but marketing copy carries nuance that
literal translation misses.

---

## 6. Play policy — what will get the listing rejected

- **No fabricated UI.** The composited screen must be the real app.
- **No Google Play branding** — no "Get it on Google Play" badge, no
  "Editor's Choice", nothing implying Google endorsement.
- **No fake ratings or awards** — no invented star ratings, "#1 app", review
  quotes, or download counts.
- **No misleading claims.** Don't headline features that don't exist. In
  particular do not promise live chat support, staff accounts, or in-app review
  replies — those are disabled in the current build.
- **No device frames implying another platform** (no iPhone notch, no iOS
  status bar) — this is the Android listing.
- **No promotional pricing or offers** in the imagery.
- Keep sensitive data out: use the **demo vendor account**, and make sure no
  real customer name, phone number or address is visible in any screenshot.

---

## 7. Checklist

- [ ] 4–6 phone screenshots at 1080 × 1920
- [ ] 4 tablet screenshots at 1200 × 1920 (7")
- [ ] 4 tablet screenshots at 1600 × 2560 (10")
- [ ] All portrait, PNG/JPEG, no alpha, under 8 MB each
- [ ] Real app content composited into every device frame
- [ ] Captured from the demo account — no real customer data visible
- [ ] Headline legible at 25% scale (the size shown in Play search results)
- [ ] Localised set uploaded per listing language
- [ ] Committed to `store-assets/` so the listing is reproducible
