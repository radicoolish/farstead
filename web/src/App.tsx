import { useState, type ComponentType } from "react";
import { AppDataProvider } from "./state/AppDataContext";
import { AppNav } from "./components/AppNav";
import { Modal } from "./components/Modal";
import { DataManagementSection } from "./components/DataManagementSection";
import { IncomeSection } from "./components/IncomeSection";
import { FourZeroOneKSection } from "./components/FourZeroOneKSection";
import { ExpensesSection } from "./components/ExpensesSection";
import { SimulatorSection } from "./components/SimulatorSection";
import { IconData } from "./components/icons";
import type { SectionKey } from "./sections";

const SECTION_COMPONENTS: Record<SectionKey, ComponentType> = {
  income: IncomeSection,
  "401k": FourZeroOneKSection,
  expenses: ExpensesSection,
  simulator: SimulatorSection,
};

function App() {
  const [active, setActive] = useState<SectionKey>("income");
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  const ActiveSection = SECTION_COMPONENTS[active];

  return (
    <AppDataProvider>
      <AppNav active={active} onSelect={setActive} onOpenDataManagement={() => setDataManagementOpen(true)} />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
        <div key={active} className="section-transition">
          <ActiveSection />
        </div>
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
  );
}

export default App;
