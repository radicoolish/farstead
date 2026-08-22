import { useState, type ComponentType } from "react";
import { AppDataProvider } from "./state/AppDataContext";
import { ThemeProvider } from "./state/ThemeContext";
import { AppNav } from "./components/AppNav";
import { SimpleNav } from "./components/SimpleNav";
import { StepFooter } from "./components/StepFooter";
import { Modal } from "./components/Modal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { DataManagementSection } from "./components/DataManagementSection";
import { IncomeSection } from "./components/IncomeSection";
import { FourZeroOneKSection } from "./components/FourZeroOneKSection";
import { ExpensesSection } from "./components/ExpensesSection";
import { SummarySection } from "./components/SummarySection";
import { SimulatorSection } from "./components/SimulatorSection";
import { SimpleInputPage } from "./components/SimpleInputPage";
import { SimpleOutputPage } from "./components/SimpleOutputPage";
import { useSimpleHousehold } from "./hooks/useSimpleHousehold";
import { IconData } from "./components/icons";
import { loadFromStorage, saveToStorage, PLANNING_MODE_KEY, WELCOME_SEEN_KEY } from "./storage/localStorage";
import type { PlanningMode, SectionKey, SimpleSectionKey } from "./sections";

const SECTION_COMPONENTS: Record<SectionKey, ComponentType> = {
  income: IncomeSection,
  "401k": FourZeroOneKSection,
  expenses: ExpensesSection,
  summary: SummarySection,
  simulator: SimulatorSection,
};

const MAIN_STYLE = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "2rem 1.5rem calc(3rem + env(safe-area-inset-bottom))",
} as const;

interface ModeSwitchProps {
  onShowWelcome: () => void;
  planningMode: PlanningMode;
  onPlanningModeChange: (mode: PlanningMode) => void;
}

/** The full per-person planner — everything this app had before Simple
 * mode existed, unchanged. */
function AdvancedApp({ onShowWelcome, planningMode, onPlanningModeChange }: ModeSwitchProps) {
  const [active, setActive] = useState<SectionKey>("income");
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  const ActiveSection = SECTION_COMPONENTS[active];

  function handleSelect(key: SectionKey) {
    setActive(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AppDataProvider>
      <AppNav
        active={active}
        onSelect={handleSelect}
        onOpenDataManagement={() => setDataManagementOpen(true)}
        onShowWelcome={onShowWelcome}
        planningMode={planningMode}
        onPlanningModeChange={onPlanningModeChange}
      />
      <main style={MAIN_STYLE}>
        <div key={active} className="section-transition">
          <ActiveSection />
        </div>
        <StepFooter active={active} onSelect={handleSelect} />
      </main>
      <Modal open={dataManagementOpen} onClose={() => setDataManagementOpen(false)} title="Data Management" icon={<IconData />}>
        <DataManagementSection />
      </Modal>
    </AppDataProvider>
  );
}

/** The household-as-one-aggregate-unit planner: one page of inputs, one
 * page of outputs. Its data (useSimpleHousehold) is entirely separate
 * from Advanced mode's — see calc/simple.ts. */
function SimpleApp({ onShowWelcome, planningMode, onPlanningModeChange }: ModeSwitchProps) {
  const [active, setActive] = useState<SimpleSectionKey>("inputs");
  const { household, update, addExpense, removeExpense } = useSimpleHousehold();

  function handleSelect(key: SimpleSectionKey) {
    setActive(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <SimpleNav
        active={active}
        onSelect={handleSelect}
        onShowWelcome={onShowWelcome}
        planningMode={planningMode}
        onPlanningModeChange={onPlanningModeChange}
      />
      <main style={MAIN_STYLE}>
        <div key={active} className="section-transition">
          {active === "inputs" ? (
            <SimpleInputPage household={household} onUpdate={update} onAddExpense={addExpense} onRemoveExpense={removeExpense} />
          ) : (
            <SimpleOutputPage household={household} />
          )}
        </div>
      </main>
    </>
  );
}

function App() {
  const [planningMode, setPlanningMode] = useState<PlanningMode>(() => loadFromStorage<PlanningMode>(PLANNING_MODE_KEY, "advanced"));
  const [showWelcome, setShowWelcome] = useState(() => !loadFromStorage(WELCOME_SEEN_KEY, false));

  function dismissWelcome() {
    saveToStorage(WELCOME_SEEN_KEY, true);
    setShowWelcome(false);
  }

  function handlePlanningModeChange(mode: PlanningMode) {
    setPlanningMode(mode);
    saveToStorage(PLANNING_MODE_KEY, mode);
  }

  const modeSwitchProps: ModeSwitchProps = {
    onShowWelcome: () => setShowWelcome(true),
    planningMode,
    onPlanningModeChange: handlePlanningModeChange,
  };

  return (
    <ThemeProvider>
      {showWelcome && <WelcomeScreen onDismiss={dismissWelcome} />}
      {planningMode === "simple" ? <SimpleApp {...modeSwitchProps} /> : <AdvancedApp {...modeSwitchProps} />}
    </ThemeProvider>
  );
}

export default App;
