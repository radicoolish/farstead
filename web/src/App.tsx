import { useState, type ComponentType } from "react";
import { AppDataProvider } from "./state/AppDataContext";
import { ThemeProvider } from "./state/ThemeContext";
import { AppNav } from "./components/AppNav";
import { StepFooter } from "./components/StepFooter";
import { Modal } from "./components/Modal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { DataManagementSection } from "./components/DataManagementSection";
import { IncomeSection } from "./components/IncomeSection";
import { FourZeroOneKSection } from "./components/FourZeroOneKSection";
import { ExpensesSection } from "./components/ExpensesSection";
import { SummarySection } from "./components/SummarySection";
import { SimulatorSection } from "./components/SimulatorSection";
import { IconData } from "./components/icons";
import { loadFromStorage, saveToStorage, WELCOME_SEEN_KEY } from "./storage/localStorage";
import type { SectionKey } from "./sections";

const SECTION_COMPONENTS: Record<SectionKey, ComponentType> = {
  income: IncomeSection,
  "401k": FourZeroOneKSection,
  expenses: ExpensesSection,
  summary: SummarySection,
  simulator: SimulatorSection,
};

function App() {
  const [active, setActive] = useState<SectionKey>("income");
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !loadFromStorage(WELCOME_SEEN_KEY, false));
  const ActiveSection = SECTION_COMPONENTS[active];

  function handleSelect(key: SectionKey) {
    setActive(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function dismissWelcome() {
    saveToStorage(WELCOME_SEEN_KEY, true);
    setShowWelcome(false);
  }

  return (
    <ThemeProvider>
      <AppDataProvider>
        {showWelcome && <WelcomeScreen onDismiss={dismissWelcome} />}
        <AppNav active={active} onSelect={handleSelect} onOpenDataManagement={() => setDataManagementOpen(true)} />
        <main
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "2rem 1.5rem calc(3rem + env(safe-area-inset-bottom))",
          }}
        >
          <div key={active} className="section-transition">
            <ActiveSection />
          </div>
          <StepFooter active={active} onSelect={handleSelect} />
        </main>
        <Modal
          open={dataManagementOpen}
          onClose={() => setDataManagementOpen(false)}
          title="Data Management"
          icon={<IconData />}
        >
          <DataManagementSection />
        </Modal>
      </AppDataProvider>
    </ThemeProvider>
  );
}

export default App;
