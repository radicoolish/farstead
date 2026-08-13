import json
import uuid
from datetime import date
from pathlib import Path

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


if "people" not in st.session_state:
    st.session_state.people = load_people()


# ---------- Helpers ----------

def calculate_age(birthday: date) -> int:
    today = date.today()
    return today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))


def project_balance(person: dict) -> pd.DataFrame:
    age = calculate_age(date.fromisoformat(person["birthday"]))
    years_to_grow = max(person["retirement_age"] - age, 0)

    balance = person["current_balance"]
    salary = person["current_salary"]
    contrib_pct = person["contribution_pct"] / 100
    match_pct = person["match_pct"] / 100
    salary_growth = person["salary_increase_pct"] / 100
    growth_rate = person["growth_rate_pct"] / 100

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


# ---------- UI ----------

st.title("401(k) Planner")
st.caption("Section 1: Individual 401(k) inputs and balance projection")

with st.form("add_person_form", clear_on_submit=True):
    st.subheader("Add a Person")
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
        salary_increase_pct = st.number_input("Annual Salary Increase (%)", min_value=0.0, max_value=50.0, value=3.0)
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
            })
            save_people(st.session_state.people)
            st.success(f"Added {name.strip()}.")

st.divider()

if not st.session_state.people:
    st.info("No people added yet. Use the form above to add someone.")
else:
    st.subheader("People")

    for person in list(st.session_state.people):
        age = calculate_age(date.fromisoformat(person["birthday"]))
        with st.expander(f"{person['name']} — Age {age} — {person['account_type']}", expanded=False):
            info_col, action_col = st.columns([4, 1])

            with info_col:
                m1, m2, m3, m4 = st.columns(4)
                m1.metric("Current Balance", f"${person['current_balance']:,.0f}")
                m2.metric("Current Salary", f"${person['current_salary']:,.0f}")
                m3.metric("Contribution + Match", f"{person['contribution_pct'] + person['match_pct']:.1f}%")
                m4.metric("Retirement Age", person["retirement_age"])

                st.caption(
                    f"Growth rate assumption: {person['growth_rate_pct']}% • "
                    f"Salary increase assumption: {person['salary_increase_pct']}% • "
                    f"Account type: {person['account_type']}"
                )

                df = project_balance(person)
                if len(df) > 1:
                    st.line_chart(df.set_index("Age")["Balance"])
                    projected = df.iloc[-1]["Balance"]
                    st.metric(
                        f"Projected Balance at Age {person['retirement_age']}",
                        f"${projected:,.0f}",
                    )
                    with st.popover("View year-by-year projection"):
                        st.dataframe(df, width="stretch", hide_index=True)
                else:
                    st.warning("Retirement age must be greater than current age to project growth.")

            with action_col:
                if st.button("Delete", key=f"delete_{person['id']}"):
                    st.session_state.people = [
                        p for p in st.session_state.people if p["id"] != person["id"]
                    ]
                    save_people(st.session_state.people)
                    st.rerun()

    st.divider()
    st.subheader("Household Summary")
    total_current = sum(p["current_balance"] for p in st.session_state.people)
    total_projected = sum(project_balance(p).iloc[-1]["Balance"] for p in st.session_state.people)
    s1, s2 = st.columns(2)
    s1.metric("Combined Current Balance", f"${total_current:,.0f}")
    s2.metric("Combined Projected Balance at Retirement", f"${total_projected:,.0f}")
