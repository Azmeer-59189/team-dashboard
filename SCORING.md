# Scoring & Ratings: A Manager's Guide

This guide explains what the dashboard's numbers mean, what you need to enter, and how the monthly individual score is calculated. You do not need to calculate scores by hand; the dashboard does that for you.

## Start here: three different views

- **KPI progress** answers: “How many tasks has this person completed toward their target?”
- **Consistency** answers: “On how many recent days did this person log a task?” It does not measure task completion.
- **Objectives** answer: “How much progress has the department made toward this month's objective?”

The **Composite KPI Score** is a separate monthly view for each individual. It combines a task-based Core score with a manager-entered Behavioural score when both are available. The department filter shows members in that department; it does not create a team score.

## What a manager needs to do

1. Set up the relevant goals for the department or person. A department goal is the default; a person's individual goal takes precedence for that period. For the Composite Score, only the applicable monthly Core goal is currently used; the goal form's category and weight settings do not alter its calculation.
2. Keep tasks up to date. A task counts toward goal progress when it is marked done and its task date falls within the period.
3. If you want a Behavioural component, open **Members**, select the person, and add one or more **Manual scores** on their profile. Choose a competency, enter a score from 0 to 10, select the month, and optionally add notes. The app does not create this assessment for you.
4. Review the person's Core, Behavioural, Overall, and rating label on the Composite KPI Scores page.

You can still review task progress when no manual score has been entered. Missing information is not automatically treated as a zero.

## The monthly individual score, in plain language

### Core: progress against the monthly task goal

Core uses the person's applicable **monthly Core goal**: their individual goal if one exists, otherwise the department's default monthly Core goal. It compares the number of that person's tasks marked done this month with the target. Progress is capped at 100%.

**Example:** The target is 20 tasks and the person has completed 15 this month. Core is 75%.

Only one monthly Core goal applies to a person under the current goal rules. Other goals can still appear in KPI progress, but they are not added into this Core component.

### Behavioural: the manager's assessment

Behavioural comes from manual scores you enter for that person for the current month. Each entry is scored from 0 to 10. The app averages all of the person's entries for that month, giving every entry equal weight, then converts the average to a percentage.

**Example:** Teamwork 8/10 and Communication 6/10 average to 7/10, which becomes 70% Behavioural. The competency names and notes are kept with the entries, but they do not change the calculation.

### Overall: how the two parts combine

When both parts are available, Core contributes 65% and Behavioural contributes 35%:

`Overall = (Core × 0.65) + (Behavioural × 0.35)`

**Example:** Core 75% and Behavioural 70% gives an Overall of 73.25, displayed as 73/100.

If only one part is available, that part becomes the Overall by itself. If neither is available, the result is **No data**. So an Overall based on Core alone is not calculated the same way as one based on both parts; check the Core and Behavioural columns to see what went into it.

The page's rating label is based on Overall:

- **80 or above:** Excellent
- **60 to 79:** Good
- **Below 60:** Needs improvement
- **No Overall score:** No data

These labels summarize the number; they do not explain why a person received it. Review the underlying components and, where applicable, the manager's notes for context.

## Team view

Composite KPI Scores lists individual members. Filtering by department narrows the list but does not average members into a department score or apply one manager rating to a whole team. Compare individual rows to review the department. A team-level score is not currently defined.

## Other dashboard numbers

### KPI goals and progress

A goal is a target number of tasks marked done within a period: weekly, monthly, or annual. A department default applies to department members unless an individual goal overrides it for that person and period. Only one goal can exist per department and period, and per person and period; creating another updates the existing goal.

KPI progress is the person's done-task count in the relevant date range compared with the goal's target. The period ranges are the current Monday–Sunday week, calendar month, or calendar year. There is no partial credit or carry-over from earlier periods. KPI Progress shows each person's applicable goals directly; it does not average them into a score.

### Consistency

Consistency counts distinct days in the last 30 days when the person logged at least one task, whatever its status. It is shown as active days out of 30. It measures task logging activity, not whether tasks were completed.

### Objectives

An Objective tracks a department's monthly aim. Its progress can use linked monthly goals, tasks tagged directly to the Objective, or both:

- For a linked monthly goal, completion is done tasks this month divided by its target, capped at 100%. An individual goal contributes that person's progress. A department default contributes the average progress of members to whom that default applies; members with individual overrides are excluded.
- If the Objective has a target task count, tagged tasks marked done this month are compared with that target.
- If both sources are configured, their percentages are averaged equally. If only one is configured, that source is used. If neither is configured, the dashboard shows no progress data yet.

## Calculation reference

These formulas are included for anyone who wants the detail; managers can use the dashboard without calculating them manually.

```text
Core % = min(100, done tasks this month / applicable monthly Core goal target × 100)
Behavioural % = average of this person's manual scores for the current YYYY-MM month × 10
Overall = Core % × 0.65 + Behavioural % × 0.35  (when both exist)
```

If only one component exists, Overall equals that component; if neither exists, Overall is null (“No data”). The weights and labels are configured in `src/lib/compositeScore.ts`.

| Calculation | Source file |
|---|---|
| Goal progress and period date ranges | `src/lib/goals.ts` |
| Objective progress | `src/lib/objectives.ts` |
| Composite score and rating labels | `src/lib/compositeScore.ts` |
| Consistency | `src/app/admin/consistency/page.tsx` |
