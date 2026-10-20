# Animations: The International Monetary System

## gold-to-floating
- Where: intuition › from-gold-to-floating › beats 2–7 (stage widget `anim`, region top)
- Idea: money went from being tied to gold, to gold plus the dollar, to rates set by the market.
- Length: 6 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–1.8 s: a huge glowing gold bar at the top; coins of different colours hang from it on chains, swaying in sync. Label "Gold standard".
  - 1.8–3.6 s: the chains re-hook onto one big green $ coin that hangs from the gold bar on a single thick chain; the camera pushes in on that chain. Label "Bretton Woods · 1944".
  - 3.6–4.4 s: the thick chain strains and cracks with a burst of particles; a "1971" stamp slams in.
  - 4.4–5.4 s: the coins drop onto a softly rolling sea and bob at different heights, each on its own rhythm. Label "Floating".
  - 5.4–6.0 s: hold; the gold bar drifts up out of frame.
- On-screen words: "GOLD", "Gold standard", "Bretton Woods · 1944", "1971", "Floating"
- Numbers: dates only (1944, 1971)
- Must not show: the answer to the Triffin predict gate (a deficit)
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 2 plays 0–1.8, beat 4 plays 1.8–3.6, beat 7 plays 3.6–6
- Source: `animations/clips/monetary-system/gold-to-floating.html` · render and convert with `pnpm anim:render gold-to-floating`

## four-forms-of-money
- Where: intuition › new-kinds-of-money › beats 1–4 and 6 (stage widget `anim`, region top; replaces the old "Four kinds of money" summary)
- Idea: fiat, crypto, stablecoins and CBDCs differ by who issues them and what, if anything, backs them.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky; a 2×2 world, the camera visits each quadrant and pulls back
- Storyboard:
  - 0.0–1.2 s: a violet central bank; its stamp lands on a paper note with a check seal; a gold bar beside it is struck out. "Fiat · government money, no gold behind it".
  - 1.2–2.4 s: five glowing nodes link into a network; blocks chain along the bottom; a coral price line zigzags. "Cryptocurrency · code and a network".
  - 2.4–3.6 s: a gold "S" coin chained "1 : 1" to a vault of dollar notes; a flat teal price line. "Stablecoin · pegged to something steady".
  - 3.6–4.4 s: the central bank beams a violet digital coin into a phone wallet. "CBDC · the central bank's digital money".
  - 4.4–5.0 s: pull back to all four quadrants with name tags; hold.
- Numbers: none
- Must not show: the four-panel overview while beat 4's predict is open (which is not centrally controlled), or anything while the sorter is open (beat 5)
- Segments: beat 1 plays 0–1.2, beat 2 sets 1.2–2.4, beat 3 sets 2.4–3.6, beat 4 sets 3.6–4.4, hidden on beat 5 (sorter), beat 6 (reflect) shows the overview 4.4–5
- Source: `animations/clips/monetary-system/four-forms-of-money.html`

## arbitrage-and-ppp
- Where: intuition › why-prices-differ › beats 1–3 (stage widget `anim`, region top; beside the "One product, two markets" callout)
- Idea: when the same good costs less in one market, traders buy there and sell in the other until the prices meet again.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.2 s: New York and Manila skylines; two price bars rise level, each topped by a phone: "$500" and "₱25,000 = $500", with "₱50 = $1" below and "=" between. "Law of one price · same phone, same price".
  - 1.2–2.0 s: the New York bar drops and its tag counts to $450; a gold "$50 gap" bracket. "New York drops to $450".
  - 2.0–3.9 s: boats carry phones from New York to Manila; "+$50" pops at each arrival; the bars creep together and the gap closes. "Arbitrage · buy cheap, sell dear".
  - 3.9–5.0 s: level again, "="; "The gap closes"; hold.
- Numbers: the scene's (₱25,000, $500, $450, ₱50 per $1); the meeting price is not labelled
- Must not show: traders before beat 3 (beat 2 asks what traders will do)
- Segments: beat 1 plays 0–1.2, beat 2 sets 1.2–2, beat 3 sets 2–5, hidden from beat 4 (inflation readout and slider)
- Source: `animations/clips/monetary-system/arbitrage-and-ppp.html`

## vat-credit-chain
- Where: intuition › governments-step-in › beats 4–5 (stage widget `anim`, region top)
- Idea: each stage charges VAT on its sale and deducts the VAT already paid on its inputs, so the government collects the rate times the final price.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.3 s: supplier, factory and shop in a row; a violet "Government 0" jar below. The supplier "Sells at 100"; a coral "12" coin drops in (12). "Stage 1 · 12% of 100 = 12".
  - 1.3–2.6 s: the crate hops to the factory, "Sells at 150"; "12% of 150 = 18" and a "credit −12" voucher. Pause, no net. "Stage 2 · owes 18, minus the 12 already paid".
  - 2.6–3.3 s: a "6" coin drops in (18). "Each stage pays only on the value it adds".
  - 3.3–4.2 s: the crate hops to the shop, "Sells at 250"; "12% of 250 = 30", "credit −18"; a "12" coin drops in (30).
  - 4.2–5.0 s: "12 + 6 + 12 = 30 = 12% of 250"; hold.
- Numbers: the scene's (12%, 100 → 150 → 250; 12, 6, 12; 30)
- Must not show: the factory's net 6 during beat 4 (its predict)
- Segments: hidden on beats 1–3; beat 4 shows 0–2.6, beat 5 sets 2.6–5 (its slider task asks for a total of 50), hidden from beat 6
- Source: `animations/clips/monetary-system/vat-credit-chain.html`
