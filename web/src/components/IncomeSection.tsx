import { useState, type SyntheticEvent } from "react";
import { useAppData } from "../state/AppDataContext";
import { PersonForm } from "./PersonForm";
import { PersonCard } from "./PersonCard";
import { SECTION_META } from "./AppNav";

const { Icon } = SECTION_META.income;

/** Section 1: Household Income. Person creation via "Tell Me About
 * Yourself", plus the list of everyone already added. Mirrors app.py's
 * Section 1. */
export function IncomeSection() {
  const { people, addPerson, updatePerson, removePerson } = useAppData();
  // Initialized once from whether anyone existed at mount, then fully
  // user-controlled from there — recomputing this from people.length on
  // every render would force the panel open/closed out from under whoever
  // is mid-edit, the same bug the Streamlit version had to work around.
  const [formOpen, setFormOpen] = useState(() => people.length === 0);

  function handleToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    setFormOpen(e.currentTarget.open);
  }

  return (
    <section>
      <h2 className="section-title">
        <Icon className="section-title-icon" />
        Household Income
      </h2>
      <p className="caption">Per-person income, paycheck deductions, and effective tax rate</p>

      {people.length > 0 && (
        <>
          <h3>People</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
            {people.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onUpdate={(draft) => updatePerson(person.id, draft)}
                onRemove={() => removePerson(person.id)}
              />
            ))}
          </div>
        </>
      )}

      <details className="panel" open={formOpen} onToggle={handleToggle}>
        <summary>Tell Me About Yourself</summary>
        <div className="panel-body">
          <PersonForm onSubmit={addPerson} />
        </div>
      </details>

      {people.length === 0 && <p className="caption">No people added yet. Use the form above to add someone.</p>}
    </section>
  );
}
