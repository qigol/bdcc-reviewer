# Source notes — LSTM, GRU and the Road to Attention

## Source
- File: LSTM_GRU_PyTorch.ipynb (lecture notebook, PyTorch, with printed outputs) | Sessions: 27–28 | Date: 2026-11-10 / 2026-11-13
- File: LSTM_GRU_Architecture_and_Processing_Notes.docx (two-page handout: conceptual order of each cell's steps, comparison table)

## Concept inventory (lecture order)
1. §1 Why vanilla RNNs struggle — the product ∏ diag(tanh'(z_i)) W_hh; one unit: w^(t−k) times tanh slopes; 0.9^50 ≈ 0.005, 1.1^50 ≈ 117; clipping caps explosions.
2. §2.1 Why LSTM — problem → design table: cell state with self-connection 1 (constant error carousel, 1997), input gate (1997), output gate (1997), forget gate (2000, Gers et al.).
3. §2.2 How LSTM works — two states, three gates, candidate; C_t = f⊙C_{t−1} + i⊙C̃_t, h_t = o⊙tanh(C_t); ∂C_t/∂C_{t−1} = diag(f_t). nn.LSTM returns outputs, (h_n, c_n); weight_ih_l0 is 4 stacked blocks.
4. §3.1 Why GRU — Cho et al. (2014) encoder–decoder; no cell state, two gates, no output gate; Chung et al. (2014): comparable to LSTM.
5. §3.2 How GRU works — update z, reset r, candidate h̃; h_t = z⊙h_{t−1} + (1 − z)⊙h̃_t (Cho/PyTorch convention; some texts swap); fewer parameters, 3 blocks.
6. §3.2 Parameter printout — d = m = 32: RNN 2,112, LSTM 8,448, GRU 6,336 = blocks × (m(d + m) + 2m).
7. §3.2 Demonstration — m_t = g_t m_{t−1} + (1 − g_t) c_t; retention g^k; write / hold / overwrite with input-dependent gates vs fixed 0.5 and 0.99.
8. §4 Application — IMDb, 8,000 / 2,000 reviews, embedding 32, hidden 32, Adam 1e-3, clipping, same seed; pack_padded_sequence; results table.
9. §5.1 Limits of LSTM/GRU — sequential computation, very long sequences, fixed-size memory, cost of gating.
10. §5.2 ResNets — degradation (training error rises with depth, not overfitting); y = F(x) + x; ∂y/∂x = ∂F/∂x + I.
11. §5.3 Transformers — self-attention as weighted average of all positions; one-step paths; parallel; residual sub-layers; quadratic cost; position information must be added.
12. Notes handout — conceptual order: LSTM receive, forget, propose, write, expose, pass on; GRU receive, retain?, reset?, propose, combine, pass on. Gates are computed in parallel; the order explains the logic.

## Formulas (verbatim, as TeX)
- `\mathbf{h}_t = \tanh(W_{xh}\mathbf{x}_t + W_{hh}\mathbf{h}_{t-1} + \mathbf{b}_h)` — §1
- `\frac{\partial h_t}{\partial h_k} = \prod_{i=k+1}^{t} \operatorname{diag}(\tanh'(z_i)) W_{hh}` — §1
- `C_t = f_t \odot C_{t-1} + i_t \odot \widetilde{C}_t`, `h_t = o_t \odot \tanh(C_t)` — §2.2
- `h_t = z_t \odot h_{t-1} + (1 - z_t) \odot \tilde{h}_t` — §3.2
- `y = F(x) + x`, `\partial y/\partial x = \partial F/\partial x + I` — §5.2

## Worked examples (exact numbers)
- 0.9^50 ≈ 0.005, 1.1^50 ≈ 117 — §1 (→ fade-09, fade-11, chain-code)
- Parameter printout 2,112 / 8,448 / 6,336 — §3.2 (→ params-d32, params-code); textbook single-bias LSTM 4·m(d+m+1) = 8,320 (→ params-textbook)
- Results table: recurrent 2,112 / 8,448 / 6,336; total 322,145 / 328,481 / 326,369; best val acc 0.752 / 0.804 / 0.830 at epoch 8; time 47.8 / 184.3 / 154.2 s — §4 (→ compare-table, compare-code; datasets results, valacc)
- Note: the GRU's best validation accuracy prints as 0.830 in the table while its epoch-8 log prints 0.831 (both rounded from the same run); the valacc dataset keeps the log's values.

## Conventions & ambiguities
- GRU update: Cho et al. / PyTorch convention, z_t = share of the old state kept. The quiz warns about the swapped textbook convention.
- One-element LSTM and GRU steps: each gate is σ(w·x + u·h_{t−1} + b) for one input and one hidden unit; gate rows are (w, u, b). These toys are built for the module.
- Parameter counts use PyTorch's two bias vectors per block (2m), as the notebook prints; the textbook form m(d + m + 1) per block is noted.
- Self-attention toy: score = q·k without the 1/√d scaling real Transformers use (stated in the lesson); values are 1-number sentiments.
- Gate demo: gate values are chosen by hand, as the notebook says; the content sequence is ours.

## Errata
- None found.

## Beyond the slides
- The one-element LSTM and GRU worked steps (lstmtoy, lstmnet, grutoy, grunet).
- The gate-demo numbers (gatedemo); the notebook shows only a plot.
- The residual derivative with F'(x) = 0.05 over 3 blocks.
- The "not very good" self-attention example (attn).

## Skill map
- long-memory: §1 · lstm-design: §2.1 · lstm-step: §2.2, notes · gru-step: §3.1–3.2, notes · gate-memory: §3.2 demo · gated-params: §3.2 printout · compare: §4 · skip-connections: §5.2 · attention: §5.1, §5.3
