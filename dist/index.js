// src/data/interactions.json
var interactions_default = [
  {
    id: "anticoag-ginkgo-001",
    drug_class: "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
    drug_ingredient: ["warfarin", "apixaban", "aspirin", "clopidogrel"],
    supplement: "\uC740\uD589 (Ginkgo biloba)",
    severity: "high",
    action_type: "avoid",
    mechanism: "\uD608\uC18C\uD310 \uC751\uC9D1 \uC5B5\uC81C \uBC0F \uD56D\uC751\uACE0 \uD6A8\uACFC \uC0C1\uAC00\uC791\uC6A9\uC73C\uB85C \uCD9C\uD608 \uC704\uD5D8 \uC99D\uAC00",
    recommendation: "\uBCD1\uC6A9 \uC2DC \uCD9C\uD608 \uC704\uD5D8 \uC99D\uAC00. \uD658\uC790\uC5D0\uAC8C \uAD8C\uD558\uC9C0 \uB9D0 \uAC83. \uC774\uBBF8 \uBCF5\uC6A9 \uC911\uC774\uBA74 \uBA4D\xB7\uCD9C\uD608 \uC9D5\uD6C4 \uBAA8\uB2C8\uD130\uB9C1 \uBC0F \uCC98\uBC29\uC758 \uC0C1\uB2F4.",
    evidence_level: "\uC911",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  },
  {
    id: "anticoag-danshen-001",
    drug_class: "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
    drug_ingredient: ["warfarin"],
    supplement: "\uB2E8\uC0BC (Danshen)",
    severity: "high",
    action_type: "avoid",
    mechanism: "\uB2E8\uC0BC\uC774 \uC640\uD30C\uB9B0\uC758 \uD761\uC218\xB7\uB300\uC0AC\uC5D0 \uC601\uD5A5\uC744 \uC8FC\uC5B4 \uD56D\uC751\uACE0 \uD6A8\uACFC\uB97C \uC99D\uAC15, \uCD9C\uD608 \uC704\uD5D8 \uBC0F INR \uC0C1\uC2B9",
    recommendation: "\uBCD1\uC6A9 \uC2DC \uCD9C\uD608 \uC704\uD5D8 \uC99D\uAC00. \uAD8C\uD558\uC9C0 \uB9D0 \uAC83. \uBCF5\uC6A9 \uC911\uC774\uBA74 INR \uBAA8\uB2C8\uD130\uB9C1 \uBC0F \uCC98\uBC29\uC758 \uC0C1\uB2F4.",
    evidence_level: "\uC911",
    source: {
      db: "PubMed",
      id: "PMID:11302416",
      url: "https://pubmed.ncbi.nlm.nih.gov/11302416/",
      retrieved_date: "2026-06-21",
      quote: "Interaction between warfarin and danshen (Salvia miltiorrhiza); the anticoagulant response to warfarin was exaggerated. (Chan TY, Ann Pharmacother 2001)"
    },
    last_reviewed: "2026-06-21",
    verified: true
  },
  {
    id: "anticoag-dongquai-001",
    drug_class: "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
    drug_ingredient: ["warfarin"],
    supplement: "\uB2F9\uADC0 (Dong quai)",
    severity: "high",
    action_type: "avoid",
    mechanism: "\uB2F9\uADC0\uC758 \uCFE0\uB9C8\uB9B0 \uC131\uBD84\uC774 \uD56D\uC751\uACE0 \uD6A8\uACFC \uC0C1\uAC00\uC791\uC6A9\uC73C\uB85C \uCD9C\uD608 \uC704\uD5D8 \uC99D\uAC00",
    recommendation: "\uBCD1\uC6A9 \uC2DC \uCD9C\uD608 \uC704\uD5D8 \uC99D\uAC00. \uAD8C\uD558\uC9C0 \uB9D0 \uAC83. INR \uBAA8\uB2C8\uD130\uB9C1 \uAD8C\uACE0.",
    evidence_level: "\uC57D",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  },
  {
    id: "anticoag-garlic-001",
    drug_class: "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
    drug_ingredient: ["warfarin", "aspirin", "clopidogrel"],
    supplement: "\uB9C8\uB298",
    severity: "medium",
    action_type: "monitor",
    mechanism: "\uB9C8\uB298 \uACE0\uC6A9\uB7C9\uC774 \uD608\uC18C\uD310 \uC751\uC9D1\uC744 \uC5B5\uC81C\uD558\uC5EC \uCD9C\uD608 \uC704\uD5D8 \uAC00\uC0B0",
    recommendation: "\uCE58\uB8CC \uC6A9\uB7C9 \uB9C8\uB298 \uBCF4\uC870\uC81C \uBCD1\uC6A9 \uC2DC \uCD9C\uD608 \uC9D5\uD6C4 \uBAA8\uB2C8\uD130\uB9C1. \uC2DD\uC774 \uC218\uC900\uC740 \uC77C\uBC18\uC801\uC73C\uB85C \uBB38\uC81C \uC5C6\uC74C.",
    evidence_level: "\uC57D",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  },
  {
    id: "anticoag-nattokinase-001",
    drug_class: "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
    drug_ingredient: ["warfarin", "apixaban"],
    supplement: "\uB098\uD1A0\uD0A4\uB098\uC81C",
    severity: "high",
    action_type: "avoid",
    mechanism: "\uB098\uD1A0\uD0A4\uB098\uC81C\uC758 \uC12C\uC720\uC18C \uC6A9\uD574\xB7\uD56D\uC751\uACE0 \uC791\uC6A9\uC774 \uCD9C\uD608 \uC704\uD5D8 \uC0C1\uAC00",
    recommendation: "\uBCD1\uC6A9 \uC2DC \uCD9C\uD608 \uC704\uD5D8 \uC99D\uAC00. \uAD8C\uD558\uC9C0 \uB9D0 \uAC83. \uBCF5\uC6A9 \uC911\uC774\uBA74 \uCD9C\uD608 \uC9D5\uD6C4 \uBAA8\uB2C8\uD130\uB9C1.",
    evidence_level: "\uC57D",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  },
  {
    id: "anticoag-redginseng-001",
    drug_class: "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
    drug_ingredient: ["warfarin"],
    supplement: "\uD64D\uC0BC",
    severity: "medium",
    action_type: "monitor",
    mechanism: "\uC778\uC0BC\uC774 \uC640\uD30C\uB9B0\uC758 \uD56D\uC751\uACE0 \uD6A8\uACFC\uB97C \uAC10\uC18C\uC2DC\uD0AC \uC218 \uC788\uC74C(INR \uC800\uD558 \uBCF4\uACE0)",
    recommendation: "\uBCD1\uC6A9 \uC2DC INR \uBCC0\uB3D9 \uBAA8\uB2C8\uD130\uB9C1. \uC640\uD30C\uB9B0 \uD6A8\uACFC \uAC10\uC18C \uAC00\uB2A5\uC131 \uC8FC\uC758.",
    evidence_level: "\uC911",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  },
  {
    id: "thyroid-calcium-001",
    drug_class: "\uAC11\uC0C1\uC120\uC57D",
    drug_ingredient: ["levothyroxine"],
    supplement: "\uCE7C\uC298",
    severity: "medium",
    action_type: "spacing",
    mechanism: "\uCE7C\uC298(\uD0C4\uC0B0\uCE7C\uC298)\uC774 levothyroxine \uD761\uC218\uB97C \uC800\uD574\uD558\uC5EC \uAC11\uC0C1\uC120\uAE30\uB2A5 \uC800\uD558 \uBC0F TSH \uC0C1\uC2B9 \uC720\uBC1C",
    recommendation: "\uCD5C\uC18C 4\uC2DC\uAC04 \uAC04\uACA9\uC744 \uB450\uACE0 \uBCF5\uC6A9\uD558\uB3C4\uB85D \uC548\uB0B4.",
    evidence_level: "\uAC15",
    source: {
      db: "PubMed",
      id: "PMID:10838651",
      url: "https://pubmed.ncbi.nlm.nih.gov/10838651/",
      retrieved_date: "2026-06-21",
      quote: "Calcium carbonate reduces T4 absorption and increases serum thyrotropin levels. (Effect of calcium carbonate on the absorption of levothyroxine, JAMA 2000)"
    },
    last_reviewed: "2026-06-21",
    verified: true
  },
  {
    id: "thyroid-iron-001",
    drug_class: "\uAC11\uC0C1\uC120\uC57D",
    drug_ingredient: ["levothyroxine"],
    supplement: "\uCCA0\uBD84",
    severity: "medium",
    action_type: "spacing",
    mechanism: "\uCCA0\uBD84\uC774 levothyroxine\uC640 \uBCF5\uD569\uCCB4 \uD615\uC131\uC73C\uB85C \uD761\uC218 \uC800\uD574",
    recommendation: "\uCD5C\uC18C 4\uC2DC\uAC04 \uAC04\uACA9\uC744 \uB450\uACE0 \uBCF5\uC6A9\uD558\uB3C4\uB85D \uC548\uB0B4.",
    evidence_level: "\uAC15",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  },
  {
    id: "quinolone-calcium-001",
    drug_class: "\uD034\uB180\uB860\xB7\uD14C\uD2B8\uB77C\uC0AC\uC774\uD074\uB9B0 \uD56D\uC0DD\uC81C",
    drug_ingredient: ["ciprofloxacin", "levofloxacin", "doxycycline"],
    supplement: "\uCE7C\uC298",
    severity: "medium",
    action_type: "spacing",
    mechanism: "\uCE7C\uC298 \uB4F1 \uB2E4\uAC00\uC591\uC774\uC628\uC774 \uD034\uB180\uB860\xB7\uD14C\uD2B8\uB77C\uC0AC\uC774\uD074\uB9B0\uACFC chelation\uC73C\uB85C \uD761\uC218 \uC800\uD574",
    recommendation: "\uD56D\uC0DD\uC81C \uBCF5\uC6A9 2\uC2DC\uAC04 \uC804 \uB610\uB294 4-6\uC2DC\uAC04 \uD6C4\uB85C \uCE7C\uC298 \uAC04\uACA9\uC744 \uB450\uB3C4\uB85D \uC548\uB0B4.",
    evidence_level: "\uAC15",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  },
  {
    id: "anticoag-vitk-001",
    drug_class: "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
    drug_ingredient: ["warfarin"],
    supplement: "\uBE44\uD0C0\uBBFCK (\uB179\uD669\uC0C9\uCC44\uC18C \uB2E4\uB7C9)",
    severity: "medium",
    action_type: "monitor",
    mechanism: "\uBE44\uD0C0\uBBFCK\uAC00 \uC640\uD30C\uB9B0\uC758 \uD56D\uC751\uACE0 \uD6A8\uACFC\uB97C \uAE38\uD56D\uD558\uC5EC INR \uC800\uD558",
    recommendation: "\uB179\uD669\uC0C9\uCC44\uC18C \uC12D\uCDE8\uB7C9\uC744 \uC77C\uC815\uD558\uAC8C \uC720\uC9C0\uD558\uB3C4\uB85D \uC548\uB0B4. \uAE09\uACA9\uD55C \uBCC0\uD654 \uC2DC INR \uBAA8\uB2C8\uD130\uB9C1.",
    evidence_level: "\uAC15",
    source: {
      db: "\uBBF8\uD655\uC815",
      id: "PENDING",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      retrieved_date: "2026-06-21",
      quote: "\uC57D\uC0AC \uAC80\uC99D \uB300\uAE30 \u2014 1\uCC28\uBB38\uD5CC \uCD9C\uCC98 \uBBF8\uD655\uC815 (\uC2DC\uB4DC PMID \uD658\uAC01\uC73C\uB85C \uC81C\uAC70\uB428)."
    },
    last_reviewed: "2026-06-21",
    verified: false
  }
];

