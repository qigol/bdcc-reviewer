# Source notes — Recurrent Neural Networks

## Source
- File: RNN_PyTorch.ipynb (guided notebook) | Sessions: 25–26 | Dates: 2026-11-06, 2026-11-10
- RNN_TensorFlow.ipynb has the same text and numbers (Keras SimpleRNN; its kernel is the transpose of W_xh).

## Concept inventory (lecture order)
1. A1 Order carries meaning — two reviews with identical word counts; CO₂ readings shuffled (same mean 316.43, std 1.80).
2. A2 How earlier models handle order — lag columns, 1D CNN, RNN.
3. A3 Running summary — h_t = tanh(0.8 h_{t−1} + x_t), x = +1 good, −1 bad.
4. B Categories — one-to-one, one-to-many, many-to-one, many-to-many aligned / delayed; task ≠ architecture.
5. C1–C4 Anatomy — recurrent connection, parts table, hidden-state update, output layer, shared weights, unfolding.
6. C5 One step — same input, previous states −0.9, 0, 0.9 → −0.1194, 0.5370, 0.8668.
7. C6 tanh — values and slopes at z = 0..3; bounded, zero-centred, saturation.
8. C7 Forward pass by hand — w_xh 0.5, w_hh 0.8, b_h 0.1, x = (1, 0, −0.5) → 0.5370, 0.4851, 0.2337; ŷ = 0.4674 with w_hy 2. Spike demo (w_xh 1, b 0, 15 steps).
9. C8 Parameters — m(d + m + 1); 2,080 (+32 PyTorch bias = 2,112).
10. D1–D3 BPTT on the toy with y = 1, L = (ŷ − y)²; dL/dh_t; factor w_hh(1 − h_t²); per-step pieces summed; one update with η = 0.02.
11. E1–E4 IMDb sentiment — ids, vocab 10,000, MAX_LEN 200 pre-padding, embedding, RNN 32, sigmoid/BCE, checkpoint at best validation epoch (4), test 0.8515; vanishing/exploding w^k; clipping, truncated BPTT.
12. F1–F7 CO₂ forecasting — sliding windows (504 × 12), chronological train/validation/test, standardization on training months, naive baseline, RNN on levels fails beyond training range, RNN on changes (503 windows) close to LR with month columns.

## Formulas (verbatim, as TeX)
- `\mathbf{h}_t = \tanh\left(W_{xh}\,\mathbf{x}_t + W_{hh}\,\mathbf{h}_{t-1} + \mathbf{b}_h\right)` — C3
- `\hat{\mathbf{y}}_t = W_{hy}\,\mathbf{h}_t + \mathbf{b}_y` — C3
- `\tanh'(z) = 1 - \tanh^2(z)` — C6
- `\text{parameters} = m\,(d + m + 1)` — C8
- `\frac{\partial L}{\partial h_{t-1}} = \frac{\partial L}{\partial h_t}\, w_{hh}(1 - h_t^2)` — D2
- `\frac{\partial L}{\partial w_{hh}} = \sum_t \frac{\partial L}{\partial h_t}(1 - h_t^2)\,h_{t-1}` — D3
- `L = -[y\log p + (1-y)\log(1-p)]` — E2

## Worked examples (exact numbers)
- C5 → same-input · C6 → tanh-values* · C7 → forward-c7*, forward-walk, forward-code · spike → spike-memory
- C8/E2 → params-imdb, params-code (2,080 / 2,112 / 33 / 320,000 / 322,145) · F5 → params-co2 (321)
- D1 → bptt-d1 (L 0.2837, dL/dh [−0.9857, −1.6113, −2.1305], grads 0.3057, −1.6388, −3.9477, −0.2489)
- D2 → bptt-d2 (factors 0.6117, 0.7563) · D3 → bptt-d3-pieces, bptt-d3-update (new loss 0.0432), bptt-walk, bptt-code
- E4 → vanish-table, vanish-09 · E3 → imdb-test-acc (0.8515), imdb-best-epoch (4) · E1 → pad-pre
- F2 → windows-first, window-code, windows-516 (504) · F6 → windows-changes (503)
- A1/A3 → reviews-same-words, notes-finals (±0.665)

## Conventions & ambiguities
- BPTT toy loss is the plain squared error (ŷ − y)² (no ½), as the notebook writes it; dL/dŷ = 2(ŷ − y).
- PyTorch's nn.RNN has two bias vectors; formulas count one (m(d + m + 1)), and the module says when the PyTorch count adds m.
- Trained-model outputs (epoch history, confusion matrix, forecast tables) are data, not recomputed.
- notes-finals: the notebook only plots the A3 summaries; the final values ±0.665 are computed from its formula.

## Errata
- None found.

## Beyond the slides
- The water-district application case and its 18-month series (fictional).
- The window-count helper (n − L, or n − 1 − L on changes) states the notebook's shapes as a formula.

## Skill map
- seq-order: A1–A3 · seq-categories: B · rnn-cell: C1–C5 · rnn-forward: C7 · tanh-memory: C6, spike · rnn-params: C8, E2, F5 · bptt: D1–D3 · vanishing: E4 · sentiment: E1–E3 · seq-forecast: F1–F7
