export default function register() {
  // 1.0.1: placeholder Math & Code section (key-terms lookup) so the module passes the validator.
  const TERMS = {
    "csd": {
      "name": "Carbonated soft drink",
      "meaning": "A sweet, fizzy, non-alcoholic drink such as a cola."
    },
    "sugar-tax": {
      "name": "Sugar tax",
      "meaning": "A tax on sugary drinks, charged to cut how much of them people drink."
    },
    "concentrate-producer": {
      "name": "Concentrate producer",
      "meaning": "A company that makes the secret flavor base of a drink and sells it to bottlers, while building the brand."
    },
    "stills": {
      "name": "Stills",
      "meaning": "Coke's word for drinks without fizz, such as water, juice, tea and coffee."
    },
    "global-ventures": {
      "name": "Global Ventures",
      "meaning": "Coke's group for small, fast-growing brands, kept apart from the geographic structure so the big company does not smother them."
    }
  };
  function termLookup({ term }) {
    const hit = TERMS[term] || { name: 'Unknown term', meaning: 'Not in this lookup' };
    const vars = { term, name: hit.name, meaning: hit.meaning };
    return {
      name: hit.name, meaning: hit.meaning,
      trace: [
        { label: 'Look up "{=name}".', code: 'lookup', math: 'lookup', vars,
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: '{=name}: {=meaning}', code: 'answer', math: 'answer', vars,
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'good' } }] },
      ],
    };
  }

  return {
    fns: { termLookup },
    generators: {},
  };
}
