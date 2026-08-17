import { useState } from "react";
import { calculateAge, type Person } from "../calc";
import type { PersonDraft } from "../hooks/usePeople";
import { PersonForm } from "./PersonForm";

interface PersonCardProps {
  person: Person;
  onUpdate: (draft: PersonDraft) => void;
  onRemove: () => void;
}

/** One person's summary row, with inline Edit (swaps to the same form used
 * to create them) and Delete. */
export function PersonCard({ person, onUpdate, onRemove }: PersonCardProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="card">
        <PersonForm
          initial={person}
          submitLabel="Save Changes"
          onSubmit={(draft) => {
            onUpdate(draft);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="card card-row">
      <div>
        <strong>{person.name}</strong>{" "}
        <span className="caption">
          ${person.currentSalary.toLocaleString("en-US")}/yr · Age {calculateAge(person.birthday)}
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="danger" onClick={onRemove}>
          Delete
        </button>
      </div>
    </div>
  );
}
