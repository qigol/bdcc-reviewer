# Animations: Intellectual Property Rights and Other Legal Forces

## incoterms
- Where: intuition › shipping-terms › beats 2, 3 and 5 (stage widget `anim`, region top)
- Idea: each Incoterm moves the point where the seller's costs and risk stop, so the quoted price grows.
- Length: 6 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–0.7 s: a night port: warehouse, crane, ship at the quay, open sea; a coral container pops out of the warehouse; a coral risk orb floats above it (seller).
  - 0.7–1.6 s: a truck rolls it to the quay edge; the price counter ticks up to 19,500; label "FAS"; a dotted line drops at the quay edge.
  - 1.6–2.6 s: the crane lifts the container on deck (+500 → 20,000); the risk orb drifts to the teal buyer on the far shore and turns teal. Label "FOB · risk passes on board".
  - 2.6–4.4 s: the ship pulls away, the camera pans with it over rolling waves; freight coins arc into the hull (+2,000 → 22,000). Label "CFR".
  - 4.4–5.3 s: a violet umbrella-shield snaps open over the container (+300 → 22,300). Label "CIF".
  - 5.3–6.0 s: hold mid-ocean, the four price tags along the bottom.
- On-screen words: "PRICE", "FAS", "FOB · risk passes on board", "CFR", "CIF"
- Numbers: 19,500 · 20,000 · 22,000 · 22,300 (scene state: fob 20,000, loading 500, freight 2,000, insurance 300)
- Must not show: the CIF price (22,300) while the beat-4 predict gate is open: the sea segment plays on beat 5, after it
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 2 plays 0–2.6, beat 3 replays 0.7–1.6 (FAS stops at the quay), beat 5 plays 2.6–6; hidden from beat 6
- Source: `animations/clips/legal-forces/incoterms.html` · render and convert with `pnpm anim:render incoterms`

## three-legal-traditions
- Where: intuition › kinds-of-law › beats 1–4 (stage widget `anim`, region top; replaces the old "Three families of law" note)
- Idea: civil law runs on written codes and questioning judges, common law on precedent, religious law on a sacred source.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky; three panels, the camera dives into each and pulls back out
- Storyboard:
  - 0.0–0.6 s: far view of three small courtrooms with tags Civil, Common, Religious. "Three families of law".
  - 0.6–2.0 s: dive into the first: a violet judge at a high desk; a "CODE" book opens and glows; the judge's magnifier swings to a witness with a "?". "Civil law · written codes; the judge asks".
  - 2.0–3.4 s: pan: two advocates (teal, coral) argue in turns before a judge; folders dated 1998, 2007, 2019 stack up and a dotted arrow carries them to the judge. "Common law · earlier cases guide judges".
  - 3.4–4.45 s: pan: a scroll unrolls; on a loan contract an "Interest %" badge is struck through and replaced by "Profit sharing". "Religious law · a sacred source is the law".
  - 4.45–5.0 s: pull back to all three with their tags; hold.
- Numbers: none (the folder years are decoration)
- Must not show: anything while the sorter is open (its chips repeat these facts)
- Segments: beat 1 plays 0–0.6, beat 2 sets 0.6–2, beat 3 sets 2–3.4, beat 4 sets 3.4–5; the sorter moved to a new beat 5 ("Now sort what you have heard") that hides the clip
- Source: `animations/clips/legal-forces/three-legal-traditions.html`

## dispute-resolution-flow
- Where: intuition › settling-disputes › beats 1–4 (stage widget `anim`, region top; replaces the old "Two ways to settle" note)
- Idea: when a cross-border contract breaks, the dispute goes to court (litigation) or to a neutral decision maker outside the courts (arbitration).
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.2 s: two firms on opposite shores; a contract rises over the sea and both tick it; it glows. "A contract binds both sides".
  - 1.2–2.6 s: lightning cracks the contract; pan to a fork; a coral path runs to a courthouse; a calendar rolls Year 1 → 3 and coins pour in. Pill "Litigation · in court".
  - 2.6–4.4 s: a teal path runs to a round table of three neutral arbitrators; the clock ticks a quarter turn and an "Award" pill pops. Pill "Arbitration · outside the courts".
  - 4.4–5.0 s: a slight pull-back; hold.
- Numbers: none
- Must not show: clause names (beat 3 asks which clause names the place of a dispute); anything while the sorter is open
- Segments: beat 1 plays 0–1.2, beat 2 sets 1.2–2.6 and the clip rests there through beat 3's predict, beat 4 sets 2.6–5; the sorter moved to a new beat 5 ("Now sort the two ways of settling.") that hides the clip, which stays hidden for the CISG callout
- Source: `animations/clips/legal-forces/dispute-resolution-flow.html`

## home-and-host-law
- Where: intuition › laws-at-home › beats 1–3 (stage widget `anim`, region top; replaces the old "Four more areas" note)
- Idea: competition, injury and reporting laws all reach a firm that works abroad.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky; the camera pans between three panels
- Storyboard:
  - 0.0–1.0 s: two rival firms; their "$$$" price tags float up together and chain. "Rival firms agree on a price". No law named.
  - 1.0–1.5 s: a violet wedge drops, the chain snaps and the tags fall. "Antitrust law · stops price fixing".
  - 1.5–3.0 s: pan: a toaster sparks and a shopper jumps back ("A product causes harm"); a coral "Strict liability" stamp lands on the maker and coins slide to the shopper. "Strict liability · the maker pays, careless or not".
  - 3.0–4.6 s: pan: one ledger slides through a "US GAAP" lens and an "IFRS" lens, its bars re-sorting each time; a "Sarbanes-Oxley · stricter audits" pill under the US lens. "Reporting rules · GAAP or IFRS".
  - 4.6–5.0 s: hold.
- Numbers: none
- Must not show: the law's name during beat 1 (its predict asks which law targets price fixing)
- Segments: beat 1 plays 0–1, beat 2 sets 1–3 (antitrust answer, then strict liability), beat 3 sets 3–5, hidden from beat 4
- Source: `animations/clips/legal-forces/home-and-host-law.html`
