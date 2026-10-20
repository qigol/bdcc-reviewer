# Animations: Competitive Strategy

## economies-of-scale
- Where: intuition › getting-cheaper › beats 1–3 (stage widget `anim`, region top)
- Idea: a fixed cost spread over more units makes each unit cheaper.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–0.8 s: a big coral block "Fixed cost $20,000" (rent and machine icons on its face); a row of gold product boxes waits on a conveyor.
  - 0.8–2.0 s: the block slices; one slice flies onto each box, on top of a small teal $5 base; a gauge reads $25 per unit.
  - 2.0–4.0 s: the conveyor speeds up and more boxes pour in (the counter rolls to 4,000); the slices shrink and the gauge swings down to $10; a small cost curve draws itself, sloping down.
  - 4.0–5.0 s: hold on the long row of boxes with paper-thin slices.
- On-screen words: "Fixed cost $20,000", "units", "per unit", "cost per unit"
- Numbers: $20,000 · $5 · 1,000 → 4,000 units · $25 → $10 (averageCost)
- Must not show: the $25 average cost while the beat-1 predict gate is open: beat 1 plays only 0–0.8
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 1 plays 0–0.8, beat 2 plays 0.8–5; hidden from beat 4
- Source: `animations/clips/competitive-strategy/economies-of-scale.html` · render and convert with `pnpm anim:render economies-of-scale`

## value-creation-and-chain
- Where: intuition › creating-value › beats 1–2 and 5–6 (stage widget `anim`, region top)
- Idea: value created is willingness to pay minus cost, price splits it, the value chain builds it, and cost leadership or differentiation widens it.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.0 s: a dollar column rises; three lines pop: "Cost $50", "Price $70", "Willing to pay $100". "Cost, price and what buyers will pay". No gap.
  - 1.0–2.2 s: a gold bracket from 50 to 100, "Value created $50"; it splits into a teal block, "Customer keeps $30", and a gold one, "Firm keeps $20". "Price splits the value created".
  - 2.2–3.5 s: pan: chevrons Design → Make → Market → Serve on a "Support · people, systems, buying" bar; a gold line grows beneath, "more value at each step". "The value chain · steps that add value".
  - 3.5–5.0 s: back to the column: a teal arrow pushes cost down ("Cost leadership · lower cost"), a gold arrow lifts willingness to pay ("Differentiation · more value"); a "Bigger gap" bracket stretches. "Two ways to widen the gap".
- Numbers: the scene's (100, 70, 50 → 50, 30, 20)
- Must not show: 50 during beat 1 (its predict)
- Segments: beat 1 plays 0–1, beat 2 sets 1–2.2 (its slider task asks for a price where the firm keeps 30), hidden on beats 3–4 (the "Competing across borders" callout), beat 5 shows 2.2–3.5, beat 6 sets 3.5–5, hidden from beat 7
- Source: `animations/clips/competitive-strategy/value-creation-and-chain.html`

## four-strategies-grid
- Where: intuition › pick-a-strategy › beats 1–5 (stage widget `anim`, region top)
- Idea: cost pressure and pressure to adapt together pick one of four strategies.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–0.6 s: axes and four empty cells: "Cost pressure" low → high up the side, "Pressure to adapt" low → high along the bottom.
  - 0.6–1.4 s: bottom-left lights teal: a product copied from home to abroad. "Home replication".
  - 1.4–2.2 s: bottom-right lights violet: three differently shaped products. "Multidomestic".
  - 2.2–2.8 s: a "?" badge pulses in the top-left cell. No name.
  - 2.8–3.8 s: the top-left lights gold: one product around a globe. "Global".
  - 3.8–5.0 s: the top-right lights coral: a core product linked both ways to local variants. "Transnational"; hold.
- Numbers: none
- Must not show: the word "Global" before beat 5 (beat 4 asks which strategy fits high cost, low adapt)
- Segments: beat 1 plays 0–0.6, beat 2 sets 0.6–1.4, beat 3 sets 1.4–2.2, beat 4 sets 2.2–2.8, beat 5 sets 2.8–5 (the narration names transnational there too), hidden from beat 6
- Source: `animations/clips/competitive-strategy/four-strategies-grid.html`

## scenarios-and-planning
- Where: intuition › imagining-futures › beats 1–4 (stage widget `anim`, region top)
- Idea: actions that fit every scenario are safe bets; plans travel top-down, bottom-up, or round and round until they agree.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.3 s: from a "Today" dot three paths (Boom, Steady, Downturn) fill with their action chips from the scene's dataset, all pale blue. "Three scenarios for the restaurant chain".
  - 1.3–2.6 s: "Hire local managers" and "Keep cost focus" turn gold on all three paths; "2 in every story"; a dashed branch leads to a "Contingency plan" whose switch flips. "Moves that fit every story".
  - 2.6–3.8 s: pan: a firm as boxes (top, middle, units); a coral arrow down ("Top-down"), a teal arrow up ("Bottom-up"). "Which way does the plan travel?".
  - 3.8–5.0 s: a gold dot circles the firm twice along a dashed loop: "Iterative · round again until it fits"; hold.
- Numbers: 2 (the count of shared actions), from beat 2 on
- Must not show: which actions are shared, or the count, during beat 1 (its predict)
- Segments: beat 1 plays 0–1.3, beat 2 sets 1.3–2.6, beat 3 sets 2.6–3.8, beat 4 sets 3.8–5, hidden from beat 5
- Source: `animations/clips/competitive-strategy/scenarios-and-planning.html`
