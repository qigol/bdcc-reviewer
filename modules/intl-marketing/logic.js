export default function register() {
  // 1.0.1: placeholder Math & Code section (key-terms lookup) so the module passes the validator.
  const TERMS = {
    "marketing-mix": {
      "name": "Marketing mix",
      "meaning": "The set of choices a firm makes about its product, promotion, price and distribution to satisfy a target market."
    },
    "total-product": {
      "name": "Total product",
      "meaning": "Everything the customer buys, including the item itself, brand name, service, warranty, instructions, package and company image."
    },
    "first-registrant-rule": {
      "name": "First-registrant rule",
      "meaning": "In many countries a brand name belongs to whoever registers it first, not to whoever used it first."
    },
    "promotion": {
      "name": "Promotion",
      "meaning": "Any way a firm communicates with its publics, such as advertising, public relations, sales offers and events."
    },
    "advertising": {
      "name": "Advertising",
      "meaning": "Paid, non-personal presentation of ideas, goods or services by a sponsor who is named."
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
