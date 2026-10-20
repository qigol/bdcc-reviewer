# Animations: Organizational Design and Control

## transfer-pricing
- Where: intuition › shifting-profits › beats 2–4 (stage widget `anim`, region top)
- Idea: moving profit from a high-tax unit to a low-tax unit lowers the group's tax while total profit stays the same.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–1.0 s: two round buildings on two islands: Alpha (coral flag, 50%) with a gold stack of 60, Beta (teal flag, 20%) with 40; a violet tax collector beside each takes a coral slice (30 and 8); a total-tax bubble reads 38.
  - 1.0–3.2 s: a paper-plane invoice flies from Beta to Alpha; 10 coins arc back across the water; Alpha 60 → 50 (tax 25), Beta 40 → 50 (tax 10).
  - 3.2–4.2 s: the bubble counts down 38 → 35; a badge reads "Total profit still 100".
  - 4.2–5.0 s: hold; the camera eases out to show both islands and the bubble.
- On-screen words: "Alpha", "Beta", "Total tax", "Total profit still 100"
- Numbers: 60/40 · 50%/20% · tax 30 + 8 = 38 → 25 + 10 = 35 (transferPricing)
- Must not show: the 62 after-tax total (beat-1 predict) or the 40/60 split the beat-4 `when` gate asks for
- Segments (1.2.0): beat 2 (the definition) plays 0–1, a new beat 3 ("Watch 10 million of profit move…", no gate) sets 1–5, and the sliders and the 20-million `when` gate moved to beat 4 ("Now go one step further"), where the clip rests on its last frame; hidden from beat 5
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Source: `animations/clips/org-design/transfer-pricing.html` · render and convert with `pnpm anim:render transfer-pricing`

## org-chart-structures
- Where: intuition › structures › beats 1–6 (stage widget `anim`, region top)
- Idea: as a firm grows abroad, the row under headquarters can be arranged by home/abroad, product, region, function, a mix, or two dimensions at once.
- Length: 5.5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.0 s: HQ over "Domestic" and "International division". "International division · next to domestic".
  - 1.0–2.0 s: HQ over Cars, Batteries, Solar, each with its own row of little globes (area experts). "Product · each product run worldwide".
  - 2.0–3.0 s: HQ over Americas, Europe, Asia, each with its own row of little product cubes. "Geographic region · each area run as a whole".
  - 3.0–3.6 s: HQ over Making, Selling, Finance. "Functional · by function at the top".
  - 3.6–4.2 s: HQ over Europe, Asia and "Product X · worldwide". "Hybrid · more than one dimension".
  - 4.2–5.5 s: HQ gives way to a matrix: Cars and Solar rows cross Europe and Asia columns; the manager at Solar × Asia gets two solid boss lines ("Two bosses"), then the Asia line turns dashed violet ("Overlay · advice, not a second boss"); hold.
- Numbers: none
- Must not show: strengths or costs of any structure (beat 3 asks which avoids duplicating product experts; beat 4 asks which suits a narrow product mix such as oil)
- Segments: one per beat: 0–1, 1–2, 2–3, 3–3.6, 3.6–4.2, 4.2–5.5; hidden from beat 7 (strategic business units)
- Source: `animations/clips/org-design/org-chart-structures.html`

## newer-org-forms
- Where: intuition › newer-forms › beats 1–4 (stage widget `anim`, region top; replaces the old "Current trends" note)
- Idea: four newer forms: redesign for efficiency, use outside resources, decide across, and split into small companies around a small HQ.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky; each picture cross-fades into the next
- Storyboard:
  - 0.0–1.3 s: a five-layer pyramid of boxes loses its middle layers and settles flat ("Fewer layers"). "Reengineering · redesign to work leaner".
  - 1.3–2.6 s: a teal "Firm" circle reaches out with dashed lines to a design studio, a factory, delivery and two remote workers. "Value from resources outside the firm" (the form is not named).
  - 2.6–3.8 s: five peers in a row linked side to side inside a gold ring ("One shared philosophy"). "Horizontal corporation · decisions across".
  - 3.8–5.0 s: a violet HQ hub linked to five small companies. "Dynamic network · small companies, small HQ"; hold.
- Numbers: none
- Must not show: the name "virtual corporation" during beat 2 (its predict asks which form relies on outside resources); anything while the sorter is open
- Segments: beat 1 plays 0–1.3, beat 2 sets 1.3–2.6, beat 3 sets 2.6–3.8, beat 4 sets 3.8–5; the sorter moved to a new beat 5 ("Sort the four forms.") that hides the clip; the practice beat no longer re-shows the note
- Source: `animations/clips/org-design/newer-org-forms.html`
