import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Employee } from '../types';
import Modal from '../components/Modal';
import { FaUserPlus, FaHistory, FaPlus } from 'react-icons/fa';

const EmployeesPage: React.FC = () => {
  const { 
    getSedeEmployees, addEmployee, updateEmployeeRole, 
    currentSede, currentYear, yearlySedeData 
  } = useData();
  
  const employees = getSedeEmployees(); // Gets employees for currentSede & currentYear
  const isDataEffectivelyLoaded = currentSede && currentYear && 
                                  yearlySedeData[currentYear] && yearlySedeData[currentYear][currentSede] &&
                                  (yearlySedeData[currentYear][currentSede].employees.length > 0 || 
                                   yearlySedeData[currentYear][currentSede].courses.length > 0 || 
                                   yearlySedeData[currentYear][currentSede].assignments.length > 0);


  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [newEmployeeData, setNewEmployeeData] = useState({ name: '', initialRole: '', initialRoleStartDate: new Date().toISOString().split('T')[0] });
  const [newRoleData, setNewRoleData] = useState({ role: '', startDate: new Date().toISOString().split('T')[0] });

  const handleOpenEmployeeModal = (employee?: Employee) => {
    if (employee) {
      setSelectedEmployee(employee);
    } else {
      if (!currentSede || !currentYear || !isDataEffectivelyLoaded) {
        alert("Seleziona sede e anno, poi carica i dati CSV (almeno dipendenti) da Admin prima di aggiungere.");
        return;
      }
      setNewEmployeeData({ name: '', initialRole: '', initialRoleStartDate: new Date().toISOString().split('T')[0] });
      setSelectedEmployee(null); 
    }
    setIsEmployeeModalOpen(true);
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmployeeData.name && newEmployeeData.initialRole && newEmployeeData.initialRoleStartDate) {
      addEmployee({
        name: newEmployeeData.name,
        currentRole: newEmployeeData.initialRole,
        initialRole: newEmployeeData.initialRole,
        initialRoleStartDate: newEmployeeData.initialRoleStartDate,
      });
      setIsEmployeeModalOpen(false);
    } else {
      alert("Per favore, compila tutti i campi.");
    }
  };

  const handleOpenRoleModal = (employee: Employee) => {
    if (!currentSede || !currentYear || !isDataEffectivelyLoaded) {
        alert("Dati sede/anno non caricati. Vai in Admin > Gestione Dati CSV.");
        return;
    }
    setSelectedEmployee(employee);
    setNewRoleData({ role: '', startDate: new Date().toISOString().split('T')[0] });
    setIsRoleModalOpen(true);
  };

  const handleAddRoleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee && newRoleData.role && newRoleData.startDate) {
      updateEmployeeRole(selectedEmployee.id, newRoleData.role, newRoleData.startDate);
      setIsRoleModalOpen(false);
      setSelectedEmployee(prev => prev ? {...prev, currentRole: newRoleData.role, roleHistory: [...prev.roleHistory.map(rh => rh.endDate === null ? {...rh, endDate: newRoleData.startDate} : rh), {role: newRoleData.role, startDate: newRoleData.startDate, endDate: null}]} : null );
    } else {
      alert("Per favore, compila tutti i campi per il cambio ruolo.");
    }
  };
  
  if (!currentSede || !currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-gray-600">Seleziona Sede e Anno dalla barra di navigazione.</p></div>;
  }
   if (!isDataEffectivelyLoaded && currentSede && currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-yellow-700">Dati per {currentSede}/{currentYear} non caricati. Vai su Admin &gt; Gestione Dati CSV.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestione Dipendenti - {currentSede} / {currentYear}</h1>
        <p className="text-xs text-gray-500 mt-1">
          Per caricare dipendenti, vai su Admin &gt; Gestione Dati CSV (per sede/anno correnti). <br/>
          Modifiche attiveranno download di <code>{currentSede}_{currentYear}_dipendenti.csv</code>. Salvalo manualmente.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-700">Elenco Dipendenti</h2>
          <button
            onClick={() => handleOpenEmployeeModal()}
            className="bg-primary hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <FaUserPlus className="mr-2" /> Aggiungi Dipendente
          </button>
        </div>
        {employees.length === 0 && isDataEffectivelyLoaded && (
            <p className="text-center text-gray-500 text-lg py-8">Nessun dipendente caricato per {currentSede}/{currentYear}.</p>
        )}
        {employees.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo Corrente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map(employee => (
                  <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.currentRole}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => { handleOpenEmployeeModal(employee);}} className="text-info hover:text-blue-700" title="Visualizza Dettagli/Storico Ruoli"><FaHistory /></button>
                      <button onClick={() => handleOpenRoleModal(employee)} className="text-success hover:text-green-700" title="Aggiungi Cambio Ruolo"><FaPlus /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isEmployeeModalOpen} onClose={() => { setIsEmployeeModalOpen(false); setSelectedEmployee(null);}} title={selectedEmployee ? `Dettagli Dipendente: ${selectedEmployee.name}` : "Aggiungi Nuovo Dipendente"}>
        {selectedEmployee ? (
            <div>
                <p><strong>ID:</strong> {selectedEmployee.id}</p>
                <p><strong>Nome:</strong> {selectedEmployee.name}</p>
                <p><strong>Ruolo Attuale:</strong> {selectedEmployee.currentRole}</p>
                <h4 className="font-semibold mt-4 mb-2">Storico Ruoli:</h4>
                {selectedEmployee.roleHistory.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 max-h-60 overflow-y-auto">
                        {selectedEmployee.roleHistory.slice().sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map((role, index) => (
                            <li key={index} className="text-sm">
                                <strong>{role.role}</strong>
                                <br/>
                                <span className="text-xs text-gray-600">
                                    Dal: {new Date(role.startDate).toLocaleDateString('it-IT')}
                                    {role.endDate ? ` Al: ${new Date(role.endDate).toLocaleDateString('it-IT')}` : ' (Corrente)'}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-gray-500">Nessuno storico ruoli disponibile.</p>}
                 <div className="flex justify-end pt-4">
                    <button type="button" onClick={() => { setIsEmployeeModalOpen(false); setSelectedEmployee(null);}} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Chiudi</button>
                </div>
            </div>
        ) : (
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome Completo</label>
              <input type="text" name="name" id="name" value={newEmployeeData.name} onChange={(e) => setNewEmployeeData({...newEmployeeData, name: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
            <div>
              <label htmlFor="initialRole" className="block text-sm font-medium text-gray-700">Ruolo Iniziale</label>
              <input type="text" name="initialRole" id="initialRole" value={newEmployeeData.initialRole} onChange={(e) => setNewEmployeeData({...newEmployeeData, initialRole: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
            <div>
              <label htmlFor="initialRoleStartDate" className="block text-sm font-medium text-gray-700">Data Inizio Ruolo (YYYY-MM-DD)</label>
              <input type="date" name="initialRoleStartDate" id="initialRoleStartDate" value={newEmployeeData.initialRoleStartDate} onChange={(e) => setNewEmployeeData({...newEmployeeData, initialRoleStartDate: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setIsEmployeeModalOpen(false); setSelectedEmployee(null);}} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Annulla</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-green-700 rounded-md">Aggiungi Dipendente</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isRoleModalOpen} onClose={() => { setIsRoleModalOpen(false); setSelectedEmployee(null);}} title={`Cambio Ruolo per ${selectedEmployee?.name}`}>
        {selectedEmployee && (
          <form onSubmit={handleAddRoleChange} className="space-y-4">
            <div>
              <label htmlFor="newRole" className="block text-sm font-medium text-gray-700">Nuovo Ruolo</label>
              <input type="text" name="newRole" id="newRole" value={newRoleData.role} onChange={(e) => setNewRoleData({...newRoleData, role: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Data Inizio Nuovo Ruolo (YYYY-MM-DD)</label>
              <input type="date" name="startDate" id="startDate" value={newRoleData.startDate} onChange={(e) => setNewRoleData({...newRoleData, startDate: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
             <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setIsRoleModalOpen(false); setSelectedEmployee(null);}} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Annulla</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-green-700 rounded-md">Salva Cambio Ruolo</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default EmployeesPage;