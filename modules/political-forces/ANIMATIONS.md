# Animations: Political Forces That Affect Global Trade

## nationalization
- Where: intuition › economic-systems › beats 3–4 (stage widget `anim`, region top)
- Idea: a government can move a firm along the line from private to state ownership, and back.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–0.8 s: a glowing track, teal PRIVATE end left, violet GOVERNMENT end right; a factory pops in near the left, smoke puffs bob; a worker in a teal cap waves from its door.
  - 0.8–2.2 s: a violet hand-crane swoops down, grabs the factory and drags it right; the factory turns violet; the cap swaps to a violet one with a star badge. Label "Nationalization".
  - 2.2–2.6 s: hold; the factory wobbles into place at the government end.
  - 2.6–4.3 s: a stack of gold coins drops onto the track; the factory rides it back left, turning teal; a teal buyer with a briefcase catches the keys. Label "Privatization".
  - 4.3–5.0 s: hold; the camera eases out to show the whole track (most countries sit in between).
- On-screen words: "PRIVATE", "GOVERNMENT", "Nationalization", "Privatization"
- Numbers: none
- Must not show: which reasons belong to nationalizing or privatizing (the sorter on beat 4 asks for that)
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 3 plays 0–2.6 (`animFrom`/`animTo` in scene state), beat 4 sets 2.6–5, hidden from beat 5
- Source: `animations/clips/political-forces/nationalization.html` · render and convert with `pnpm anim:render nationalization`

## tariff-mechanisms
- Where: intuition › tariffs › beats 1–4 and 6 (stage widget `anim`, region top)
- Idea: the three ways to charge a tariff, shown on one shipment, then a variable levy that holds the price on a line.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–0.6 s: a teal crate of 500 chairs rolls up to a violet customs arch; label "$10,000 of chairs".
  - 0.6–1.2 s: a gold value bar ($10,000) appears; its coral 10% top slice is cut off and flies through customs. Label "Ad valorem · 10% of value = $1,000".
  - 1.2–2.6 s: six chairs pop up on the crate and a coral $2 coin lands on each ("Specific · $2 per chair"); then two coral blocks, "10% of value" and "$2 × each chair", stack on the crate ("Compound · both together").
  - 2.6–3.0 s: hold. No total.
  - 3.0–4.3 s: the camera pans to a chart. A teal world-price bar bobs 320 → 340 → 300 under a dashed $350 support line; a coral levy (a spring) on top stretches 30 → 10 → 50 so the top never moves. Label "Variable levy · locks the price at $350".
  - 4.3–5.0 s: hold on "World $300 + Levy $50 = $350".
- Numbers: the scene's (500 chairs, $10,000, 10%, $2 a chair, world $300, support $350)
- Must not show: the compound total, 2,000 (the beat-4 predict)
- Segments: beat 1 plays 0–0.6, beat 3 sets 0.6–1.2, beat 4 sets 1.2–3.0, hidden on beat 5 (rate task), beat 6 shows 3.0–5.0 next to the live `lev` readout and world-price slider, hidden from beat 7
- Source: `animations/clips/political-forces/tariff-mechanisms.html`

## non-tariff-barriers
- Where: intuition › other-barriers › beats 1–4 and 6–7 (stage widget `anim`, region top; replaces the old "Beyond tariffs" note)
- Idea: one quick picture per tool that keeps goods out without a tariff, then the dumping test and the duty that answers it.
- Length: 6 s, no loop · Shape: 16:9 · Background: the shared sky; the camera pans one panel per beat
- Storyboard:
  - 0.0–1.0 s: a gold crate rolls to the border; a striped barrier drops with a ban sign and the crate bounces back. "Import ban · not allowed in".
  - 1.0–2.0 s: a violet government hand drops coins under a teal home factory; its coral cost bar shrinks. "Subsidy · lowers home costs".
  - 2.0–3.2 s: crates pass a post; a counter ticks "Quota 0/3" → "3/3" and a violet gate shuts in front of the fourth. "Quota · caps the quantity".
  - 3.2–4.0 s: a dashed car frame; three teal home gears and one gold foreign gear spin into place. "Local content · use home-made parts".
  - 4.0–4.8 s: an exporter with a crate and three price bars: Home 100, Cost 95, Export 90. No verdict.
  - 4.8–6.0 s: a coral ring on Export 90, "Dumping · below cost and home price"; a violet subsidy coin drops to the exporter; a coral "+ duty" block lands on the export bar, lifting it to 100. Pill "Subsidized? A countervailing duty cancels the help".
- Numbers: the scene's (export 90, home 100, cost 95)
- Must not show: the dumping verdict before beat 7 (beat 6 asks "Is the firm dumping?"); anything while the sorter is open
- Segments: beat 1 plays 0–1, beat 2 sets 1–2, beat 3 sets 2–3.2, beat 4 sets 3.2–4; the sorter moved to a new beat 5 ("Now sort the tools you have met.") that hides the clip; beat 6 shows it again with 4–4.8, beat 7 sets 4.8–6
- Source: `animations/clips/political-forces/non-tariff-barriers.html`

## infant-industry
- Where: intuition › economic-reasons › beats 1–2 (stage widget `anim`, region top; replaces the old reasons note)
- Idea: a temporary shield lets a young industry grow until it can face imports on its own.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–0.9 s: a small teal home factory with a tall coral cost bar; across a dashed border a big gold factory with a short one; a cheap gold crate arcs into the home market. "A young firm · high costs, cheap imports".
  - 0.9–1.9 s: a violet glass dome drops over the home factory; two more crates bounce off it. "An infant industry gets a shield".
  - 1.9–2.6 s: inside the dome the factory grows and its cost bar shrinks. "Time to grow · costs fall". The dome stays up.
  - 2.6–3.6 s: a "1st" flag pops on the big factory ("First movers start ahead"); the home factory reaches full size and its cost bar matches.
  - 3.6–4.3 s: the dome lifts away. "Then the shield comes off".
  - 4.3–5.0 s: a crate arrives and the home factory holds its ground. Pill "Competes on its own".
- Numbers: none (the scene has none)
- Must not show: the shield coming off before beat 2 (beat 1 asks whether protection is temporary); the "stays inefficient" risk (beat 4's reflect)
- Segments: beat 1 plays 0–2.6, beat 2 sets 2.6–5, hidden from beat 3
- Source: `animations/clips/political-forces/infant-industry.html`
