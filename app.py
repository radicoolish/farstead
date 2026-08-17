import html
import itertools
import json
import re
import uuid
from datetime import date
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

DATA_FILE = Path(__file__).parent / "data" / "people.json"
EXPENSES_FILE = Path(__file__).parent / "data" / "expenses.json"

st.set_page_config(page_title="Investment Scenario Planner", layout="wide")


# ---------- Persistence ----------

def load_people() -> list[dict]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return []


def save_people(people: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(people, indent=2, default=str))


def load_expenses() -> list[dict]:
    if EXPENSES_FILE.exists():
        return json.loads(EXPENSES_FILE.read_text())
    return []


def save_expenses(expenses: list[dict]) -> None:
    EXPENSES_FILE.parent.mkdir(parents=True, exist_ok=True)
    EXPENSES_FILE.write_text(json.dumps(expenses, indent=2, default=str))


def normalize_scenarios(person: dict) -> list[dict]:
    scenarios = person.setdefault("scenarios", [])
    for i, scenario in enumerate(scenarios):
        if "name" not in scenario:
            scenario["name"] = f"Scenario {i + 1}"
        scenario.setdefault("detail", scenario.get("label", scenario["name"]))
    return scenarios


def normalize_person(person: dict) -> None:
    normalize_scenarios(person)
    # Stop Contribution Age defaults to retirement age for people saved
    # before this field existed.
    person.setdefault("stop_contribution_age", person["retirement_age"])
    # Income-section fields for people saved before that section existed.
    person.setdefault("hsa_monthly", 0.0)
    person.setdefault("medical_insurance_monthly", 0.0)
    person.setdefault("tax_rate_pct", 22.0)
    # Social Security fields for people saved before that feature existed.
    person.setdefault("social_security_claim_age", 67)
    person.setdefault("social_security_monthly", 0.0)


# ---------- Export / Import ----------
# JSON (not CSV) so the nested per-person scenario lists round-trip without
# a flattening/reconstruction step.

REQUIRED_PERSON_KEYS = {
    "id", "name", "birthday", "current_salary", "contribution_pct",
    "current_balance", "match_pct", "salary_increase_pct", "growth_rate_pct",
    "account_type", "retirement_age", "scenarios",
}
REQUIRED_EXPENSE_KEYS = {
    "id", "type", "monthly_amount", "is_loan", "is_perpetuity", "apply_inflation",
}


def build_export_payload() -> dict:
    return {
        "app": "investment-scenario-planner",
        "version": 1,
        "exported_at": date.today().isoformat(),
        "people": st.session_state.people,
        "expenses": st.session_state.expenses,
        "settings": {
            "current_age_for_expenses": st.session_state.get("expenses_current_age"),
            "withdrawal_rate_pct": st.session_state.get("withdrawal_rate_pct"),
        },
    }


def validate_import_payload(data) -> str | None:
    """Returns an error message if `data` isn't a valid scenario export,
    else None."""
    if not isinstance(data, dict):
        return "That file isn't a valid scenario file (expected a JSON object at the top level)."
    if "people" not in data or "expenses" not in data:
        return "That file is missing 'people' or 'expenses' — it doesn't look like a scenario file exported from this app."
    people, expenses = data["people"], data["expenses"]
    if not isinstance(people, list) or not isinstance(expenses, list):
        return "'people' and 'expenses' must be lists — this file's structure doesn't match a scenario export."
    for i, person in enumerate(people):
        if not isinstance(person, dict) or not REQUIRED_PERSON_KEYS.issubset(person.keys()):
            return f"Person #{i + 1} in the file is missing required fields — this doesn't look like a valid scenario file."
    for i, expense in enumerate(expenses):
        if not isinstance(expense, dict) or not REQUIRED_EXPENSE_KEYS.issubset(expense.keys()):
            return f"Expense #{i + 1} in the file is missing required fields — this doesn't look like a valid scenario file."
    return None


if "people" not in st.session_state:
    st.session_state.people = load_people()
    for p in st.session_state.people:
        normalize_person(p)

if "expenses" not in st.session_state:
    st.session_state.expenses = load_expenses()


# ---------- Color palette ----------
# One deliberate, cohesive palette for every chart in the app. The per-person
# chart uses it as fixed categorical colors (Base is always the neutral
# slate; scenarios take the accent colors in order). The household
# combinations charts use the same hue family but as a light-to-dark
# sequential green scale, since color there encodes projected value rather
# than category identity.
PERSON_CHART_PALETTE = ["#334155", "#2563eb", "#d97706", "#7c3aed", "#0891b2"]


# ---------- Scenario field config ----------
# Fields a scenario is allowed to vary. Current balance, birthday, employer
# match, current salary, and account type stay fixed from the base person.
SCENARIO_FIELDS = {
    "% of Salary Contributed": {"key": "contribution_pct", "min": 0.0, "max": 50.0, "step": 0.5, "percent": True},
    "Annual Salary Increase (%)": {"key": "salary_increase_pct", "min": 0.0, "max": 15.0, "step": 0.25, "percent": True},
    "Annual Growth Rate (%)": {"key": "growth_rate_pct", "min": 0.0, "max": 15.0, "step": 0.25, "percent": True},
    "Retirement / Draw Age": {"key": "retirement_age", "min": 1, "max": 100, "step": 1, "percent": False},
    "Stop Contribution Age": {"key": "stop_contribution_age", "min": 1, "max": 100, "step": 1, "percent": False},
}

# A scenario type that isn't a simple single-field override: the income
# steps to a new, flat annual amount starting at a given age and stays
# there (no further raises) through retirement.
INCOME_CHANGE_LABEL = "Different Income Until Retirement"


# ---------- Household expense config ----------
EXPENSE_TYPES = [
    "Mortgage", "Heloc/Loans", "Auto Loans", "Utilities", "Groceries",
    "Health Insurance", "Property Taxes", "Life Insurance", "Student Loans",
    "Gas", "529 / College Savings", "Daycare", "Other Costs",
]
# These get a Current Payment + Remaining Term instead of perpetuity/start-stop
# and inflation — a fixed loan payment that automatically falls off once paid.
LOAN_EXPENSE_TYPES = {"Mortgage", "Heloc/Loans", "Auto Loans", "Student Loans"}
EXPENSE_HORIZON_AGE = 85


def categorical_palette(n: int) -> list[str]:
    """n distinct hues, evenly spaced around the color wheel."""
    return [f"hsl({round(i * 360 / n)}, 55%, 52%)" for i in range(n)]


EXPENSE_PALETTE = dict(zip(EXPENSE_TYPES, categorical_palette(len(EXPENSE_TYPES))))


# ---------- Income tax estimate config ----------
# Approximate, for planning purposes only — not tax advice. Federal brackets
# and the standard deduction are 2024 figures; state rates are single-number
# approximations (most states have their own bracket schedules, but modeling
# all 50 in full is out of scope for a planning tool, not a tax preparer).
FILING_STATUSES = ["Single", "Married Filing Jointly", "Married Filing Separately", "Head of Household"]

FEDERAL_BRACKETS_2024 = {
    "Single": [
        (0, 0.10), (11600, 0.12), (47150, 0.22), (100525, 0.24),
        (191950, 0.32), (243725, 0.35), (609350, 0.37),
    ],
    "Married Filing Jointly": [
        (0, 0.10), (23200, 0.12), (94300, 0.22), (201050, 0.24),
        (383900, 0.32), (487450, 0.35), (731200, 0.37),
    ],
    "Head of Household": [
        (0, 0.10), (16550, 0.12), (63100, 0.22), (100500, 0.24),
        (191950, 0.32), (243700, 0.35), (609350, 0.37),
    ],
}
# Married Filing Separately brackets track Single closely enough at most
# incomes to approximate with the same table.
FEDERAL_BRACKETS_2024["Married Filing Separately"] = FEDERAL_BRACKETS_2024["Single"]

STANDARD_DEDUCTION_2024 = {
    "Single": 14600, "Married Filing Jointly": 29200,
    "Married Filing Separately": 14600, "Head of Household": 21900,
}

# Approximate effective state income tax rate (%) for a typical earner.
STATE_TAX_RATES = {
    "Alabama": 5.0, "Alaska": 0.0, "Arizona": 2.5, "Arkansas": 4.4, "California": 9.3,
    "Colorado": 4.4, "Connecticut": 6.5, "Delaware": 6.6, "Florida": 0.0, "Georgia": 5.39,
    "Hawaii": 8.25, "Idaho": 5.8, "Illinois": 4.95, "Indiana": 3.05, "Iowa": 5.7,
    "Kansas": 5.7, "Kentucky": 4.5, "Louisiana": 4.25, "Maine": 7.15, "Maryland": 5.75,
    "Massachusetts": 5.0, "Michigan": 4.25, "Minnesota": 7.85, "Mississippi": 5.0, "Missouri": 4.95,
    "Montana": 5.9, "Nebraska": 5.84, "Nevada": 0.0, "New Hampshire": 0.0, "New Jersey": 6.37,
    "New Mexico": 4.9, "New York": 6.85, "North Carolina": 4.5, "North Dakota": 2.5, "Ohio": 3.5,
    "Oklahoma": 4.75, "Oregon": 8.75, "Pennsylvania": 3.07, "Rhode Island": 5.99, "South Carolina": 6.4,
    "South Dakota": 0.0, "Tennessee": 0.0, "Texas": 0.0, "Utah": 4.65, "Vermont": 6.6,
    "Virginia": 5.75, "Washington": 0.0, "West Virginia": 5.12, "Wisconsin": 5.3, "Wyoming": 0.0,
    "District of Columbia": 8.5,
}


def calculate_federal_tax(taxable_income: float, filing_status: str) -> float:
    brackets = FEDERAL_BRACKETS_2024[filing_status]
    tax = 0.0
    for i, (threshold, rate) in enumerate(brackets):
        if taxable_income <= threshold:
            break
        next_threshold = brackets[i + 1][0] if i + 1 < len(brackets) else float("inf")
        tax += (min(taxable_income, next_threshold) - threshold) * rate
    return tax


def estimate_effective_tax_rate(
    state: str, filing_status: str, annual_salary: float, pretax_reductions: float = 0.0
) -> float:
    """Approximate combined federal + state effective tax rate (%) on gross
    salary, for planning only — not tax advice."""
    if annual_salary <= 0:
        return 0.0
    taxable_income = max(annual_salary - STANDARD_DEDUCTION_2024[filing_status] - pretax_reductions, 0.0)
    federal_rate = calculate_federal_tax(taxable_income, filing_status) / annual_salary * 100
    return federal_rate + STATE_TAX_RATES.get(state, 0.0)


# ---------- Social Security estimate config ----------
# Approximate, for planning purposes only — not an official SSA estimate.
# Real Social Security uses a 35-year wage-indexed earnings history; this
# tool only has a single current salary, so that salary stands in as an
# average-career-earnings proxy. Bend points and the taxable maximum are
# 2024 figures.
SS_BEND_POINTS_2024 = (1174, 7078)  # monthly AIME bend points
SS_TAXABLE_MAX_2024 = 168600  # annual wage base


def estimate_aime(current_salary: float) -> float:
    """Approximate Average Indexed Monthly Earnings, capped at the Social
    Security taxable maximum."""
    return min(current_salary, SS_TAXABLE_MAX_2024) / 12


