import { buildHouseholdComboData, formatCompactCurrency, projectBalance } from "../calc";
import { useAppData } from "../state/AppDataContext";
import { PersonBalanceCard } from "./PersonBalanceCard";
import { HouseholdComboChart } from "./HouseholdComboChart";
import { StatTile } from "./StatTile";
import { MAX_HOUSEHOLD_COMBOS } from "../calc";
import { SECTION_META } from "./AppNav";

const { Icon } = SECTION_META["401k"];

/** Section 2: 401(k) Planner. Per-person projection + scenarios, plus a
 * household-wide summary and scenario-combination chart. Mirrors app.py's
 * Section 2. */
export function FourZeroOneKSection() {
  const { people } = useAppData();

  if (people.length === 0) {
    return (
      <section>
        <h2 className="section-title">
          <Icon className="section-title-icon" />
          401(k) Planner
        </h2>
        <p className="caption">Individual 401(k) inputs and balance projection</p>
        <p className="caption">No people yet — add someone in the Income section.</p>
      </section>
    );
  }

  const totalCurrent = people.reduce((sum, p) => sum + p.currentBalance, 0);
  const totalProjected = people.reduce((sum, p) => {
    const rows = projectBalance(p);
    return sum + rows[rows.length - 1].balance;
  }, 0);
  const { combos, totalCombos } = buildHouseholdComboData(people);
  const maxBalance =
    combos.length > 0 ? Math.max(...combos.map((c) => [...c.series.values()][c.series.size - 1])) : null;

  return (
    <section>
      <h2 className="section-title">
        <Icon className="section-title-icon" />
        401(k) Planner
      </h2>
      <p className="caption">Individual 401(k) inputs and balance projection</p>

      <h3>People</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {people.map((person) => (
          <PersonBalanceCard key={person.id} person={person} />
        ))}
      </div>

      <h3>Household Summary</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <StatTile label="Combined Current Balance" value={formatCompactCurrency(totalCurrent)} help={`$${totalCurrent.toLocaleString("en-US")}`} />
        <StatTile
          label="Combined Projected Balance at Retirement"
          value={formatCompactCurrency(totalProjected)}
          help={`$${totalProjected.toLocaleString("en-US")}`}
        />
        <StatTile label="Maximum Scenario" value={maxBalance !== null ? formatCompactCurrency(maxBalance) : "—"} />
      </div>

      {combos.length === 0 ? (
        <p className="caption">
          {totalCombos} scenario combinations across the household is too many to chart clearly (limit is{" "}
          {MAX_HOUSEHOLD_COMBOS}). Remove some scenarios to see the combined view.
        </p>
      ) : (
        <HouseholdComboChart combos={combos} totalCombos={totalCombos} />
      )}
    </section>
  );
}
