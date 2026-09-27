# Scoring & Ratings — How the Numbers Are Calculated

This is the reference for every calculated number in the dashboard: KPI progress, Consistency, Objectives, and the Composite Score. If a number on screen looks wrong, this doc tells you which rule produced it.

---

## 1. KPI Goals — the basic building block

A **Goal** is a target number of tasks marked **"done"**, within a period (Weekly, Monthly, or Annual).

- **Department default**: applies to every member of that department, for that period.
- **Individual override**: applies to one specific person, for that period. **An override always wins** over the department default for that person — the department default simply doesn't apply to them for that period.
- Only one goal can exist per (department, period) pair, and per (person, period) pair — creating a second one updates the first rather than adding a duplicate.

**Progress calculation** (`lib/goals.ts`):
```
progress = count of that person's tasks where status = "done"
           AND task_date falls inside the current period's date range
target   = the goal's targetCount
```

**Period date ranges** (always based on today's date, recalculated live — nothing is stored per-period):
- **Weekly**: Monday through Sunday of the current week.
- **Monthly**: the 1st through the last day of the current calendar month.
- **Annual**: January 1 through December 31 of the current year.

There's no partial credit or rollover — a task done yesterday doesn't count toward this week's goal if yesterday was in a previous week.

---

## 2. KPI Progress page

Simply displays, for every member (and department leads), each of their currently-applicable goals (weekly/monthly/annual) with a progress bar: `progress / target`. Color: green ≥ 100%, amber ≥ 50%, red below.

No averaging or scoring happens here — it's a direct, per-person view of section 1's numbers.

---

## 3. Consistency

**Not related to "done" status at all.** This measures whether someone is *showing up*, regardless of whether their work is finished.

```
active_days = number of distinct calendar days, in the last 30 days,
              on which this person logged at least one task
              (any status: pending, in-progress, or done)
score shown = active_days / 30
```

This is why someone can have a perfect Consistency score while their KPI completion is low, or vice versa — they measure different things on purpose (showing up vs. finishing work).

---

## 4. Objectives

An Objective is a department's monthly "why." Its progress combines **up to two independent sources**, each optional:

### 4a. Linked KPIs (`kpiAveragePct`)
Any Goal (from section 1) can be linked to an Objective. For each **linked, Monthly-period** goal:
```
goal_completion_% = min(100, (done_tasks_in_current_month / target) × 100)
```
- If the goal is an **individual override**, this is just that one person's %.
- If the goal is a **department default**, it's the **average** of that % across every department member who doesn't have their own override for that period (members with an override are excluded from this average, since the default doesn't apply to them).

If more than one Goal is linked to the same Objective, their percentages are averaged together (simple average, unweighted) to get `kpiAveragePct`.

### 4b. Directly-tagged tasks (`taskProgress`)
If the Objective has a **target task count** set, this counts:
```
tagged_done = tasks tagged to this Objective, status = "done",
              logged within the current calendar month
progress    = tagged_done / targetTaskCount
```

### 4c. Combining into `overallPct`
- If **both** 4a and 4b have data: `overall = average(kpiAveragePct, taskPct)` — a simple 50/50 average of the two percentages.
- If **only one** has data: that one alone is the overall figure.
- If **neither** has data: shown as "no progress data yet" rather than 0%, since 0% would misleadingly suggest failure rather than "nothing set up yet."

---

## 5. Composite KPI Score

The most involved calculation — one 0–100 "how is this person doing overall" number per month, combining objective task counts with subjective manager ratings.

### 5a. Core score (automatic, from task counts)
Looks at this person's **Monthly**, **Category = Core** goal — their individual override if they have one, otherwise their department's Core/Monthly default.
```
core_% = min(100, (done_tasks_this_month / target) × 100)
```
Only **one** Core/Monthly goal is considered per person (their applicable one, per the override rule in section 1) — this is a simplification; see the note at the bottom.

### 5b. Behavioural score (manual, from manager ratings)
```
behavioural_% = average(all ManualScore entries for this person,
                         where periodLabel = current "YYYY-MM")
                × 10
```
Manual scores are entered 0–10 by an admin or lead (Members → person's profile → "Manual scores"). Multiple entries in the same month are simple-averaged, then multiplied by 10 to put them on the same 0–100 scale as the Core score.

### 5c. Overall score
```
if both Core and Behavioural have data:
    overall = (core_% × 0.65) + (behavioural_% × 0.35)
else if only Core has data:
    overall = core_%
else if only Behavioural has data:
    overall = behavioural_%
else:
    overall = null ("No data")
```
The 65/35 split is a fixed constant (`CORE_WEIGHT` / `BEHAVIOURAL_WEIGHT` in `lib/compositeScore.ts`) — matching the original spec this feature was modeled on. **Missing data is never scored as zero** — if someone has no manual scores yet, their Core score alone is their Overall, not a Core score dragged down by an assumed-zero Behavioural half.

### 5d. Rating label
```
overall >= 80  → "Excellent"
overall >= 60  → "Good"
overall <  60  → "Needs improvement"
overall = null → "No data"
```
These thresholds (`scoreLabel()` in `lib/compositeScore.ts`) are a reasonable starting point, not derived from anything — adjust them in that file if your organization wants different bands.

### Known simplification, worth knowing about
The original system this was modeled on supports **multiple weighted KPIs per person within the Core and Behavioural buckets** (e.g., three different Core KPIs, each with their own weight, averaged together). This app currently supports **one Core/Monthly goal per person** (via the standard override-or-default rule) rather than multiple simultaneously-weighted KPIs feeding into Core. If you need several Core KPIs averaged together per person, that's a deliberate follow-up to `getCoreScore()` in `lib/compositeScore.ts`, not something already handled.

---

## Where each number lives in the code

| Calculation | File |
|---|---|
| Goal progress, period date ranges | `src/lib/goals.ts` |
| Objective progress (KPI + task rollup) | `src/lib/objectives.ts` |
| Composite score (Core + Behavioural) | `src/lib/compositeScore.ts` |
| Consistency (active days) | `src/app/admin/consistency/page.tsx` |
