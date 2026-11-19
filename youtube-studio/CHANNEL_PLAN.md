# Channel plan: a meaningful, high-earning 3D explainer channel

## 1. Is the method worth using? Yes, with three cautions

**What's true:** Three.js + Remotion can produce this "3D toy explainer" look without paying for
AI video generators. This repo proves it: `out/demo.mp4` renders from code.

**Cautions before you build on it:**

1. **"45 minutes per video" isn't realistic at first.** Expect 1–2 days per video for the first
   10 videos, until your scene library grows. The speed comes from *reusing* components, not from magic.
2. **Don't install a random plugin zip from a video description without reading it.** A plugin
   runs code on your machine. You don't need it anyway: `src/components/` is your own version,
   and it's original.
3. **The biggest risk is YouTube's monetization policy, not production.** Since July 2025 the
   YouTube Partner Program has refused to monetize "inauthentic" (mass-produced, repetitive,
   template-only) content. Channels that just pump out AI scripts plus the same animation get
   rejected or demonetized. Your protection: **real research, a point of view, recurring
   characters, and each video built differently.** That is also what makes content "meaningful".

## 2. The maths behind "6 figures"

$100k/year ≈ $8,300/month. Personal-finance content has some of the highest ad rates on YouTube.
RPM (what *you* earn per 1,000 views) is commonly reported around $8–20 for US/UK/CA audiences.
These are estimates; yours depends on audience country and season.

| Revenue source | Typical target once established |
|---|---|
| AdSense: ~600k views/month × ~$12 RPM | ~$7,000/month |
| 1 sponsor per video (budgeting apps, brokers, learning platforms) × 4 | $2,000–8,000/month |
| Affiliate links + a small digital product (e.g. a budget template) | $500–2,000/month |

A realistic timeline: 30–50 videos and 12–18 months of weekly uploads. Sponsors usually matter
more than AdSense to reach six figures.

## 3. Niche choice

**Broad niche: Money / personal finance.** It's evergreen, it keeps growing (inflation, AI and
jobs, housing, retirement anxiety), and it has some of the highest RPMs on the platform.

**Recommended sub-niche: "The science of money and happiness."**
Each video takes **one real study or experiment** about money and human behaviour and animates it,
then ends with one practical takeaway.

Why this one:
- **Meaningful.** It helps people make better money decisions, backed by evidence, not hype.
- **Differentiated.** Most finance channels give opinions or "get rich" tips; you bring research
  with sources in the description. That also protects you from the inauthentic-content rule.
- **Endless ideas.** Behavioural economics and psychology have thousands of studies.
- **It suits the animation.** Experiments have characters, a setup, a twist and a result, which
  is exactly what 3D toy characters dramatise well.
- **It sits between psychology and finance**, so it can reach both audiences.

Alternatives, if this one doesn't excite you (you'll need to love the topic for 50+ videos):
- *The hidden economics of everyday things:* why cinema popcorn costs $9, why airlines oversell seats.
- *Money history:* how credit cards, mortgages or the 40-hour week were invented.
- *Money around the world:* how a salary of X actually lives in Tokyo vs Cairo vs Texas.

## 4. Brand

- **Working name ideas:** *The Money Lab*, *Wallet Science*, *Rich in Research*. Check that the
  YouTube handle and .com are free first.
- **Recurring cast** (already in the code): **Blue**, the everyday earner who makes the common
  mistake, and **Red**, the skeptic who "checks the data". Viewers come back for characters.
- **Look:** warm paper background, money-green highlights, chunky captions (see `src/theme.ts`).
- **Promise (channel tagline):** *"What the research actually says about your money."*

## 5. First 10 video ideas

1. Does money buy happiness? The $75k myth and what newer research found
2. Why winning the lottery doesn't make people as happy as they expect
3. The marshmallow test was wrong about willpower. Here's what predicts wealth instead
4. Why spending on experiences beats buying things (and when it doesn't)
5. Why a $5 coffee feels worse than a $500 phone payment: the "pain of paying"
6. The experiment that shows you'd rather earn less, as long as you earn more than your neighbour
7. Why scarcity makes smart people make bad money decisions
8. Buying time: the study showing that paying to avoid chores increases happiness
9. Why we save more when the future self looks like us
10. The "hedonic treadmill": why every raise feels smaller than the last

Each title should still pass the "would I click this?" test. Write the title and thumbnail
**before** the script.

## 6. Production system (per video)

1. Pick the study, read the actual paper or summary, and note 3 surprising facts. (1–2 h)
2. Script with this structure: hook → the myth → the experiment → the twist → what it means for
   you → takeaway. Aim for 6–9 minutes. (2 h)
3. Voiceover: use ElevenLabs, or better, your own voice later on.
4. Animate with the components here; add one new reusable component per video.
5. Thumbnail: one character, one emotion, one number or object. 3 words maximum.
6. Description: cite the sources. Pinned comment: ask a question to drive comments.

## 7. First 90 days

| Weeks | Goal |
|---|---|
| 1–2 | Lock the name, brand and 2 characters. Build 8–10 reusable scene components |
| 3–12 | Publish 1 long video per week, plus 2–3 Shorts cut from each video |
| Every week | Check click-through rate (aim for 5%+) and retention at 30s (aim for 70%+). Remake whatever underperforms |
| After 10 videos | Double down on the topics that held viewers longest |