// src/lib/validateKb.ts
var SEVERITIES = ["high", "medium", "low"];
var ACTIONS = ["avoid", "monitor", "spacing"];
var EVIDENCE = ["\uAC15", "\uC911", "\uC57D"];
function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}
function validateKb(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("KB\uB294 \uBC30\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4");
  }
  return entries.map((e, i) => {
    const ctx = `\uC5D4\uD2B8\uB9AC #${i}`;
    if (typeof e !== "object" || e === null) throw new Error(`${ctx}: \uAC1D\uCCB4\uAC00 \uC544\uB2D8`);
    const entry = e;
    if (!isNonEmptyString(entry.id)) throw new Error(`${ctx}: id \uB204\uB77D`);
    if (!isNonEmptyString(entry.drug_class)) throw new Error(`${ctx}: drug_class \uB204\uB77D`);
    if (!Array.isArray(entry.drug_ingredient) || entry.drug_ingredient.length === 0 || !entry.drug_ingredient.every(isNonEmptyString))
      throw new Error(`${ctx}: drug_ingredient \uB204\uB77D \uB610\uB294 \uBE44\uBB38\uC790\uC5F4 \uC694\uC18C`);
    if (!isNonEmptyString(entry.supplement)) throw new Error(`${ctx}: supplement \uB204\uB77D`);
    if (!SEVERITIES.includes(entry.severity)) throw new Error(`${ctx}: severity \uBD80\uC801\uD569`);
    if (!ACTIONS.includes(entry.action_type)) throw new Error(`${ctx}: action_type \uBD80\uC801\uD569`);
    if (!isNonEmptyString(entry.mechanism)) throw new Error(`${ctx}: mechanism \uB204\uB77D`);
    if (!isNonEmptyString(entry.recommendation)) throw new Error(`${ctx}: recommendation \uB204\uB77D`);
    if (!EVIDENCE.includes(entry.evidence_level))
      throw new Error(`${ctx}: evidence_level \uB204\uB77D \uB610\uB294 \uBD80\uC801\uD569 (\uAC15/\uC911/\uC57D \uD544\uC218)`);
    const src = entry.source;
    if (!src || !isNonEmptyString(src.url) || !isNonEmptyString(src.id) || !isNonEmptyString(src.db) || !isNonEmptyString(src.quote) || !isNonEmptyString(src.retrieved_date))
      throw new Error(`${ctx}: source \uD544\uB4DC \uB204\uB77D (url/id/db/quote/retrieved_date \uD544\uC218)`);
    if (!isNonEmptyString(entry.last_reviewed)) throw new Error(`${ctx}: last_reviewed \uB204\uB77D`);
    if (typeof entry.verified !== "boolean")
      throw new Error(`${ctx}: verified \uB204\uB77D \uB610\uB294 boolean \uC544\uB2D8`);
    return entry;
  });
}

