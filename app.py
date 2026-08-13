import html
import itertools
import json
import uuid
from datetime import date
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

DATA_FILE = Path(__file__).parent / "data" / "people.json"

st.set_page_config(page_title="Investment Scenario Planner", layout="wide")


# ---------- Persistence ----------

def load_people() -> list[dict]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return []


def save_people(people: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(people, indent=2, default=str))


def normalize_scenarios(person: dict) -> list[dict]:
    scenarios = person.setdefault("scenarios", [])
    for i, scenario in enumerate(scenarios):
        if "name" not in scenario:
            scenario["name"] = f"Scenario {i + 1}"
        scenario.setdefault("detail", scenario.get("label", scenario["name"]))
    return scenarios


if "people" not in st.session_state:
    st.session_state.people = load_people()
    for p in st.session_state.people:
        normalize_scenarios(p)


# ---------- Scenario field config ----------
# Fields a scenario is allowed to vary. Current balance, birthday, employer
# match, current salary, and account type stay fixed from the base person.
SCENARIO_FIELDS = {
    "% of Salary Contributed": {"key": "contribution_pct", "min": 0.0, "max": 50.0, "step": 0.5, "percent": True},
    "Annual Salary Increase (%)": {"key": "salary_increase_pct", "min": 0.0, "max": 15.0, "step": 0.25, "percent": True},
    "Annual Growth Rate (%)": {"key": "growth_rate_pct", "min": 0.0, "max": 15.0, "step": 0.25, "percent": True},
    "Retirement / Draw Age": {"key": "retirement_age", "min": 1, "max": 100, "step": 1, "percent": False},
}


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

    balance = effective["current_balance"]
    salary = effective["current_salary"]
    contrib_pct = effective["contribution_pct"] / 100
    match_pct = effective["match_pct"] / 100
    salary_growth = effective["salary_increase_pct"] / 100
    growth_rate = effective["growth_rate_pct"] / 100

    rows = [{"Age": age, "Year": date.today().year, "Balance": round(balance, 2)}]
    for i in range(1, years_to_grow + 1):
        annual_contribution = salary * (contrib_pct + match_pct)
        balance = balance * (1 + growth_rate) + annual_contribution
        salary = salary * (1 + salary_growth)
        rows.append({
            "Age": age + i,
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
        return ["#2e7d32"]
    return [f"hsl(145, 55%, {75 - (i / (n - 1)) * 50:.0f}%)" for i in range(n)]


def render_household_combinations(people: list[dict]) -> None:
    """Draw every combination of each person's Base/scenarios summed together,
    e.g. 3 options for one person x 3 for another = 9 combined household lines."""
    per_person_choices = [
        [(person, name, overrides) for name, overrides in person_scenario_options(person)]
        for person in people
    ]
    total_combos = 1
    for choices in per_person_choices:
        total_combos *= len(choices)

    if total_combos > MAX_HOUSEHOLD_COMBOS:
        st.caption(
            f"{total_combos} scenario combinations across the household is too many to chart clearly "
            f"(limit is {MAX_HOUSEHOLD_COMBOS}). Remove some scenarios to see the combined view."
        )
        return

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


def render_household_combo_bars(
    combo_data: dict[str, pd.Series],
    combo_labels: list[str],
    color_scale: alt.Scale,
) -> None:
    """Bar chart of each combination's final projected balance, colored to
    match the line chart next to it (same scale, no legend of its own),
    with each bar labeled in millions of dollars."""
    bar_df = pd.DataFrame({
        "Combination": combo_labels,
        "Balance": [combo_data[label].iloc[-1] for label in combo_labels],
    })
    bar_df["Label"] = bar_df["Balance"].apply(format_compact_currency)

    bars = alt.Chart(bar_df).mark_bar().encode(
        x=alt.X("Combination:N", sort=combo_labels, axis=None, title=None),
        y=alt.Y("Balance:Q", title="Balance ($)", axis=alt.Axis(format="$,.2s")),
        color=alt.Color("Combination:N", scale=color_scale, sort=combo_labels, legend=None),
        tooltip=[alt.Tooltip("Combination:N"), alt.Tooltip("Balance:Q", format="$,.0f")],
    )
    labels = alt.Chart(bar_df).mark_text(dy=-8, fontSize=13, fontWeight="bold").encode(
        x=alt.X("Combination:N", sort=combo_labels),
        y="Balance:Q",
        text="Label:N",
    )

    st.altair_chart((bars + labels).properties(height=420), width="stretch")


# ---------- UI ----------

st.title("401(k) Planner")
st.caption("Section 1: Individual 401(k) inputs and balance projection")

with st.expander("Add a Person", expanded=not st.session_state.people):
    with st.form("add_person_form", clear_on_submit=True):
        col1, col2, col3 = st.columns(3)

        with col1:
            name = st.text_input("Name")
            birthday = st.date_input(
                "Birthday", value=date(1990, 1, 1), min_value=date(1930, 1, 1), max_value=date.today()
            )
            retirement_age = st.number_input("Retirement / Draw Age", min_value=1, max_value=100, value=65)

        with col2:
            current_balance = st.number_input("Current 401(k) Balance ($)", min_value=0.0, value=0.0, step=1000.0)
            current_salary = st.number_input("Current Annual Salary ($)", min_value=0.0, value=0.0, step=1000.0)
            account_type = st.radio("Account Type", ["Pre-tax", "Roth"], horizontal=True)

        with col3:
            contribution_pct = st.number_input("% of Salary Contributed", min_value=0.0, max_value=100.0, value=6.0)
            match_pct = st.number_input("% of Salary Matched", min_value=0.0, max_value=100.0, value=3.0)
            salary_increase_pct = st.number_input(
                "Annual Salary Increase (%)", min_value=0.0, max_value=50.0, value=3.0
            )
            growth_rate_pct = st.number_input("Annual Growth Rate (%)", min_value=0.0, max_value=50.0, value=7.0)

        submitted = st.form_submit_button("Add Person")
        if submitted:
            if not name.strip():
                st.error("Name is required.")
            else:
                st.session_state.people.append({
                    "id": str(uuid.uuid4()),
                    "name": name.strip(),
                    "birthday": birthday.isoformat(),
                    "current_balance": current_balance,
                    "current_salary": current_salary,
                    "contribution_pct": contribution_pct,
                    "match_pct": match_pct,
                    "salary_increase_pct": salary_increase_pct,
                    "growth_rate_pct": growth_rate_pct,
                    "account_type": account_type,
                    "retirement_age": retirement_age,
                    "scenarios": [],
                })
                save_people(st.session_state.people)
                st.success(f"Added {name.strip()}.")

st.divider()

if not st.session_state.people:
    st.info("No people added yet. Use the form above to add someone.")
else:
    st.subheader("People")

    for person in list(st.session_state.people):
        normalize_scenarios(person)
        age = calculate_age(date.fromisoformat(person["birthday"]))
        with st.expander(f"{person['name']} — Age {age} — {person['account_type']}", expanded=False):
            header_col, action_col = st.columns([5, 1])

            with header_col:
                m1, m2, m3, m4, m5, m6 = st.columns(6)
                m1.metric("Current Balance", f"${person['current_balance']:,.0f}")
                m2.metric("Current Salary", f"${person['current_salary']:,.0f}")
                m3.metric("Contribution + Match", f"{person['contribution_pct'] + person['match_pct']:.1f}%")
                m4.metric("Retirement Age", person["retirement_age"])
                m5.metric("Salary Increase", f"{person['salary_increase_pct']}%")
                m6.metric("Growth Rate", f"{person['growth_rate_pct']}%")

                st.caption(f"Account type: {person['account_type']}")

            with action_col:
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
                combined = pd.concat(chart_data, axis=1)
                st.line_chart(combined)

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
                        list(SCENARIO_FIELDS.keys()),
                        key=f"scenario_field_{person['id']}",
                    )
                config = SCENARIO_FIELDS[field_label]
                base_value = person[config["key"]]

                min_value = config["min"]
                if config["key"] == "retirement_age":
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
    s1, s2 = st.columns(2)
    s1.metric("Combined Current Balance", format_compact_currency(total_current), help=f"${total_current:,.0f}")
    s2.metric(
        "Combined Projected Balance at Retirement",
        format_compact_currency(total_projected),
        help=f"${total_projected:,.0f}",
    )

    render_household_combinations(st.session_state.people)
