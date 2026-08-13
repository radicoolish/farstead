# Investment Scenario Planner

A multi-section financial planning app, built with Streamlit.

## Sections

1. **401(k) Planner** (current) — track multiple people's 401(k)s and project balances to retirement.
2. More sections coming later.

## Section 1: 401(k) Planner

For each person you can enter:

- Current 401(k) balance
- Current annual salary (needed to turn the contribution/match percentages into dollar amounts)
- % of salary contributed
- % of salary matched
- Assumed annual salary increase (%)
- Assumed annual growth rate (%)
- Birthday (used to calculate current age)
- Account type: Pre-tax or Roth
- Retirement / draw age

The app projects each person's balance year-by-year from their current age to their retirement age, using the assumptions above, and shows a chart plus a combined household summary.

Entered data is saved locally to `data/people.json` (git-ignored) so it persists between runs.

## Running locally

```bash
pip install -r requirements.txt
streamlit run app.py
```
