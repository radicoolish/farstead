import { useState, type ComponentType } from "react";
import { AppDataProvider } from "./state/AppDataContext";
import { ThemeProvider } from "./state/ThemeContext";
import { AppNav } from "./components/AppNav";
import { StepFooter } from "./components/StepFooter";
import { Modal } from "./components/Modal";
import { DataManagementSection } from "./components/DataManagementSection";
import { IncomeSection } from "./components/IncomeSection";
import { FourZeroOneKSection } from "./components/FourZeroOneKSection";
import { ExpensesSection } from "./components/ExpensesSection";
import { SummarySection } from "./components/SummarySection";
import { SimulatorSection } from "./components/SimulatorSection";
import { IconData } from "./components/icons";
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
  const ActiveSection = SECTION_COMPONENTS[active];

  function handleSelect(key: SectionKey) {
    setActive(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <ThemeProvider>
      <AppDataProvider>
        <AppNav active={active} onSelect={handleSelect} onOpenDataManagement={() => setDataManagementOpen(true)} />
        <main style={{ maxWidth: 1080, margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
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
