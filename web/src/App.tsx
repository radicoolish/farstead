import { AppDataProvider } from "./state/AppDataContext";
import { DataManagementSection } from "./components/DataManagementSection";
import { IncomeSection } from "./components/IncomeSection";
import { FourZeroOneKSection } from "./components/FourZeroOneKSection";
import { ExpensesSection } from "./components/ExpensesSection";
import { SimulatorSection } from "./components/SimulatorSection";

function App() {
  return (
    <AppDataProvider>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <DataManagementSection />
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "2.5rem 0" }} />
        <IncomeSection />
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "2.5rem 0" }} />
        <FourZeroOneKSection />
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "2.5rem 0" }} />
        <ExpensesSection />
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "2.5rem 0" }} />
        <SimulatorSection />
      </main>
    </AppDataProvider>
  );
}

export default App;
