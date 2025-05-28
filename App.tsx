
import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import PlanningPage from './pages/PlanningPage';
import EmployeesPage from './pages/EmployeesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import ReportsPage from './pages/ReportsPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage'; // Nuova pagina Admin
import { useData } from './contexts/DataContext';

// Componente per proteggere le rotte
const ProtectedRoute: React.FC<{isAllowed: boolean, redirectPath?: string, children?: React.ReactNode}> = ({
  isAllowed,
  redirectPath = '/',
  children,
}) => {
  if (!isAllowed) {
    return <Navigate to={redirectPath} replace />;
  }
  return children ? <>{children}</> : <Outlet />;
};


const App: React.FC = () => {
  const { isAdminAuthenticated } = useData();

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pianificazione" element={<PlanningPage />} />
            <Route path="/dipendenti" element={<EmployeesPage />} />
            <Route path="/assegnazioni" element={<AssignmentsPage />} />
            <Route path="/report" element={<ReportsPage />} />
            
            {/* Rotta Admin Protetta */}
            <Route element={<ProtectedRoute isAllowed={isAdminAuthenticated} redirectPath="/"/>}>
                <Route path="/admin" element={<AdminPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <footer className="bg-dark text-white text-center p-4 mt-auto">
          <p>&copy; {new Date().getFullYear()} SIAD GxP - Training Platform. Tutti i diritti riservati.</p>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;