def calculate_primary_insurance_amount(aime: float) -> float:
    """Monthly benefit at full retirement age, via the 2024 PIA bend-point
    formula: 90% of AIME up to the first bend point, 32% up to the second,
    15% beyond it."""
    b1, b2 = SS_BEND_POINTS_2024
    if aime <= b1:
        return aime * 0.90
    if aime <= b2:
        return b1 * 0.90 + (aime - b1) * 0.32
    return b1 * 0.90 + (b2 - b1) * 0.32 + (aime - b2) * 0.15


def full_retirement_age_months(birth_year: int) -> int:
    """SSA full retirement age, in total months, by birth year."""
    if birth_year <= 1937:
        return 65 * 12
    if birth_year >= 1960:
        return 67 * 12
    if 1943 <= birth_year <= 1954:
        return 66 * 12
    if birth_year <= 1942:
        return 65 * 12 + (birth_year - 1937) * 2
    return 66 * 12 + (birth_year - 1954) * 2


def claim_age_adjustment_factor(claim_age_months: int, fra_months: int) -> float:
    """Multiplier on the Primary Insurance Amount for claiming earlier (as
    early as 62) or later (delayed retirement credits stop accruing at 70)
    than full retirement age."""
    diff = claim_age_months - fra_months
    if diff == 0:
        return 1.0
    if diff < 0:
        early_months = min(-diff, fra_months - 62 * 12)
        first_36 = min(early_months, 36)
        remaining = max(early_months - 36, 0)
        reduction = first_36 * (5 / 9 / 100) + remaining * (5 / 12 / 100)
        return 1 - reduction
    delayed_months = min(diff, 70 * 12 - fra_months)
    return 1 + delayed_months * (2 / 3 / 100)


def estimate_monthly_social_security(current_salary: float, birthday: date, claim_age: int) -> float:
    """Approximate monthly Social Security benefit at a given claim age, for
    planning only — not an official SSA estimate."""
    pia = calculate_primary_insurance_amount(estimate_aime(current_salary))
    fra_months = full_retirement_age_months(birthday.year)
    factor = claim_age_adjustment_factor(claim_age * 12, fra_months)
    return pia * factor


# ---------- Helpers ----------

def calculate_age(birthday: date) -> int:
    today = date.today()
    return today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))


def format_compact_currency(value: float) -> str:
    abs_value = abs(value)
    if abs_value >= 1_000_000:
        return f"${value / 1_000_000:.1f}MM"
    if abs_value >= 1_000:
        return f"${value / 1_000:.0f}K"
    return f"${value:,.0f}"


def project_balance(person: dict, overrides: dict | None = None) -> pd.DataFrame:
    effective = {**person, **(overrides or {})}

    age = calculate_age(date.fromisoformat(effective["birthday"]))
    years_to_grow = max(effective["retirement_age"] - age, 0)
    stop_contribution_age = effective.get("stop_contribution_age", effective["retirement_age"])
    # {"age", "new_salary", and optionally "contribution_pct"/"match_pct"/
    # "salary_increase_pct"} when a "Different Income Until Retirement"
    # scenario is active, else None. Missing rate keys (older saved
    # scenarios) fall back to the person's own current rates.
    income_change = effective.get("income_change")
    income_triggered = False

    balance = effective["current_balance"]
    salary = effective["current_salary"]
    contrib_pct = effective["contribution_pct"] / 100
    match_pct = effective["match_pct"] / 100
    salary_growth = effective["salary_increase_pct"] / 100
    growth_rate = effective["growth_rate_pct"] / 100

    rows = [{"Age": age, "Year": date.today().year, "Balance": round(balance, 2)}]
    for i in range(1, years_to_grow + 1):
        current_age = age + i
        if income_change and not income_triggered and current_age >= income_change["age"]:
            # Income (and optionally contribution/match/raise rates) steps
            # to the new values once, then compounds normally from there.
            salary = income_change["new_salary"]
            contrib_pct = income_change.get("contribution_pct", effective["contribution_pct"]) / 100
            match_pct = income_change.get("match_pct", effective["match_pct"]) / 100
            salary_growth = income_change.get("salary_increase_pct", effective["salary_increase_pct"]) / 100
            income_triggered = True
        if current_age <= stop_contribution_age:
            annual_contribution = salary * (contrib_pct + match_pct)
        else:
            annual_contribution = 0.0
        balance = balance * (1 + growth_rate) + annual_contribution
        salary = salary * (1 + salary_growth)
        rows.append({
            "Age": current_age,
            "Year": date.today().year + i,
            "Balance": round(balance, 2),
        })
    return pd.DataFrame(rows)