// src/lib/lookup.ts
var ABSTAIN_MESSAGE = "\uAC80\uC0C9\uD55C \uC790\uB8CC \uB0B4 \uBB38\uC11C\uD654\uB41C \uC0C1\uD638\uC791\uC6A9 \uC5C6\uC74C \u2014 \uC548\uC804\uD558\uB2E4\uB294 \uC758\uBBF8\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC57D\uC0AC \uD310\uB2E8 \uD544\uC694.";
function lookup(kb, drugClass, supplement) {
  const entries = kb.filter(
    (e) => e.verified && e.drug_class === drugClass && e.supplement === supplement
  );
  if (entries.length === 0) {
    return { kind: "abstain", message: ABSTAIN_MESSAGE };
  }
  return { kind: "hit", entries };
}

// src/data/vocabulary.ts
var DRUG_CLASSES = [
  "\uD56D\uC751\uACE0\uC81C/\uD56D\uD608\uC18C\uD310\uC81C",
  "\uAC11\uC0C1\uC120\uC57D",
  "\uD2F0\uC544\uC9C0\uB4DC \uC774\uB1E8\uC81C",
  "\uB2F9\uB1E8\uC57D",
  "\uD034\uB180\uB860\xB7\uD14C\uD2B8\uB77C\uC0AC\uC774\uD074\uB9B0 \uD56D\uC0DD\uC81C",
  "\uBA74\uC5ED\uC5B5\uC81C\uC81C",
  "\uC704\uC7A5\uC57D(\uC81C\uC0B0\uC81C/PPI)",
  "\uD608\uC555\uC57D"
];
var SUPPLEMENTS = [
  "\uC740\uD589 (Ginkgo biloba)",
  "\uD64D\uC0BC",
  "\uB9C8\uB298",
  "\uB098\uD1A0\uD0A4\uB098\uC81C",
  "\uB2E8\uC0BC (Danshen)",
  "\uB2F9\uADC0 (Dong quai)",
  "\uCE7C\uC298",
  "\uB9C8\uADF8\uB124\uC298",
  "\uCCA0\uBD84",
  "\uBE44\uD0C0\uBBFCD",
  "\uBE44\uD0C0\uBBFCK (\uB179\uD669\uC0C9\uCC44\uC18C \uB2E4\uB7C9)",
  "\uC624\uBA54\uAC003",
  "\uD504\uB85C\uBC14\uC774\uC624\uD2F1\uC2A4"
];

// src/index.ts
function loadKb() {
  return validateKb(interactions_default);
}

export { ABSTAIN_MESSAGE, DRUG_CLASSES, SUPPLEMENTS, loadKb, lookup, validateKb };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map