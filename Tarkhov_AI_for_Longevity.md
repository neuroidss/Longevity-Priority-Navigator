# Presentation: Can Artificial Intelligence Help Us Defeat Aging?
## Andrey Tarkhov, Applied AI, Retro Biosciences

---

### Slide 2: The Challenge of Combating Aging
- **Goal**: To extend human life in a healthy state.
- **What do we need for this?**
  - A therapy that extends life.
  - A way to measure that it works.
- **How will we know if we have succeeded?**
  - A clinical trial will show: those who received our therapy live longer than those who received a placebo.

---

### Slide 3: An "Easy" Way to Extend Life
- Michael Rose's experiments on selection for delayed reproduction led to an increase in the lifespan of fruit flies.
- (Graphs showing increased lifespan)

---

### Slide 4: What Challenges in Aging Can AI Help Solve?
- **Drug Development?** (siRNA, Small molecules, CRISPR, etc.)
- **Translation of Research and Aging Models?** (Yeast, Nematodes, Flies, Cells, Mice, Humans)
- **Biomarkers?** (Frailty and clinical biomarkers, Molecular clocks, Functional assays)
- **How are they all connected?**

---

### Slide 5: The Chicken-and-Egg Problem in Aging Research
- **Weak Interventions** (Chemical compounds, Antibodies, Lifestyle changes) -> **Weak effect on lifespan** -> **Noisy Biomarkers** (Control, p<0.05?)
- This triad creates the main barrier in research.

---

### Slide 6: Why is Aging Harder to Measure Than Acute Diseases?
- **Acute Diseases (Oncomarker):**
  - Signal-to-noise ratio: SNR >> 1. Clear distinction between healthy tissue and a tumor.
- **Aging and Chronic Diseases (Aging Biomarker):**
  - Signal-to-noise ratio: SNR << 1. The signal is hidden in the noise of individual trajectories.

---

### Slide 7: Examples of the Chicken-and-Egg Problem
- **Intervention Strength** (A correctly chosen target and an effective therapy)
- **Biomarker Sensitivity** (The predictive power of the chosen "aging clocks" and their noise)
- **Criticality for Human Aging** (The theory of aging, understanding the mechanism, and its translation to humans)
- **Result**: To date, almost nothing has been proven to work (GLP1, SGLT2 are the first candidates).

---

### Slide 8: 1. Full-Genome Screening of Targets In Vitro
- **Intervention Strength:** We increase the expression of each gene in a pool of cells using CRISPRa or ORF.
- **Biomarker Sensitivity:** Clocks based on scRNAseq - single-cell transcriptomes. Very noisy!
- **Criticality for Human Aging:** The mechanism is unclear, as is how to emulate the effect in a whole organism—and the link to lifespan is not understood.
- **References**: Plesa et al. (2023), Camillo et al. (2025), Huang et al. (2025)

---

### Slide 9: 2. Screening of Small Molecule Libraries In Vitro
- **Intervention Strength:** Screening of 100,000 small molecules in cell lines; 9 of them extended the lifespan of worms by ~10-50%.
- **Biomarker Sensitivity:** We measure the resistance of a cell line to oxidative stress (hydrogen peroxide).
- **Criticality for Human Aging:** It is unclear if the mechanism is conserved from worms (and cell lines) to humans, considering PK/PD, bioavailability. Out of 32 candidates, 28 are problematic (PAINS, cell toxicity, DNA-damaging).
- **References**: Zhang et al. (2020), Lombard et al. (2020)

---

### Slide 10: 3. Single-Cell Atlas of the Organism
- **Intervention Strength:** Not tested (Tabula Muris).
- **Biomarker Sensitivity:** scRNAseq — transcriptomes of 100,000 individual cells from 7 mice and 20 tissues.
- **Criticality for Human Aging:** It's unclear if the aging mechanism is conserved from mice to humans, there's no theory of aging, the targets are unknown.
- **References**: Tabula Muris, Tabula Sapiens, CZ CELLxGENE

---

### Slide 11: 4. Screening of Cancer Drugs and Virtual Cell Models
- **Intervention Strength:** All types of therapies used in cancer treatment—small molecules, genetic interventions, etc.
- **Biomarker Sensitivity:** RNAseq (transcriptomics), proteomics, cell viability, chromatin profiling, etc. scRNAseq from Xaira (2025).
- **Criticality for Human Aging:** The contribution of all types of cancer to average lifespan is ~3 years. Are we ready to take chemotherapy for aging?
- **References**: clue.io, Xaira's: Huang et al. (2025)

---

### Slide 12: 5. FDA-Approved Drugs That Already Reduce All-Cause Mortality
- **Intervention Strength:** SGLT2 inhibitors (dapagliflozin), GLP1 agonists (Ozempic).
- **Biomarker Sensitivity:** Standard clinical markers of diseases and all-cause mortality.
- **Criticality for Human Aging:** Clinical trials are ongoing, and a reduction in all-cause mortality has been observed—the first signal that these could be the first approved drugs for aging!
- **References**: Jhund et al (2022), Huang et al (2024)

---

### Slide 13: Tasks That AI Can/Should Solve
- Search for new targets and drug development
- Construction of aging biomarkers
- Prediction of clinical trial outcomes based on molecular biomarkers
- Prediction of the effects of interventions on lifespan
- Construction of models: QSAR, QSPR, AlphaFold, ESM, scGPT, GPT-4b micro..., mortality models, phenomenological models, etc.
- Development of tools, e.g., BLAST, NGS pipelines, analysis of microscopy images, etc.
- ... and so on.