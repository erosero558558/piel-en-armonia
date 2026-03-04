# Public V6 Copy System (R4)

Version: 2026-03-04-r4
Scope: public-v6 ES/EN (home, hub, service, telemedicine, legal, navigation, shell labels)

## Editorial goal

Deliver a premium, sober dermatology voice that feels human, precise, and trustworthy for Quito.

## Voice model

### ES (Quito)

- Register: professional `usted`.
- Rhythm: short and sharp.
- Frame per block: `impacto -> criterio medico -> siguiente paso`.
- Lexicon: clear, modern clinical language. No bureaucratic or robotic phrasing.
- Product-style cadence: lead with user benefit, then medical criteria, then action.

### EN (Global premium)

- Not literal translation.
- Keep emotional and clinical equivalence.
- Prefer concise, international healthcare language.

## Length constraints

- Hero category: 1-3 words.
- Hero title: 6-11 words.
- Hero description: 14-24 words.
- Grid card title: 4-10 words.
- Grid card copy: 10-22 words.
- News strip headline: 10-20 words.
- Booking status title: 3-7 words.
- Booking status description: 14-28 words.

## Clinical/legal guardrails

- No absolute claims.
- No guaranteed outcomes.
- No risk-free or cure-final language.
- No legal reinterpretation.
- Keep legal clauses operational and readable.

## Banned claims (ES/EN)

- `garantizado`
- `100%`
- `cura definitiva`
- `sin riesgos`
- `guaranteed`
- `definitive cure`
- `risk-free`

## Style anti-patterns

- Generic protocol filler without patient value.
- Inflated jargon without decision meaning.
- Contradictory tone between home and internal pages.
- Technical internal wording visible to users.
- Legacy freeze wording such as `agenda transaccional en actualizacion` or `transactional schedule in update`.

## Navigation language

- Use direct dermatology information architecture.
- Avoid generic corporate labels when a clinical label is clearer.
- Keep hierarchy and interaction model aligned with V6 Sony-like shell.

## Booking freeze copy standard

Template:

1. State current availability status in plain language.
2. Clarify what remains active now.
3. Offer one practical next action.

## Consistency rules

- Same promise from hero to booking status.
- Same terminology for key routes across home/hub/service/tele/legal.
- ES always uses `usted` in public route narratives.

## QA contract

- `audit:public:v6:copy` must pass with strict mode.
- `public-v6-copy.spec.js` must pass for ES/EN coherence.
- `public-v6-copy-contract.test.js` must validate required labels/UI keys.
- `audit:public:v6:sony-parity` must stay >= 50 points.