def render_totals_row(person: dict, base_df: pd.DataFrame) -> None:
    """Compact, small-font row of Base + scenario projected balances, with a
    B/(W) dollar variance vs Base under each scenario."""
    base_balance = base_df.iloc[-1]["Balance"]
    entries = [("Base", base_balance, None, int(base_df.iloc[-1]["Age"]))]
    for scenario in person["scenarios"]:
        s_df = project_balance(person, {scenario["field"]: scenario["value"]})
        s_balance = s_df.iloc[-1]["Balance"]
        entries.append((scenario["name"], s_balance, s_balance - base_balance, int(s_df.iloc[-1]["Age"])))

    cols = st.columns(len(entries))
    for col, (name, balance, diff, end_age) in zip(cols, entries):
        safe_name = html.escape(str(name))
        if diff is None:
            variance_html = "&nbsp;"
            variance_color = "inherit"
        else:
            is_better = diff >= 0
            variance_color = "#1a7f37" if is_better else "#cf222e"
            sign = "B" if is_better else "(W)"
            variance_html = f"{'▲' if is_better else '▼'} {format_compact_currency(abs(diff))} {sign}"
        col.markdown(
            f"""
            <div style="text-align:center; line-height:1.3; padding:2px 1px;">
                <div style="font-size:0.68rem; opacity:0.65; white-space:nowrap; overflow:hidden;
                            text-overflow:ellipsis;" title="{safe_name}">{safe_name}</div>
                <div style="font-size:1.0rem; font-weight:700; white-space:nowrap;"
                     title="${balance:,.0f} at age {end_age}">{format_compact_currency(balance)}</div>
                <div style="font-size:0.7rem; font-weight:600; color:{variance_color}; white-space:nowrap;">
                    {variance_html}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


MAX_HOUSEHOLD_COMBOS = 100


def person_scenario_options(person: dict) -> list[tuple[str, dict]]:
    """Each person's own set of choices: their Base plus every scenario."""
    options = [("Base", {})]
    for scenario in person["scenarios"]:
        options.append((scenario["name"], {scenario["field"]: scenario["value"]}))
    return options


def project_series_by_year(person: dict, overrides: dict, end_year: int) -> pd.Series:
    """Project a person's balance by calendar year, extended past their own
    retirement year (growth-only compounding, no further contributions) so it
    can be combined with other people's series through a shared end_year."""
    df = project_balance(person, overrides)
    series = dict(zip(df["Year"], df["Balance"]))
    growth_rate = overrides.get("growth_rate_pct", person["growth_rate_pct"]) / 100

    year = max(series)
    balance = series[year]
    while year < end_year:
        year += 1
        balance = balance * (1 + growth_rate)
        series[year] = balance
    return pd.Series(series).sort_index()


def green_palette(n: int) -> list[str]:
    """n evenly-spaced shades of green, light to dark."""
    if n <= 1:
        return ["#15803d"]
    return [f"hsl(152, 45%, {78 - (i / (n - 1)) * 56:.0f}%)" for i in range(n)]


def build_household_combo_data(people: list[dict]) -> tuple[dict[str, pd.Series], int]:
    """Every combination of each person's Base/scenarios, summed together,
    e.g. 3 options for one person x 3 for another = 9 combined household
    series. Returns ({}, total_combos) if there are too many to compute
    for a clear chart."""
    per_person_choices = [
        [(person, name, overrides) for name, overrides in person_scenario_options(person)]
        for person in people
    ]
    total_combos = 1
    for choices in per_person_choices:
        total_combos *= len(choices)

    if total_combos > MAX_HOUSEHOLD_COMBOS:
        return {}, total_combos

    end_year = date.today().year
    for choices in per_person_choices:
        for person, _, overrides in choices:
            end_year = max(end_year, project_balance(person, overrides).iloc[-1]["Year"])

    combo_data = {}
    for combo in itertools.product(*per_person_choices):
        label = ", ".join(f"{person['name']}: {name}" for person, name, _ in combo)
        total = None
        for person, _, overrides in combo:
            series = project_series_by_year(person, overrides, end_year)
            total = series if total is None else total.add(series, fill_value=0)
        combo_data[label] = total

    return combo_data, total_combos


def render_household_combinations(combo_data: dict[str, pd.Series], total_combos: int) -> None:
    """Draw the line + bar charts for every household scenario combination."""
    if not combo_data:
        st.caption(
            f"{total_combos} scenario combinations across the household is too many to chart clearly "
            f"(limit is {MAX_HOUSEHOLD_COMBOS}). Remove some scenarios to see the combined view."
        )
        return

    st.markdown(f"**All Scenario Combinations** ({total_combos})")

    combo_labels = list(combo_data.keys())
    # Shared green-shades scale, assigned by each combination's final balance
    # (not by list order) so higher projected balances get darker green.
    # Neither chart renders its own legend — a single custom legend is drawn
    # below both instead.
    labels_by_value = sorted(combo_labels, key=lambda label: combo_data[label].iloc[-1])
    shades_by_value = green_palette(len(labels_by_value))
    color_scale = alt.Scale(domain=labels_by_value, range=shades_by_value)
    label_to_color = dict(zip(labels_by_value, shades_by_value))
    green_colors = [label_to_color[label] for label in combo_labels]

    long_df = (
        pd.concat(combo_data, axis=1)
        .rename_axis("Year")
        .reset_index()
        .melt(id_vars="Year", var_name="Combination", value_name="Balance")
    )
    line_chart = (
        alt.Chart(long_df)
        .mark_line()
        .encode(
            x=alt.X("Year:O", title="Year"),
            y=alt.Y("Balance:Q", title="Balance ($)", axis=alt.Axis(format="$,.2s")),
            color=alt.Color("Combination:N", scale=color_scale, sort=combo_labels, legend=None),
            tooltip=[
                alt.Tooltip("Combination:N"),
                alt.Tooltip("Year:O"),
                alt.Tooltip("Balance:Q", format="$,.0f"),
            ],
        )
        .properties(height=420)
    )

    line_col, bar_col = st.columns([3, 2])
    with line_col:
        st.altair_chart(line_chart, width="stretch")
    with bar_col:
        render_household_combo_bars(combo_data, combo_labels, color_scale)

    render_combo_legend(combo_labels, green_colors)


def render_combo_legend(combo_labels: list[str], colors: list[str]) -> None:
    """Single legend, centered below both charts, shared by the line and bar
    charts (which render with no legend of their own)."""
    swatches = "".join(
        f'<div style="display:flex; align-items:center; gap:6px; margin:4px 12px 4px 0;">'
        f'<span style="width:12px; height:12px; border-radius:2px; background:{color}; '
        f'display:inline-block; flex-shrink:0;"></span>'
        f'<span style="font-size:0.8rem;">{html.escape(label)}</span>'
        f"</div>"
        for label, color in zip(combo_labels, colors)
    )
    st.markdown(
        f'<div style="display:flex; flex-wrap:wrap; justify-content:center; '
        f'margin-top:6px;">{swatches}</div>',
        unsafe_allow_html=True,
    )


def readable_text_color(color: str) -> str:
    """White text on dark bar shades, near-black text on light bar shades."""
    match = re.search(r"hsl\([^,]+,[^,]+,\s*([\d.]+)%\)", color)
    lightness = float(match.group(1)) if match else 50.0
    return "#ffffff" if lightness < 50 else "#1a1a1a"


def render_household_combo_bars(
    combo_data: dict[str, pd.Series],
    combo_labels: list[str],
    color_scale: alt.Scale,
) -> None:
    """Bar chart of each combination's final projected balance, colored to
    match the line chart next to it (same scale, no legend of its own),
    ordered highest to lowest, with each bar labeled (in millions of
    dollars) inside the top of the bar."""
    order_desc = sorted(combo_labels, key=lambda label: combo_data[label].iloc[-1], reverse=True)
    color_map = dict(zip(color_scale.domain, color_scale.range))

    bar_df = pd.DataFrame({
        "Combination": order_desc,
        "Balance": [combo_data[label].iloc[-1] for label in order_desc],
    })
    bar_df["Label"] = bar_df["Balance"].apply(format_compact_currency)
    bar_df["TextColor"] = [readable_text_color(color_map[label]) for label in order_desc]

    bars = alt.Chart(bar_df).mark_bar().encode(
        x=alt.X("Combination:N", sort=order_desc, axis=None, title=None),
        y=alt.Y("Balance:Q", title="Balance ($)", axis=alt.Axis(format="$,.2s")),
        color=alt.Color("Combination:N", scale=color_scale, sort=order_desc, legend=None),
        tooltip=[alt.Tooltip("Combination:N"), alt.Tooltip("Balance:Q", format="$,.0f")],
    )
    labels = alt.Chart(bar_df).mark_text(dy=16, baseline="top", fontSize=13, fontWeight="bold").encode(
        x=alt.X("Combination:N", sort=order_desc),
        y="Balance:Q",
        text="Label:N",
        color=alt.Color("TextColor:N", scale=None, legend=None),
    )

    st.altair_chart((bars + labels).properties(height=420), width="stretch")


# ---------- Household expense helpers ----------

def project_expense_annual_costs(expense: dict, current_age: int, horizon_age: int) -> dict[int, float]:
    """{age: annual_cost} for age in current_age..horizon_age.

    Loans are a fixed payment that stops once the remaining term elapses.
    Everything else is either active the whole horizon (perpetuity) or only
    between start_age/stop_age, with its monthly cost compounding by the
    inflation rate every year from today regardless of when it's active —
    a cost that starts 5 years from now is already 5 years' worth of
    inflation higher by the time it kicks in.
    """
    results = {}
    monthly = expense["monthly_amount"]
    inflation_rate = (expense.get("inflation_rate") or 0.0) / 100 if expense.get("apply_inflation") else 0.0

    for i, age in enumerate(range(current_age, horizon_age + 1)):
        if expense.get("is_loan"):
            active = i < (expense.get("remaining_term_years") or 0)
            annual = monthly * 12 if active else 0.0
        else:
            if expense.get("is_perpetuity"):
                active = True
            else:
                start_age, stop_age = expense.get("start_age"), expense.get("stop_age")
                active = start_age is not None and stop_age is not None and start_age <= age <= stop_age
            inflated_monthly = monthly * ((1 + inflation_rate) ** i)
            annual = inflated_monthly * 12 if active else 0.0
        results[age] = annual

    return results


def build_expense_chart_df(expenses: list[dict], current_age: int, horizon_age: int) -> pd.DataFrame:
    """Long-format Age/Type/Cost, summed across expenses sharing a type."""
    rows = [
        {"Age": age, "Type": expense["type"], "Cost": cost}
        for expense in expenses
        for age, cost in project_expense_annual_costs(expense, current_age, horizon_age).items()
        if cost > 0
    ]
    if not rows:
        return pd.DataFrame(columns=["Age", "Type", "Cost"])
    return pd.DataFrame(rows).groupby(["Age", "Type"], as_index=False)["Cost"].sum()


def describe_expense(expense: dict) -> str:
    monthly_txt = f"${expense['monthly_amount']:,.0f}/mo"
    if expense.get("is_loan"):
        return f"{monthly_txt} — loan, {expense.get('remaining_term_years', 0)} yrs remaining"
    timing = "ongoing" if expense.get("is_perpetuity") else f"ages {expense.get('start_age')}–{expense.get('stop_age')}"
    inflation_txt = f"{expense.get('inflation_rate', 0):.1f}% inflation" if expense.get("apply_inflation") else "no inflation"
    return f"{monthly_txt} — {timing} — {inflation_txt}"


def project_household_net_income_by_age(
    people: list[dict], current_age: int, horizon_age: int, overrides_by_person: dict[str, dict] | None = None
) -> dict[int, float]:
    """Combined take-home income by household reference age, summed across
    everyone. Each person's own salary grows at their own raise assumption
    and stops the year they pass their own retirement age (not the
    household reference age, since people can be different ages).

    `overrides_by_person` lets a chosen 401k scenario (per person, keyed by
    id) override salary, contribution %, salary raise, retirement age, and
    the 'income_change' step — the same fields a scenario can vary in the
    401k Planner section — instead of always using each person's base
    assumptions. Tax rate, HSA, and medical insurance stay fixed from the
    Income section regardless of scenario, since no scenario field touches
    them."""
    overrides_by_person = overrides_by_person or {}
    totals = {age: 0.0 for age in range(current_age, horizon_age + 1)}
    for person in people:
        effective = {**person, **overrides_by_person.get(person["id"], {})}
        person_age = calculate_age(date.fromisoformat(effective["birthday"]))
        retirement_age = effective["retirement_age"]
        income_change = effective.get("income_change")
        income_triggered = False

        salary = effective["current_salary"]
        contribution_pct = effective["contribution_pct"]
        salary_growth = effective["salary_increase_pct"] / 100
        tax_rate_pct = effective.get("tax_rate_pct", 22.0)
        hsa_annual = effective.get("hsa_monthly", 0.0) * 12
        medical_annual = effective.get("medical_insurance_monthly", 0.0) * 12

        for i, age in enumerate(range(current_age, horizon_age + 1)):
            person_own_age = person_age + i
            if person_own_age > retirement_age:
                continue
            if income_change and not income_triggered and person_own_age >= income_change["age"]:
                salary = income_change["new_salary"]
                contribution_pct = income_change.get("contribution_pct", effective["contribution_pct"])
                salary_growth = income_change.get("salary_increase_pct", effective["salary_increase_pct"]) / 100
                income_triggered = True
            contribution = salary * contribution_pct / 100
            tax = salary * tax_rate_pct / 100
            totals[age] += salary - contribution - hsa_annual - medical_annual - tax
            salary *= 1 + salary_growth
    return totals


def project_household_total_expenses_by_age(expenses: list[dict], current_age: int, horizon_age: int) -> dict[int, float]:
    totals = {age: 0.0 for age in range(current_age, horizon_age + 1)}
    for expense in expenses:
        for age, cost in project_expense_annual_costs(expense, current_age, horizon_age).items():
            totals[age] += cost
    return totals


def project_household_social_security_by_age(
    people: list[dict], current_age: int, horizon_age: int, overrides_by_person: dict[str, dict] | None = None
) -> dict[int, float]:
    """Combined Social Security income by household reference age, summed
    across everyone, starting the year each person reaches their own claim
    age — independent of whether they're still working or already retired.
    The SSA earnings test, which can temporarily reduce benefits claimed
    before full retirement age while still working, isn't modeled here."""
    overrides_by_person = overrides_by_person or {}
    totals = {age: 0.0 for age in range(current_age, horizon_age + 1)}
    for person in people:
        effective = {**person, **overrides_by_person.get(person["id"], {})}
        person_age = calculate_age(date.fromisoformat(effective["birthday"]))
        claim_age = effective.get("social_security_claim_age", 67)
        monthly = effective.get("social_security_monthly", 0.0)
        for i, age in enumerate(range(current_age, horizon_age + 1)):
            if person_age + i >= claim_age:
                totals[age] += monthly * 12
    return totals


def project_household_withdrawal_income_by_age(
    people: list[dict], current_age: int, horizon_age: int, withdrawal_rate_pct: float,
    overrides_by_person: dict[str, dict] | None = None,
) -> dict[int, float]:
    """401k withdrawal income by household reference age, summed across
    everyone, starting the year after their own earned income stops (past
    their own retirement age). Each year's withdrawal is withdrawal_rate% of
    that person's 401k balance at the start of the year (using the chosen
    scenario's — or, with no override, the base — projection through
    retirement as the starting balance); the remainder then compounds at
    their own growth rate for next year."""
    overrides_by_person = overrides_by_person or {}
    totals = {age: 0.0 for age in range(current_age, horizon_age + 1)}
    withdrawal_rate = withdrawal_rate_pct / 100
    for person in people:
        overrides = overrides_by_person.get(person["id"], {})
        effective = {**person, **overrides}
        person_age = calculate_age(date.fromisoformat(effective["birthday"]))
        retirement_age = effective["retirement_age"]
        scenario_df = project_balance(person, overrides)
        balance_by_person_age = dict(zip(scenario_df["Age"], scenario_df["Balance"]))
        balance = balance_by_person_age.get(retirement_age, scenario_df.iloc[-1]["Balance"])
        growth_rate = effective["growth_rate_pct"] / 100

        for i, age in enumerate(range(current_age, horizon_age + 1)):
            if person_age + i <= retirement_age:
                continue
            withdrawal = balance * withdrawal_rate
            totals[age] += withdrawal
            balance = (balance - withdrawal) * (1 + growth_rate)
    return totals


def render_household_cash_flow_charts(
    people: list[dict], expenses: list[dict], current_age: int, horizon_age: int, withdrawal_rate_pct: float,
    overrides_by_person: dict[str, dict] | None = None,
) -> None:
    """Five separate charts — Income, Expenses, 401k Withdrawal, Social
    Security, and Surplus/Deficit — instead of one combined line+bar chart.
    Once a person's earned income stops, their withdrawal income (401k
    balance x withdrawal rate) takes over; Social Security layers in
    independently once each person reaches their own claim age."""
    income_by_age = project_household_net_income_by_age(people, current_age, horizon_age, overrides_by_person)
    withdrawal_by_age = project_household_withdrawal_income_by_age(
        people, current_age, horizon_age, withdrawal_rate_pct, overrides_by_person
    )
    social_security_by_age = project_household_social_security_by_age(
        people, current_age, horizon_age, overrides_by_person
    )
    expenses_by_age = project_household_total_expenses_by_age(expenses, current_age, horizon_age)

    ages = list(range(current_age, horizon_age + 1))
    df = pd.DataFrame({
        "Age": ages,
        "Income": [income_by_age[a] for a in ages],
        "401k Withdrawal": [withdrawal_by_age[a] for a in ages],
        "Social Security": [social_security_by_age[a] for a in ages],
        "Expenses": [expenses_by_age[a] for a in ages],
    })
    df["Net"] = df["Income"] + df["401k Withdrawal"] + df["Social Security"] - df["Expenses"]
    df["NetSign"] = df["Net"].apply(lambda v: "Surplus" if v >= 0 else "Deficit")

    def single_line_chart(col: str, color: str, title: str) -> alt.Chart:
        return (
            alt.Chart(df)
            .mark_line(strokeWidth=3, color=color)
            .encode(
                x=alt.X("Age:O", title="Age"),
                y=alt.Y(f"{col}:Q", title="Amount ($)", axis=alt.Axis(format="$,.2s")),
                tooltip=[alt.Tooltip("Age:O"), alt.Tooltip(f"{col}:Q", format="$,.0f")],
            )
            .properties(height=320, title=title)
        )

    income_chart = single_line_chart("Income", "#2563eb", "Income")
    expense_chart = single_line_chart("Expenses", "#d97706", "Expenses")
    withdrawal_chart = single_line_chart("401k Withdrawal", "#7c3aed", "401k Withdrawal")
    social_security_chart = single_line_chart("Social Security", "#0891b2", "Social Security")

    surplus_chart = alt.Chart(df).mark_bar(opacity=0.75).encode(
        x=alt.X("Age:O", title="Age"),
        y=alt.Y("Net:Q", title="Amount ($)", axis=alt.Axis(format="$,.2s")),
        color=alt.Color(
            "NetSign:N",
            scale=alt.Scale(domain=["Surplus", "Deficit"], range=["#1a7f37", "#cf222e"]),
            legend=alt.Legend(title=None, orient="bottom", labelFontSize=12),
        ),
        tooltip=[alt.Tooltip("Age:O"), alt.Tooltip("Net:Q", title="Net", format="$,.0f")],
    ).properties(height=320, title="Surplus / Deficit")

    row1a, row1b = st.columns(2)
    with row1a:
        st.altair_chart(income_chart, width="stretch")
    with row1b:
        st.altair_chart(expense_chart, width="stretch")

    row2a, row2b = st.columns(2)
    with row2a:
        st.altair_chart(withdrawal_chart, width="stretch")
    with row2b:
        st.altair_chart(social_security_chart, width="stretch")

    st.altair_chart(surplus_chart, width="stretch")


# ---------- Simulator ----------

def render_simulator_charts(
    people: list[dict], expenses: list[dict], current_age: int, horizon_age: int,
    sim_overrides_by_person: dict[str, dict], sim_withdrawal_rate_pct: float, base_withdrawal_rate_pct: float,
) -> None:
    """Five separate charts — Income, Expenses, 401k Withdrawal, Social
    Security, and Surplus/Deficit — each comparing the simulated household
    to the actual (non-simulated) one wherever they can differ. Expenses
    can't be simulated, so that chart is just the one line."""
    sim_income = project_household_net_income_by_age(people, current_age, horizon_age, sim_overrides_by_person)
    sim_withdrawal = project_household_withdrawal_income_by_age(
        people, current_age, horizon_age, sim_withdrawal_rate_pct, sim_overrides_by_person
    )
    sim_social_security = project_household_social_security_by_age(
        people, current_age, horizon_age, sim_overrides_by_person
    )
    base_income = project_household_net_income_by_age(people, current_age, horizon_age)
    base_withdrawal = project_household_withdrawal_income_by_age(
        people, current_age, horizon_age, base_withdrawal_rate_pct
    )
    base_social_security = project_household_social_security_by_age(people, current_age, horizon_age)
    expenses_by_age = project_household_total_expenses_by_age(expenses, current_age, horizon_age)

    ages = list(range(current_age, horizon_age + 1))
    df = pd.DataFrame({
        "Age": ages,
        "Simulated Income": [sim_income[a] for a in ages],
        "Actual Income": [base_income[a] for a in ages],
        "Simulated 401k Withdrawal": [sim_withdrawal[a] for a in ages],
        "Actual 401k Withdrawal": [base_withdrawal[a] for a in ages],
        "Simulated Social Security": [sim_social_security[a] for a in ages],
        "Actual Social Security": [base_social_security[a] for a in ages],
        "Expenses": [expenses_by_age[a] for a in ages],
    })
    df["Simulated Net"] = (
        df["Simulated Income"] + df["Simulated 401k Withdrawal"] + df["Simulated Social Security"] - df["Expenses"]
    )
    df["Actual Net"] = df["Actual Income"] + df["Actual 401k Withdrawal"] + df["Actual Social Security"] - df["Expenses"]
    df["NetSign"] = df["Simulated Net"].apply(lambda v: "Surplus" if v >= 0 else "Deficit")

    def comparison_line_chart(sim_col: str, actual_col: str, sim_color: str, title: str) -> alt.Chart:
        """Solid colored 'Simulated' line vs. dashed gray 'Actual' line."""
        long_df = df.melt(id_vars="Age", value_vars=[sim_col, actual_col], var_name="Series", value_name="Amount")
        return (
            alt.Chart(long_df)
            .mark_line(strokeWidth=3)
            .encode(
                x=alt.X("Age:O", title="Age"),
                y=alt.Y("Amount:Q", title="Amount ($)", axis=alt.Axis(format="$,.2s")),
                color=alt.Color(
                    "Series:N",
                    scale=alt.Scale(domain=[sim_col, actual_col], range=[sim_color, "#94a3b8"]),
                    legend=alt.Legend(title=None, orient="bottom", labelFontSize=12),
                ),
                strokeDash=alt.StrokeDash(
                    "Series:N",
                    scale=alt.Scale(domain=[sim_col, actual_col], range=[[1, 0], [6, 4]]),
                    legend=None,
                ),
                tooltip=[alt.Tooltip("Series:N"), alt.Tooltip("Age:O"), alt.Tooltip("Amount:Q", format="$,.0f")],
            )
            .properties(height=320, title=title)
        )

    income_chart = comparison_line_chart("Simulated Income", "Actual Income", "#2563eb", "Income")
    withdrawal_chart = comparison_line_chart(
        "Simulated 401k Withdrawal", "Actual 401k Withdrawal", "#7c3aed", "401k Withdrawal"
    )
    social_security_chart = comparison_line_chart(
        "Simulated Social Security", "Actual Social Security", "#0891b2", "Social Security"
    )
    expense_chart = (
        alt.Chart(df)
        .mark_line(strokeWidth=3, color="#d97706")
        .encode(
            x=alt.X("Age:O", title="Age"),
            y=alt.Y("Expenses:Q", title="Amount ($)", axis=alt.Axis(format="$,.2s")),
            tooltip=[alt.Tooltip("Age:O"), alt.Tooltip("Expenses:Q", format="$,.0f")],
        )
        .properties(height=320, title="Expenses")
    )
    surplus_bars = alt.Chart(df).mark_bar(opacity=0.75).encode(
        x=alt.X("Age:O", title="Age"),
        y=alt.Y("Simulated Net:Q", title="Amount ($)", axis=alt.Axis(format="$,.2s")),
        color=alt.Color(
            "NetSign:N",
            scale=alt.Scale(domain=["Surplus", "Deficit"], range=["#1a7f37", "#cf222e"]),
            legend=alt.Legend(title=None, orient="bottom", labelFontSize=12),
        ),
        tooltip=[alt.Tooltip("Age:O"), alt.Tooltip("Simulated Net:Q", title="Simulated Net", format="$,.0f")],
    )
    actual_net_line = alt.Chart(df).mark_line(strokeWidth=2, strokeDash=[6, 4], color="#64748b").encode(
        x=alt.X("Age:O"),
        y=alt.Y("Actual Net:Q"),
        tooltip=[alt.Tooltip("Age:O"), alt.Tooltip("Actual Net:Q", title="Actual Net", format="$,.0f")],
    )
    surplus_chart = (
        (surplus_bars + actual_net_line).resolve_scale(color="independent").properties(height=320, title="Surplus / Deficit")
    )

    row1a, row1b = st.columns(2)
    with row1a:
        st.altair_chart(income_chart, width="stretch")
    with row1b:
        st.altair_chart(expense_chart, width="stretch")

    row2a, row2b = st.columns(2)
    with row2a:
        st.altair_chart(withdrawal_chart, width="stretch")
    with row2b:
        st.altair_chart(social_security_chart, width="stretch")

    st.altair_chart(surplus_chart, width="stretch")

    st.caption(
        "Solid lines/bars are your simulated household; dashed gray lines are your actual "
        "(non-simulated) values, for comparison. Expenses are the same in both, since the "
        "simulator can't change them."
    )


SIM_PERSON_FIELD_DEFAULTS = {
    "current_balance": lambda p: float(p["current_balance"]),
    "current_salary": lambda p: float(p["current_salary"]),
    "hsa_monthly": lambda p: float(p.get("hsa_monthly", 0.0)),
    "medical_insurance_monthly": lambda p: float(p.get("medical_insurance_monthly", 0.0)),
    "contribution_pct": lambda p: float(p["contribution_pct"]),
    "match_pct": lambda p: float(p["match_pct"]),
    "salary_increase_pct": lambda p: float(p["salary_increase_pct"]),
    "growth_rate_pct": lambda p: float(p["growth_rate_pct"]),
    "tax_rate_pct": lambda p: float(p.get("tax_rate_pct", 22.0)),
    "retirement_age": lambda p: int(p["retirement_age"]),
    "stop_contribution_age": lambda p: int(p.get("stop_contribution_age", p["retirement_age"])),
    "social_security_claim_age": lambda p: int(p.get("social_security_claim_age", 67)),
    "social_security_monthly": lambda p: float(p.get("social_security_monthly", 0.0)),
}


def seed_simulator_state_from_person(person: dict, overrides: dict | None = None) -> None:
    """Resets a person's sim_-prefixed session state to their base values,
    then layers the given overrides on top — the same {field: value} /
    optional 'income_change' shape a saved scenario's overrides already
    take. Used to load a saved scenario into the Simulator as a starting
    point for further free-form tweaking, without the two ever getting out
    of sync with each other."""
    overrides = overrides or {}
    pid = person["id"]
    defaults = {key: get_default(person) for key, get_default in SIM_PERSON_FIELD_DEFAULTS.items()}
    for key in SIM_PERSON_FIELD_DEFAULTS:
        st.session_state[f"sim_{pid}_{key}"] = overrides.get(key, defaults[key])

    income_change = overrides.get("income_change")
    st.session_state[f"sim_{pid}_income_change_enabled"] = income_change is not None
    if income_change:
        st.session_state[f"sim_{pid}_income_change_age"] = income_change["age"]
        st.session_state[f"sim_{pid}_income_change_salary"] = income_change["new_salary"]
        st.session_state[f"sim_{pid}_income_change_contrib"] = income_change.get(
            "contribution_pct", defaults["contribution_pct"]
        )
        st.session_state[f"sim_{pid}_income_change_match"] = income_change.get("match_pct", defaults["match_pct"])
        st.session_state[f"sim_{pid}_income_change_raise"] = income_change.get(
            "salary_increase_pct", defaults["salary_increase_pct"]
        )


def render_person_simulator_inputs(person: dict) -> dict:
    """Every income/401k input for one person, as sliders (bounded
    percentages/ages) or number inputs (open-ended dollar amounts), each
    seeded from the person's real value but stored under sim_-prefixed keys
    so edits never touch the actual saved data. Returns the overrides dict
    to feed straight into project_household_net_income_by_age /
    project_household_withdrawal_income_by_age, the same shape a saved
    scenario's overrides already take."""
    pid = person["id"]

    scenario_options = person_scenario_options(person)
    scenario_labels = [name for name, _ in scenario_options]
    scenario_overrides_by_label = dict(scenario_options)
    picker_key = f"sim_{pid}_scenario_picker"
    applied_key = f"sim_{pid}_scenario_picker_applied"
    selected_scenario = st.selectbox(
        "Load from Saved Scenario",
        scenario_labels,
        key=picker_key,
        help="Pulls this person's saved 401k scenario into the sliders below as a starting "
             "point — you can still adjust anything afterward.",
    )
    if selected_scenario != st.session_state.get(applied_key):
        st.session_state[applied_key] = selected_scenario
        seed_simulator_state_from_person(person, scenario_overrides_by_label[selected_scenario])
        st.rerun()

    d1, d2 = st.columns(2)
    with d1:
        sim_balance = st.number_input(
            "Current 401(k) Balance ($)", min_value=0.0, step=1000.0,
            value=float(person["current_balance"]), key=f"sim_{pid}_current_balance",
        )
        sim_hsa = st.number_input(
            "Monthly HSA Contribution ($)", min_value=0.0, step=25.0,
            value=float(person.get("hsa_monthly", 0.0)), key=f"sim_{pid}_hsa_monthly",
        )
    with d2:
        sim_salary = st.number_input(
            "Current Salary ($/yr)", min_value=0.0, step=1000.0,
            value=float(person["current_salary"]), key=f"sim_{pid}_current_salary",
        )
        sim_medical = st.number_input(
            "Medical Insurance ($/mo)", min_value=0.0, step=25.0,
            value=float(person.get("medical_insurance_monthly", 0.0)), key=f"sim_{pid}_medical_insurance_monthly",
        )

    p1, p2 = st.columns(2)
    with p1:
        sim_contribution_pct = st.slider(
            "% of Salary Contributed", min_value=0.0, max_value=50.0, step=0.5,
            value=float(person["contribution_pct"]), key=f"sim_{pid}_contribution_pct", format="%.1f%%",
        )
        sim_salary_increase_pct = st.slider(
            "Annual Salary Increase (%)", min_value=0.0, max_value=50.0, step=0.25,
            value=float(person["salary_increase_pct"]), key=f"sim_{pid}_salary_increase_pct", format="%.2f%%",
        )
        sim_tax_rate_pct = st.slider(
            "Effective Tax Rate (%)", min_value=0.0, max_value=60.0, step=0.5,
            value=float(person.get("tax_rate_pct", 22.0)), key=f"sim_{pid}_tax_rate_pct", format="%.1f%%",
        )
    with p2:
        sim_match_pct = st.slider(
            "% of Salary Matched", min_value=0.0, max_value=100.0, step=0.5,
            value=float(person["match_pct"]), key=f"sim_{pid}_match_pct", format="%.1f%%",
        )
        sim_growth_rate_pct = st.slider(
            "Annual Growth Rate (%)", min_value=0.0, max_value=50.0, step=0.25,
            value=float(person["growth_rate_pct"]), key=f"sim_{pid}_growth_rate_pct", format="%.2f%%",
        )

    a1, a2 = st.columns(2)
    with a1:
        sim_retirement_age = st.slider(
            "Retirement / Draw Age", min_value=1, max_value=100, step=1,
            value=int(person["retirement_age"]), key=f"sim_{pid}_retirement_age",
        )
    with a2:
        sim_stop_contribution_age = st.slider(
            "Stop Contribution Age", min_value=1, max_value=100, step=1,
            value=int(person.get("stop_contribution_age", person["retirement_age"])),
            key=f"sim_{pid}_stop_contribution_age",
        )

    st.markdown("**Social Security**")
    ss1, ss2 = st.columns(2)
    with ss1:
        sim_ss_claim_age = st.slider(
            "Claim Age", min_value=62, max_value=70, step=1,
            value=int(person.get("social_security_claim_age", 67)), key=f"sim_{pid}_social_security_claim_age",
        )
    with ss2:
        sim_ss_monthly = st.number_input(
            "Estimated Monthly Benefit ($)", min_value=0.0, step=50.0,
            value=float(person.get("social_security_monthly", 0.0)), key=f"sim_{pid}_social_security_monthly",
        )

    overrides = {
        "current_balance": sim_balance,
        "current_salary": sim_salary,
        "hsa_monthly": sim_hsa,
        "medical_insurance_monthly": sim_medical,
        "contribution_pct": sim_contribution_pct,
        "match_pct": sim_match_pct,
        "salary_increase_pct": sim_salary_increase_pct,
        "growth_rate_pct": sim_growth_rate_pct,
        "tax_rate_pct": sim_tax_rate_pct,
        "retirement_age": sim_retirement_age,
        "stop_contribution_age": sim_stop_contribution_age,
        "social_security_claim_age": sim_ss_claim_age,
        "social_security_monthly": sim_ss_monthly,
    }

    st.markdown("**Income Change** — simulate a step change to a new salary at a given age (e.g. a downshift).")
    sim_income_change_enabled = st.checkbox(
        "Simulate an income change", value=False, key=f"sim_{pid}_income_change_enabled",
    )
    if sim_income_change_enabled:
        age_min = calculate_age(date.fromisoformat(person["birthday"])) + 1
        age_max = max(age_min, sim_retirement_age)
        ic1, ic2 = st.columns(2)
        with ic1:
            ic_age = st.slider(
                "Age When Income Changes", min_value=age_min, max_value=age_max,
                value=min(age_min + 4, age_max), key=f"sim_{pid}_income_change_age",
            )
            ic_salary = st.number_input(
                "New Annual Salary ($)", min_value=0.0, step=1000.0,
                value=sim_salary, key=f"sim_{pid}_income_change_salary",
            )
        with ic2:
            ic_contrib = st.slider(
                "New % of Salary Contributed", min_value=0.0, max_value=50.0, step=0.5,
                value=sim_contribution_pct, key=f"sim_{pid}_income_change_contrib", format="%.1f%%",
            )
            ic_match = st.slider(
                "New % of Salary Matched", min_value=0.0, max_value=100.0, step=0.5,
                value=sim_match_pct, key=f"sim_{pid}_income_change_match", format="%.1f%%",
            )
            ic_raise = st.slider(
                "New Annual Salary Increase (%)", min_value=0.0, max_value=50.0, step=0.25,
                value=sim_salary_increase_pct, key=f"sim_{pid}_income_change_raise", format="%.2f%%",
            )
        overrides["income_change"] = {
            "age": ic_age,
            "new_salary": ic_salary,
            "contribution_pct": ic_contrib,
            "match_pct": ic_match,
            "salary_increase_pct": ic_raise,
        }

    return overrides


# ---------- UI ----------

# ---------- Sidebar: Data Management ----------

with st.sidebar:
    st.header("Data Management")

    st.subheader("Save Scenarios")
    default_filename = f"investment-scenarios-{date.today().isoformat()}.json"
    save_filename = st.text_input("File name", value=default_filename, key="dm_save_filename").strip()
    if not save_filename:
        save_filename = default_filename
    elif not save_filename.lower().endswith(".json"):
        save_filename += ".json"
    st.download_button(
        "Save Scenarios",
        data=json.dumps(build_export_payload(), indent=2, default=str),
        file_name=save_filename,
        mime="application/json",
        key="dm_save_button",
        help="Downloads all people, scenarios, and expenses as a JSON file. "
             "Your browser controls where downloads are saved.",
    )

    st.divider()
    st.subheader("Load Prior Scenarios")
    uploaded_file = st.file_uploader("Upload a scenario file", type=["json"], key="dm_uploader")
    if uploaded_file is not None:
        try:
            import_payload = json.loads(uploaded_file.getvalue().decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            st.error("This isn't a valid JSON file. Please upload a scenario file previously saved from this app.")
        else:
            import_error = validate_import_payload(import_payload)
            if import_error:
                st.error(import_error)
            else:
                st.success(
                    f"Found {len(import_payload['people'])} people and "
                    f"{len(import_payload['expenses'])} expenses in this file."
                )
                if st.button("Load This File (replaces current data)", key="dm_load_button"):
                    st.session_state.people = import_payload["people"]
                    for p in st.session_state.people:
                        normalize_person(p)
                    st.session_state.expenses = import_payload["expenses"]

                    settings = import_payload.get("settings") or {}
                    if settings.get("current_age_for_expenses") is not None:
                        st.session_state["expenses_current_age"] = int(
                            max(1, min(EXPENSE_HORIZON_AGE - 1, settings["current_age_for_expenses"]))
                        )
                    if settings.get("withdrawal_rate_pct") is not None:
                        st.session_state["withdrawal_rate_pct"] = max(
                            0.0, min(20.0, float(settings["withdrawal_rate_pct"]))
                        )

                    save_people(st.session_state.people)
                    save_expenses(st.session_state.expenses)
                    st.session_state.income_form_open = not st.session_state.people
                    st.session_state.expense_form_open = not st.session_state.expenses
                    st.success("Scenarios loaded.")
                    st.rerun()

    st.divider()
    st.subheader("Clear All Inputs")
    if st.session_state.get("dm_confirm_clear"):
        st.warning("This will permanently delete all people, scenarios, and expenses. Are you sure?")
        confirm_col, cancel_col = st.columns(2)
        with confirm_col:
            if st.button("Yes, clear", key="dm_confirm_clear_yes"):
                st.session_state.people = []
                st.session_state.expenses = []
                save_people(st.session_state.people)
                save_expenses(st.session_state.expenses)
                st.session_state.income_form_open = True
                st.session_state.expense_form_open = True
                st.session_state.dm_confirm_clear = False
                st.rerun()
        with cancel_col:
            if st.button("Cancel", key="dm_confirm_clear_cancel"):
                st.session_state.dm_confirm_clear = False
                st.rerun()
    else:
        if st.button("Clear All Inputs", key="dm_clear_button"):
            st.session_state.dm_confirm_clear = True
            st.rerun()


# ==========================================================================
# Section 1: Income
# ==========================================================================

st.title("Household Income")
section1_open = st.toggle("Show Section", value=True, key="section1_open", label_visibility="collapsed")
if section1_open:
    st.caption("Section 1: Per-person income, paycheck deductions, and effective tax rate")

    if "income_form_open" not in st.session_state:
        # Seeded once rather than recomputed every run — this section isn't in
        # an st.form (the tax-rate estimator needs to react immediately), so
        # every field edit reruns the script; recomputing `not people` each
        # time would collapse the expander out from under whoever's mid-edit.
        st.session_state.income_form_open = not st.session_state.people

    with st.expander("Tell Me About Yourself", expanded=st.session_state.income_form_open):
        st.markdown("**Basics**")
        name_col, birthday_col = st.columns(2)
        with name_col:
            income_name = st.text_input("Name", key="income_name")
        with birthday_col:
            income_birthday = st.date_input(
                "Birthday", value=date(1990, 1, 1), min_value=date(1930, 1, 1), max_value=date.today(),
                key="income_birthday",
            )

        st.markdown("**Paycheck & Deductions**")
        col1, col2 = st.columns(2)
        with col1:
            income_salary = st.number_input(
                "Salary ($/yr)", min_value=0.0, value=0.0, step=1000.0, key="income_salary"
            )
            income_contribution_pct = st.number_input(
                "401k Contribution (%)", min_value=0.0, max_value=100.0, value=6.0, key="income_contribution_pct"
            )
            income_hsa_monthly = st.number_input(
                "Monthly HSA Contribution ($)", min_value=0.0, value=0.0, step=25.0, key="income_hsa_monthly"
            )
            income_medical_monthly = st.number_input(
                "Medical Insurance ($/mo)", min_value=0.0, value=0.0, step=25.0, key="income_medical_monthly"
            )

        with col2:
            tax_rate_key = "income_tax_rate_input"
            # The estimator must run — and, if clicked, write to
            # session_state[tax_rate_key] — BEFORE the number_input below is
            # instantiated with that same key, or Streamlit raises trying to
            # modify a widget's value after it's already been created this run.
            with st.popover("Estimate my rate"):
                st.caption("Approximate federal + state effective rate, for planning only — not tax advice.")
                est_state = st.selectbox(
                    "State", sorted(STATE_TAX_RATES.keys()), key="income_tax_state"
                )
                est_filing_status = st.selectbox(
                    "Filing Status", FILING_STATUSES, key="income_tax_filing_status"
                )
                if st.button("Estimate", key="income_tax_estimate_button"):
                    pretax_reductions = income_salary * income_contribution_pct / 100 + income_hsa_monthly * 12
                    estimated = estimate_effective_tax_rate(
                        est_state, est_filing_status, income_salary, pretax_reductions
                    )
                    st.session_state[tax_rate_key] = round(estimated, 1)

            income_tax_rate_pct = st.number_input(
                "Effective Tax Rate (%)", min_value=0.0, max_value=60.0,
                value=st.session_state.get(tax_rate_key, 22.0), step=0.5, key=tax_rate_key,
            )

            if income_salary > 0:
                gross_monthly = income_salary / 12
                contribution_monthly = gross_monthly * income_contribution_pct / 100
                tax_monthly = gross_monthly * income_tax_rate_pct / 100
                net_monthly = (
                    gross_monthly - contribution_monthly - income_hsa_monthly
                    - income_medical_monthly - tax_monthly
                )
                st.caption(f"Estimated net monthly income: **${net_monthly:,.0f}**")

        st.markdown("**401(k) Details**")
        k1, k2 = st.columns(2)
        with k1:
            income_401k_balance = st.number_input(
                "Current 401(k) Balance ($)", min_value=0.0, value=0.0, step=1000.0, key="income_401k_balance"
            )
            income_match_pct = st.number_input(
                "% of Salary Matched", min_value=0.0, max_value=100.0, value=3.0, key="income_match_pct"
            )
            income_salary_increase_pct = st.number_input(
                "Annual Salary Increase (%)", min_value=0.0, max_value=50.0, value=3.0,
                key="income_salary_increase_pct",
            )
            income_growth_rate_pct = st.number_input(
                "Annual Growth Rate (%)", min_value=0.0, max_value=50.0, value=7.0, key="income_growth_rate_pct"
            )
        with k2:
            income_account_type = st.radio(
                "Account Type", ["Pre-tax", "Roth"], key="income_account_type", horizontal=True,
            )
            income_retirement_age = st.number_input(
                "Retirement / Draw Age", min_value=1, max_value=100, value=65, key="income_retirement_age"
            )
            income_stop_contribution_age = st.number_input(
                "Stop Contribution Age", min_value=1, max_value=100, value=int(income_retirement_age),
                key="income_stop_contribution_age",
                help="Age at which contributions and the employer match stop.",
            )

        st.markdown("**Social Security**")
        ss1, ss2 = st.columns(2)
        with ss1:
            income_ss_claim_age = st.number_input(
                "Claim Age", min_value=62, max_value=70, value=67, key="income_ss_claim_age",
                help="Earliest claim age is 62; delayed retirement credits stop accruing at 70.",
            )
        with ss2:
            ss_monthly_key = "income_ss_monthly_input"
            with st.popover("Estimate my benefit"):
                st.caption(
                    "Rough approximation using your salary as a stand-in for a full 35-year "
                    "earnings history, for planning only — not an official SSA estimate."
                )
                if st.button("Estimate", key="income_ss_estimate_button"):
                    estimated_ss = estimate_monthly_social_security(
                        income_salary, income_birthday, income_ss_claim_age
                    )
                    st.session_state[ss_monthly_key] = round(estimated_ss, 0)

            income_ss_monthly = st.number_input(
                "Estimated Monthly Benefit ($)", min_value=0.0,
                value=st.session_state.get(ss_monthly_key, 0.0), step=50.0, key=ss_monthly_key,
            )

        if st.button("Add Person", key="add_person_button"):
            if not income_name.strip():
                st.error("Name is required.")
            else:
                st.session_state.people.append({
                    "id": str(uuid.uuid4()),
                    "name": income_name.strip(),
                    "birthday": income_birthday.isoformat(),
                    "current_salary": income_salary,
                    "contribution_pct": income_contribution_pct,
                    "hsa_monthly": income_hsa_monthly,
                    "medical_insurance_monthly": income_medical_monthly,
                    "tax_rate_pct": income_tax_rate_pct,
                    "current_balance": income_401k_balance,
                    "match_pct": income_match_pct,
                    "salary_increase_pct": income_salary_increase_pct,
                    "growth_rate_pct": income_growth_rate_pct,
                    "account_type": income_account_type,
                    "retirement_age": income_retirement_age,
                    "stop_contribution_age": income_stop_contribution_age,
                    "social_security_claim_age": income_ss_claim_age,
                    "social_security_monthly": income_ss_monthly,
                    "scenarios": [],
                })
                save_people(st.session_state.people)
                for reset_key in (
                    "income_name", "income_salary", "income_contribution_pct",
                    "income_hsa_monthly", "income_medical_monthly", tax_rate_key,
                    "income_401k_balance", "income_match_pct", "income_salary_increase_pct",
                    "income_growth_rate_pct", "income_account_type", "income_retirement_age",
                    "income_stop_contribution_age", "income_ss_claim_age", ss_monthly_key,
                ):
                    st.session_state.pop(reset_key, None)
                st.success(f"Added {income_name.strip()}.")
                st.rerun()

    st.divider()

    if not st.session_state.people:
        st.info("No people added yet. Use the form above to add someone.")
    else:
        st.subheader("People")
        for person in list(st.session_state.people):
            normalize_person(person)
            with st.expander(f"{person['name']} — ${person['current_salary']:,.0f}/yr", expanded=False):
                edit_col, delete_col = st.columns([5, 1])
                with edit_col:
                    ec1, ec2 = st.columns(2)
                    with ec1:
                        edit_salary = st.number_input(
                            "Salary ($/yr)", min_value=0.0, value=float(person["current_salary"]),
                            step=1000.0, key=f"edit_income_salary_{person['id']}",
                        )
                        edit_contribution_pct = st.number_input(
                            "401k Contribution (%)", min_value=0.0, max_value=100.0,
                            value=float(person["contribution_pct"]), key=f"edit_income_contrib_{person['id']}",
                        )
                    with ec2:
                        edit_hsa_monthly = st.number_input(
                            "Monthly HSA Contribution ($)", min_value=0.0,
                            value=float(person.get("hsa_monthly", 0.0)), step=25.0,
                            key=f"edit_income_hsa_{person['id']}",
                        )
                        edit_medical_monthly = st.number_input(
                            "Medical Insurance ($/mo)", min_value=0.0,
                            value=float(person.get("medical_insurance_monthly", 0.0)), step=25.0,
                            key=f"edit_income_medical_{person['id']}",
                        )
                    edit_tax_rate_pct = st.number_input(
                        "Effective Tax Rate (%)", min_value=0.0, max_value=60.0,
                        value=float(person.get("tax_rate_pct", 22.0)), step=0.5,
                        key=f"edit_income_tax_{person['id']}",
                    )

                    gross_monthly = edit_salary / 12
                    net_monthly = (
                        gross_monthly - gross_monthly * edit_contribution_pct / 100
                        - edit_hsa_monthly - edit_medical_monthly - gross_monthly * edit_tax_rate_pct / 100
                    )
                    st.caption(f"Estimated net monthly income: **${net_monthly:,.0f}**")

                    if st.button("Save Changes", key=f"save_income_{person['id']}"):
                        person["current_salary"] = edit_salary
                        person["contribution_pct"] = edit_contribution_pct
                        person["hsa_monthly"] = edit_hsa_monthly
                        person["medical_insurance_monthly"] = edit_medical_monthly
                        person["tax_rate_pct"] = edit_tax_rate_pct
                        save_people(st.session_state.people)
                        st.rerun()

                with delete_col:
                    if st.button("Delete", key=f"delete_income_{person['id']}"):
                        st.session_state.people = [
                            p for p in st.session_state.people if p["id"] != person["id"]
                        ]
                        save_people(st.session_state.people)
                        st.rerun()


# ==========================================================================
# Section 2: 401(k) Planner
# ==========================================================================

st.divider()
st.title("401(k) Planner")
section2_open = st.toggle("Show Section", value=True, key="section2_open", label_visibility="collapsed")
if section2_open:
    st.caption("Section 2: Individual 401(k) inputs and balance projection")

    if not st.session_state.people:
        st.info("No people yet — add someone in the Income section above.")
    else:
        st.subheader("People")

        for person in list(st.session_state.people):
            normalize_person(person)
            age = calculate_age(date.fromisoformat(person["birthday"]))
            with st.expander(f"{person['name']} — Age {age} — {person['account_type']}", expanded=False):
                header_col, action_col = st.columns([5, 1])

                with header_col:
                    m1, m2, m3, m4, m5, m6, m7, m8 = st.columns(8)
                    m1.metric("Current Balance", f"${person['current_balance']:,.0f}")
                    m2.metric("Current Salary", f"${person['current_salary']:,.0f}")
                    m3.metric("Contribution + Match", f"{person['contribution_pct'] + person['match_pct']:.1f}%")
                    m4.metric("Retirement Age", person["retirement_age"])
                    m5.metric(
                        "Stops Contributing",
                        person["stop_contribution_age"],
                        help="Age contributions and employer match stop",
                    )
                    m6.metric("Salary Increase", f"{person['salary_increase_pct']}%")
                    m7.metric("Growth Rate", f"{person['growth_rate_pct']}%")
                    m8.metric(
                        "Social Security",
                        f"${person.get('social_security_monthly', 0.0):,.0f}/mo",
                        help=f"Claiming at age {person.get('social_security_claim_age', 67)}",
                    )

                    st.caption(
                        f"Account type: {person['account_type']} • "
                        "Salary and 401k contribution % are set in the Income section"
                    )

                with action_col:
                    with st.popover("Edit"):
                        st.markdown("**Edit 401k Details**")
                        edit_balance = st.number_input(
                            "Current 401(k) Balance ($)", min_value=0.0, value=float(person["current_balance"]),
                            step=1000.0, key=f"edit_401k_balance_{person['id']}",
                        )
                        edit_match_pct = st.number_input(
                            "% of Salary Matched", min_value=0.0, max_value=100.0,
                            value=float(person["match_pct"]), key=f"edit_401k_match_{person['id']}",
                        )
                        edit_salary_increase_pct = st.number_input(
                            "Annual Salary Increase (%)", min_value=0.0, max_value=50.0,
                            value=float(person["salary_increase_pct"]), key=f"edit_401k_raise_{person['id']}",
                        )
                        edit_growth_rate_pct = st.number_input(
                            "Annual Growth Rate (%)", min_value=0.0, max_value=50.0,
                            value=float(person["growth_rate_pct"]), key=f"edit_401k_growth_{person['id']}",
                        )
                        edit_account_type = st.radio(
                            "Account Type", ["Pre-tax", "Roth"],
                            index=["Pre-tax", "Roth"].index(person["account_type"]),
                            key=f"edit_401k_account_type_{person['id']}", horizontal=True,
                        )
                        edit_retirement_age = st.number_input(
                            "Retirement / Draw Age", min_value=1, max_value=100,
                            value=int(person["retirement_age"]), key=f"edit_401k_retirement_{person['id']}",
                        )
                        edit_stop_contribution_age = st.number_input(
                            "Stop Contribution Age", min_value=1, max_value=100,
                            value=int(person["stop_contribution_age"]), key=f"edit_401k_stop_{person['id']}",
                            help="Age at which contributions and the employer match stop.",
                        )
                        st.markdown("**Social Security**")
                        edit_ss_claim_age = st.number_input(
                            "Claim Age", min_value=62, max_value=70,
                            value=int(person.get("social_security_claim_age", 67)),
                            key=f"edit_401k_ss_claim_{person['id']}",
                        )
                        edit_ss_monthly = st.number_input(
                            "Estimated Monthly Benefit ($)", min_value=0.0, step=50.0,
                            value=float(person.get("social_security_monthly", 0.0)),
                            key=f"edit_401k_ss_monthly_{person['id']}",
                        )
                        if st.button("Save", key=f"save_401k_{person['id']}"):
                            person["current_balance"] = edit_balance
                            person["match_pct"] = edit_match_pct
                            person["salary_increase_pct"] = edit_salary_increase_pct
                            person["growth_rate_pct"] = edit_growth_rate_pct
                            person["account_type"] = edit_account_type
                            person["retirement_age"] = edit_retirement_age
                            person["stop_contribution_age"] = edit_stop_contribution_age
                            person["social_security_claim_age"] = edit_ss_claim_age
                            person["social_security_monthly"] = edit_ss_monthly
                            save_people(st.session_state.people)
                            st.rerun()

                    if st.button("Delete", key=f"delete_{person['id']}"):
                        st.session_state.people = [
                            p for p in st.session_state.people if p["id"] != person["id"]
                        ]
                        save_people(st.session_state.people)
                        st.rerun()

                # Chart and totals span the full expander width so they're centered,
                # rather than being squeezed into the narrower header_col above.
                df = project_balance(person)
                if len(df) > 1:
                    chart_data = {"Base": df.set_index("Age")["Balance"]}
                    for scenario in person["scenarios"]:
                        s_df = project_balance(person, {scenario["field"]: scenario["value"]})
                        if len(s_df) > 1:
                            chart_data[scenario["name"]] = s_df.set_index("Age")["Balance"]

                    series_labels = list(chart_data.keys())
                    series_colors = PERSON_CHART_PALETTE[:len(series_labels)]
                    person_long_df = (
                        pd.concat(chart_data, axis=1)
                        .rename_axis("Age")
                        .reset_index()
                        .melt(id_vars="Age", var_name="Series", value_name="Balance")
                    )
                    person_chart = (
                        alt.Chart(person_long_df)
                        .mark_line()
                        .encode(
                            x=alt.X("Age:Q", title="Age"),
                            y=alt.Y("Balance:Q", title="Balance ($)", axis=alt.Axis(format="$,.2s")),
                            color=alt.Color(
                                "Series:N",
                                scale=alt.Scale(domain=series_labels, range=series_colors),
                                sort=series_labels,
                                legend=alt.Legend(title=None, orient="bottom", labelLimit=300, labelFontSize=12),
                            ),
                            tooltip=[
                                alt.Tooltip("Series:N"),
                                alt.Tooltip("Age:Q"),
                                alt.Tooltip("Balance:Q", format="$,.0f"),
                            ],
                        )
                        .properties(height=340)
                    )
                    st.altair_chart(person_chart, width="stretch")

                    st.caption("Projected balance at retirement")
                    render_totals_row(person, df)

                    with st.popover("View year-by-year projection"):
                        st.dataframe(df, width="stretch", hide_index=True)
                else:
                    st.warning("Retirement age must be greater than current age to project growth.")

                st.markdown("**Scenarios** — vary one assumption at a time and compare it to the base projection above.")

                if person["scenarios"]:
                    for scenario in person["scenarios"]:
                        s_col, remove_col = st.columns([5, 1])
                        s_col.markdown(f"**{scenario['name']}** — {scenario['detail']}")
                        if remove_col.button("Remove", key=f"remove_scenario_{scenario['id']}"):
                            person["scenarios"] = [
                                s for s in person["scenarios"] if s["id"] != scenario["id"]
                            ]
                            save_people(st.session_state.people)
                            st.rerun()

                if len(person["scenarios"]) >= 4:
                    st.caption("Maximum of 4 scenarios reached. Remove one to add another.")
                else:
                    name_col, field_col = st.columns([2, 3])
                    with name_col:
                        scenario_name = st.text_input(
                            "Scenario Name",
                            key=f"scenario_name_{person['id']}",
                            placeholder=f"Scenario {len(person['scenarios']) + 1}",
                        )
                    with field_col:
                        field_label = st.selectbox(
                            "What do you want to change?",
                            list(SCENARIO_FIELDS.keys()) + [INCOME_CHANGE_LABEL],
                            key=f"scenario_field_{person['id']}",
                        )

                    if field_label == INCOME_CHANGE_LABEL:
                        age_min = age + 1
                        age_max = max(age_min, int(person["retirement_age"]))
                        age_col, salary_col = st.columns(2)
                        with age_col:
                            change_age = st.number_input(
                                "Age When Income Changes",
                                min_value=age_min,
                                max_value=age_max,
                                value=min(age_min + 4, age_max),
                                key=f"income_change_age_{person['id']}",
                            )
                        with salary_col:
                            new_salary = st.number_input(
                                "New Annual Salary ($)",
                                min_value=0.0,
                                value=float(person["current_salary"]),
                                step=1000.0,
                                key=f"income_change_salary_{person['id']}",
                            )

                        contrib_col, match_col, raise_col = st.columns(3)
                        with contrib_col:
                            new_contribution_pct = st.number_input(
                                "New % of Salary Contributed",
                                min_value=0.0,
                                max_value=100.0,
                                value=float(person["contribution_pct"]),
                                key=f"income_change_contrib_{person['id']}",
                            )
                        with match_col:
                            new_match_pct = st.number_input(
                                "New % of Salary Matched",
                                min_value=0.0,
                                max_value=100.0,
                                value=float(person["match_pct"]),
                                key=f"income_change_match_{person['id']}",
                            )
                        with raise_col:
                            new_salary_increase_pct = st.number_input(
                                "New Annual Salary Increase (%)",
                                min_value=0.0,
                                max_value=50.0,
                                value=float(person["salary_increase_pct"]),
                                key=f"income_change_raise_{person['id']}",
                            )
                        st.caption(
                            "Salary, contribution %, match %, and raise assumption all switch to these values "
                            "at that age and carry through to retirement. Leave a field as-is to keep it unchanged."
                        )

                        if st.button("Add Scenario", key=f"add_scenario_{person['id']}"):
                            detail = (
                                f"At age {change_age}: income → {format_compact_currency(new_salary)}/yr, "
                                f"{new_contribution_pct:.1f}% contributed, {new_match_pct:.1f}% match, "
                                f"{new_salary_increase_pct:.1f}% raises"
                            )
                            person["scenarios"].append({
                                "id": str(uuid.uuid4()),
                                "field": "income_change",
                                "value": {
                                    "age": change_age,
                                    "new_salary": new_salary,
                                    "contribution_pct": new_contribution_pct,
                                    "match_pct": new_match_pct,
                                    "salary_increase_pct": new_salary_increase_pct,
                                },
                                "name": scenario_name.strip() or f"Scenario {len(person['scenarios']) + 1}",
                                "detail": detail,
                            })
                            save_people(st.session_state.people)
                            st.rerun()
                    else:
                        config = SCENARIO_FIELDS[field_label]
                        base_value = person[config["key"]]

                        min_value = config["min"]
                        if config["key"] in ("retirement_age", "stop_contribution_age"):
                            min_value = age + 1
                        max_value = config["max"]
                        base_value = min(max(base_value, min_value), max_value)

                        input_col, method_col = st.columns([3, 2])
                        with method_col:
                            input_method = st.radio(
                                "Set value using",
                                ["Slider", "Manual entry"],
                                key=f"scenario_method_{person['id']}",
                                horizontal=True,
                            )
                        with input_col:
                            widget_key = f"scenario_value_{person['id']}_{config['key']}_{input_method}"
                            if input_method == "Slider":
                                new_value = st.slider(
                                    field_label,
                                    min_value=float(min_value) if config["percent"] else int(min_value),
                                    max_value=float(max_value) if config["percent"] else int(max_value),
                                    value=float(base_value) if config["percent"] else int(base_value),
                                    step=config["step"],
                                    key=widget_key,
                                )
                            else:
                                new_value = st.number_input(
                                    field_label,
                                    min_value=float(min_value) if config["percent"] else int(min_value),
                                    max_value=float(max_value) if config["percent"] else int(max_value),
                                    value=float(base_value) if config["percent"] else int(base_value),
                                    step=config["step"],
                                    key=widget_key,
                                )

                        if st.button("Add Scenario", key=f"add_scenario_{person['id']}"):
                            detail = f"{field_label}: {new_value}{'%' if config['percent'] else ''}"
                            person["scenarios"].append({
                                "id": str(uuid.uuid4()),
                                "field": config["key"],
                                "value": new_value,
                                "name": scenario_name.strip() or f"Scenario {len(person['scenarios']) + 1}",
                                "detail": detail,
                            })
                            save_people(st.session_state.people)
                            st.rerun()

        st.divider()
        st.subheader("Household Summary")
        total_current = sum(p["current_balance"] for p in st.session_state.people)
        total_projected = sum(project_balance(p).iloc[-1]["Balance"] for p in st.session_state.people)
        combo_data, total_combos = build_household_combo_data(st.session_state.people)
        max_balance = max((series.iloc[-1] for series in combo_data.values()), default=None)

        s1, s2, s3 = st.columns(3)
        s1.metric("Combined Current Balance", format_compact_currency(total_current), help=f"${total_current:,.0f}")
        s2.metric(
            "Combined Projected Balance at Retirement",
            format_compact_currency(total_projected),
            help=f"${total_projected:,.0f}",
        )
        if max_balance is not None:
            s3.metric(
                "Maximum Scenario",
                format_compact_currency(max_balance),
                help=f"Best combination across the household: ${max_balance:,.0f}",
            )
        else:
            s3.metric("Maximum Scenario", "—", help="Too many scenario combinations to compute")

        render_household_combinations(combo_data, total_combos)

# ==========================================================================
# Section 3: Household Expenses
# ==========================================================================

st.divider()
st.title("Household Expenses")
section3_open = st.toggle("Show Section", value=True, key="section3_open", label_visibility="collapsed")
if section3_open:
    st.caption(f"Section 3: Recurring and loan-based household expenses, projected by age up to {EXPENSE_HORIZON_AGE}")

    default_current_age = (
        calculate_age(date.fromisoformat(st.session_state.people[0]["birthday"]))
        if st.session_state.people else 35
    )
    current_age_for_expenses = st.number_input(
        "Current Age (for this projection)",
        min_value=1,
        max_value=EXPENSE_HORIZON_AGE - 1,
        value=min(default_current_age, EXPENSE_HORIZON_AGE - 1),
        key="expenses_current_age",
    )

    if "expense_form_open" not in st.session_state:
        # Same reasoning as income_form_open above — this section isn't in a
        # form either, so recomputing `not expenses` every run would collapse
        # it after every field edit.
        st.session_state.expense_form_open = not st.session_state.expenses

    with st.expander("Add an Expense", expanded=st.session_state.expense_form_open):
        type_col, amount_col = st.columns(2)
        with type_col:
            expense_type = st.selectbox("Expense Type", EXPENSE_TYPES, key="expense_type_select")
        is_loan_type = expense_type in LOAN_EXPENSE_TYPES
        with amount_col:
            monthly_amount = st.number_input(
                "Current Monthly Payment ($)" if is_loan_type else "Monthly Value ($)",
                min_value=0.0, value=0.0, step=50.0, key="expense_monthly_amount",
            )

        is_perpetuity = True
        start_age_input = None
        stop_age_input = None
        apply_inflation = False
        inflation_rate = 0.0
        remaining_term_years = None

        # Reference values for a couple of expense types that logically depend
        # on other household state: Property Taxes are assumed to only become a
        # separate cost once the mortgage is paid off, and Health Insurance is
        # assumed to bridge the gap between employer coverage ending at
        # retirement and Medicare eligibility at 65 (no gap if retiring at 65+).
        mortgage_payoff_age = None
        if expense_type == "Property Taxes":
            mortgage_terms = [
                e.get("remaining_term_years") for e in st.session_state.expenses
                if e["type"] == "Mortgage" and e.get("is_loan") and e.get("remaining_term_years") is not None
            ]
            if mortgage_terms:
                mortgage_payoff_age = min(int(current_age_for_expenses) + max(mortgage_terms), 100)

        retirement_age_ref = None
        if expense_type == "Health Insurance" and st.session_state.people:
            retirement_age_ref = int(st.session_state.people[0]["retirement_age"])

        # Only overwrite the perpetuity/start/stop widget state the first render
        # after the expense type changes to one of these — otherwise every
        # rerun (e.g. from editing the monthly amount) would stomp a value the
        # user deliberately changed afterward.
        if expense_type != st.session_state.get("expense_type_prev"):
            st.session_state.expense_type_prev = expense_type
            if mortgage_payoff_age is not None:
                st.session_state.expense_perpetuity = False
                st.session_state.expense_start_age = mortgage_payoff_age
                st.session_state.expense_stop_age = EXPENSE_HORIZON_AGE
            elif retirement_age_ref is not None:
                st.session_state.expense_perpetuity = False
                st.session_state.expense_start_age = retirement_age_ref
                st.session_state.expense_stop_age = (
                    65 if retirement_age_ref < 65 else max(1, retirement_age_ref - 1)
                )

        if is_loan_type:
            remaining_term_years = st.number_input(
                "Remaining Term (Years)", min_value=0, max_value=50, value=15, step=1,
                key="expense_remaining_term",
            )
            st.caption("Loan payments are fixed (no inflation) and fall off automatically once the term ends.")
        else:
            if retirement_age_ref is not None and retirement_age_ref >= 65:
                st.warning(
                    f"Retirement age is {retirement_age_ref}, so Medicare coverage begins immediately "
                    "at retirement — there's no coverage gap to insure. This defaults to a zero-length "
                    "window (won't count toward your projection) unless you widen it."
                )

            is_perpetuity = st.checkbox(
                "Perpetuity (runs the whole projection)", value=True, key="expense_perpetuity"
            )
            if not is_perpetuity:
                start_help = stop_help = None
                if mortgage_payoff_age is not None:
                    start_help = (
                        f"Defaults to age {mortgage_payoff_age}, when your mortgage is paid off — "
                        "property taxes are assumed to only show up as a separate cost after that."
                    )
                elif retirement_age_ref is not None:
                    if retirement_age_ref < 65:
                        start_help = (
                            f"Defaults to your retirement age ({retirement_age_ref}) — employer health "
                            "coverage typically ends at retirement."
                        )
                        stop_help = "Defaults to 65, when Medicare eligibility begins."
                    else:
                        start_help = (
                            f"Defaults to a zero-length window since Medicare covers you immediately "
                            f"at retirement (age {retirement_age_ref})."
                        )

                start_col, stop_col = st.columns(2)
                with start_col:
                    start_age_input = st.number_input(
                        "Start Age", min_value=1, max_value=100, value=int(current_age_for_expenses),
                        key="expense_start_age", help=start_help,
                    )
                with stop_col:
                    stop_age_input = st.number_input(
                        "Stop Age", min_value=1, max_value=100,
                        value=min(int(current_age_for_expenses) + 10, 100), key="expense_stop_age",
                        help=stop_help,
                    )
            apply_inflation = st.checkbox("Apply Inflation", value=True, key="expense_apply_inflation")
            if apply_inflation:
                inflation_rate = st.number_input(
                    "Inflation Rate (%)", min_value=0.0, max_value=20.0, value=3.0, step=0.1,
                    key="expense_inflation_rate",
                )

        if st.button("Add Expense", key="add_expense_button"):
            st.session_state.expenses.append({
                "id": str(uuid.uuid4()),
                "type": expense_type,
                "monthly_amount": monthly_amount,
                "is_loan": is_loan_type,
                "remaining_term_years": remaining_term_years,
                "is_perpetuity": is_perpetuity,
                "start_age": start_age_input,
                "stop_age": stop_age_input,
                "apply_inflation": apply_inflation,
                "inflation_rate": inflation_rate,
            })
            save_expenses(st.session_state.expenses)
            st.rerun()

    st.divider()

    if not st.session_state.expenses:
        st.info("No expenses added yet. Use the form above to add one.")
    else:
        st.subheader("Expenses")
        for expense in st.session_state.expenses:
            e_col, remove_col = st.columns([5, 1])
            e_col.markdown(f"**{expense['type']}** — {describe_expense(expense)}")
            if remove_col.button("Remove", key=f"remove_expense_{expense['id']}"):
                st.session_state.expenses = [
                    e for e in st.session_state.expenses if e["id"] != expense["id"]
                ]
                save_expenses(st.session_state.expenses)
                st.rerun()

        st.divider()
        st.subheader("Projected Household Expenses")
        expense_chart_df = build_expense_chart_df(
            st.session_state.expenses, int(current_age_for_expenses), EXPENSE_HORIZON_AGE
        )
        if expense_chart_df.empty:
            st.info("No active expenses in the selected age range.")
        else:
            expense_chart = (
                alt.Chart(expense_chart_df)
                .mark_bar()
                .encode(
                    x=alt.X("Age:O", title="Age"),
                    y=alt.Y("Cost:Q", title="Annual Cost ($)", stack="zero", axis=alt.Axis(format="$,.2s")),
                    color=alt.Color(
                        "Type:N",
                        scale=alt.Scale(domain=EXPENSE_TYPES, range=[EXPENSE_PALETTE[t] for t in EXPENSE_TYPES]),
                        sort=EXPENSE_TYPES,
                        legend=alt.Legend(title=None, orient="bottom", labelLimit=200, labelFontSize=12, columns=4),
                    ),
                    tooltip=[
                        alt.Tooltip("Age:O"),
                        alt.Tooltip("Type:N"),
                        alt.Tooltip("Cost:Q", format="$,.0f"),
                    ],
                )
                .properties(height=440)
            )
            st.altair_chart(expense_chart, width="stretch")

        st.divider()
        st.subheader("Household Income vs. Expenses")
        st.caption(
            "Combined take-home income, 401k withdrawal income, Social Security, and total expenses by "
            "age, with the surplus or deficit shown as bars. Once a person's earned income stops (their "
            "own retirement age), their 401k balance x withdrawal rate takes over; Social Security layers "
            "in independently once each person reaches their own claim age. This always reflects your "
            "actual, saved data — to explore a 401k scenario or freely adjust any input, use the "
            "Simulator section below."
        )

        withdrawal_rate_pct = st.number_input(
            "401k Withdrawal Rate (%)", min_value=0.0, max_value=20.0, value=4.0, step=0.5,
            key="withdrawal_rate_pct",
            help="Annual % of 401k balance drawn as income once a person's own earned income stops.",
        )
        render_household_cash_flow_charts(
            st.session_state.people, st.session_state.expenses,
            int(current_age_for_expenses), EXPENSE_HORIZON_AGE, withdrawal_rate_pct,
        )


# ==========================================================================
# Section 4: Simulator
# ==========================================================================

st.divider()
st.title("Simulator")
section4_open = st.toggle("Show Section", value=True, key="section4_open", label_visibility="collapsed")
if section4_open:
    st.caption(
        "Section 4: Freely adjust anyone's income and 401k assumptions — including a simulated income "
        "change — and see the effect on the Household Income vs. Expenses view. Nothing here is saved, "
        "and expenses stay fixed since they aren't part of the simulation."
    )

    if not st.session_state.people:
        st.info("Add someone in the Income section above to use the simulator.")
    else:
        # Reads the Household Expenses section's Current Age from session
        # state rather than its local variable, since that section may be
        # collapsed (and therefore not have run) on this rerun.
        default_sim_current_age = calculate_age(date.fromisoformat(st.session_state.people[0]["birthday"]))
        current_age_for_sim = int(
            st.session_state.get("expenses_current_age", min(default_sim_current_age, EXPENSE_HORIZON_AGE - 1))
        )

        if st.button("Reset to My Actual Data", key="sim_reset_button"):
            for key in [k for k in st.session_state if k.startswith("sim_") and k != "sim_reset_button"]:
                del st.session_state[key]
            for person in st.session_state.people:
                seed_simulator_state_from_person(person)
                # Explicitly (not just via deletion) so the "Load from Saved
                # Scenario" picker's displayed value updates immediately —
                # deleting its key alone doesn't reliably reset an already-
                # rendered selectbox back to its default option.
                st.session_state[f"sim_{person['id']}_scenario_picker"] = "Base"
                st.session_state[f"sim_{person['id']}_scenario_picker_applied"] = "Base"
            st.rerun()

        sim_overrides_by_person = {}
        for person in st.session_state.people:
            sim_age = calculate_age(date.fromisoformat(person["birthday"]))
            with st.expander(f"{person['name']} — Simulated Inputs (Age {sim_age})", expanded=False):
                sim_overrides_by_person[person["id"]] = render_person_simulator_inputs(person)

        st.divider()
        sim_withdrawal_rate_pct = st.number_input(
            "401k Withdrawal Rate (%)", min_value=0.0, max_value=20.0,
            value=float(st.session_state.get("withdrawal_rate_pct", 4.0)), step=0.5,
            key="sim_withdrawal_rate_pct",
            help="Annual % of 401k balance drawn as income once a person's own earned income stops. "
                 "Independent of the rate set in the Household Expenses section above.",
        )
        st.caption(
            f"Uses the Current Age set in the Household Expenses section above (age "
            f"{current_age_for_sim}) so expenses line up exactly with the actual projection — "
            "only income and 401k assumptions are simulated."
        )
        render_simulator_charts(
            st.session_state.people, st.session_state.expenses,
            current_age_for_sim, EXPENSE_HORIZON_AGE,
            sim_overrides_by_person, sim_withdrawal_rate_pct,
            float(st.session_state.get("withdrawal_rate_pct", 4.0)),
        )


