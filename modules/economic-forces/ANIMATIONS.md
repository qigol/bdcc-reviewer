# Animations: Economic Forces

## ppp-scale
- Where: intuition › same-money-different-baskets › beats 2–3 (stage widget `anim`, region top)
- Idea: the PPP rate is the exchange rate at which the same basket costs the same in both currencies.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–1.2 s: a rounded balance scale rises; on the left a basket fills with soap, rice, shoes, a dress and socks, tagged ฿1,865; on the right a matching basket, tagged $160.05.
  - 1.2–1.8 s: one baht bead against one dollar coin: the dollar side slams down and the goods jiggle.
  - 1.8–3.8 s: a gold "baht per dollar" dial spins up from 1; baht beads stream onto the left tray; the scale lifts toward level.
  - 3.8–4.3 s: the scale clicks level with a sparkle; the dial reads ≈ 11.65.
  - 4.3–5.0 s: hold; label "PPP rate: same basket, same price".
- On-screen words: "baht per dollar", "PPP rate: same basket, same price"
- Numbers: ฿1,865 · $160.05 · 11.65 (the basket dataset and basketPPP)
- Must not show: the rate 11.65 while the beat-2 predict gate is open: beat 2 plays only 0–1.8
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 2 plays 0–1.8, beat 3 plays 1.8–5; hidden from beat 4
- Source: `animations/clips/economic-forces/ppp-scale.html` · render and convert with `pnpm anim:render ppp-scale`

## gdp-to-gni-and-shadow
- Where: intuition › reading-an-economy › beats 2–3 and 5 (stage widget `anim`, region top)
- Idea: GDP counts what is made inside the borders, GNI what residents earn wherever they are, and the underground economy sits outside both counts.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.4 s: an island country with dashed violet border posts; three teal factories and a coral foreign-owned plant send coins into a gold column. "GDP · made inside the borders".
  - 1.4–2.8 s: flags mark the foreign-owned plant and the residents' plant on an islet abroad; coins arc in from abroad ("+ income from abroad"), one leaves ("− paid to foreign owners"); the column grows a little and becomes GNI, "$600 billion". "GNI · earned by residents, wherever".
  - 2.8–4.3 s: the camera sinks below the island: three dim cash stalls pass coins in a pool of light. "Underground economy · missed by the count".
  - 4.3–5.0 s: pull back to the cross-section with "Official GNI" and "Underground · unrecorded" tags; hold.
- Numbers: GNI $600 billion (the scene's)
- Must not show: GNI per capita, 15,000 (beat 3's predict)
- Segments: hidden on beat 1; beat 2 shows 0–2.8 and the clip rests there through beat 3's predict; hidden on beat 4 (population slider); beat 5 shows 2.8–5 beside the cautions callout; hidden from beat 6
- Source: `animations/clips/economic-forces/gdp-to-gni-and-shadow.html`

## gini-and-spending
- Where: intuition › inequality-and-spending › beats 1–4 (stage widget `anim`, region top)
- Idea: the same total can be shared very unevenly (the Gini index), and one household's spending money is what is left after tax and essentials.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky; the camera pans between three panels
- Storyboard:
  - 0.0–1.2 s: two rows of five people get ten coins each: 2-2-2-2-2 ("Shared evenly") and 6-1-1-1-1 ("Mostly to one"). "Same total, shared two ways".
  - 1.2–2.2 s: a square chart; a teal diagonal ("Equal shares · Gini 0"), then a coral curve bowing beneath it with the gap shaded ("Bigger gap · higher Gini").
  - 2.2–3.1 s: a household beside a gold bar, "Gross $30,000", its top slice violet and bracketed, "Tax $4,000". No result.
  - 3.1–5.0 s: the tax slice lifts away ("Disposable $26,000"); the essentials part turns coral with house and bowl icons, "Essentials $12,000", and slides off; the rest turns teal, "Discretionary $14,000"; hold.
- Numbers: the scene's (30,000, 4,000, 12,000 → 26,000 and 14,000)
- Must not show: 26,000 during beat 3 (its predict)
- Segments: beat 1 plays 0–1.2, beat 2 sets 1.2–2.2, beat 3 sets 2.2–3.1, beat 4 sets 3.1–5 (its slider task starts from 14,000 and asks for 18,000), hidden from beat 5
- Source: `animations/clips/economic-forces/gini-and-spending.html`

## demographic-shifts
- Where: intuition › people-as-a-market › beats 3–4 (stage widget `anim`, region top; the density readout is hidden from beat 3)
- Idea: who the buyers are (young or aging) and where they live (moving to cities) shape demand.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–2.0 s: two stacks of age bars build up from the bottom beside "age" arrows: a teal one with a wide base ("Developing · young") and a violet one widest near the top ("Industrial · aging"). "Age distribution · who the buyers are".
  - 2.0–4.2 s: pan: a glowing road from green fields ("Rural") to a city ("Urban"); little people walk along it; the towers rise and their windows light gold. "Rural-to-urban shift · where they live".
  - 4.2–5.0 s: pull back to show both. "Age and place shape demand".
- Numbers: none
- Must not show: anything during the density predict and slider (beats 1–2) or the reflect (beat 6)
- Segments: beat 3 shows 0–2, beat 4 sets 2–5, hidden from beat 5
- Source: `animations/clips/economic-forces/demographic-shifts.html`
