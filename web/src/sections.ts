export type SectionKey = "income" | "401k" | "expenses" | "summary" | "simulator";

/** Advanced = the full per-person planner (unchanged, everything above);
 * Simple = one aggregate household, one page of inputs, one page of
 * outputs (see calc/simple.ts). Independent data, freely switchable. */
export type PlanningMode = "simple" | "advanced";

export type SimpleSectionKey = "inputs" | "results";
