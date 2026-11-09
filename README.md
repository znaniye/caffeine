# caffeine

How much caffeine is still in you at bedtime, and until when one more coffee is fine.

Drag the cups along the day, click one to change the drink or the size, and move the bed line. The day is saved in the URL, so you can share it.

The curve is a one-compartment model with a 5 h half-life by default. The 50 mg line is a rule of thumb; the Model panel has an "Evidence" option based on [Gardiner et al. 2023](https://pubmed.ncbi.nlm.nih.gov/36870101/). Not medical advice.

```sh
npm install
npm run dev
npm test
```

`nix build` gives you the static site in `result/`.
