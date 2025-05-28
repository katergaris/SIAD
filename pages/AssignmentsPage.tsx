import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { TrainingAssignment, AssignmentStatus } from '../types';
import Modal from '../components/Modal';
import { FaPlusCircle, FaEdit, FaFilter } from 'react-icons/fa';

const AssignmentsPage: React.FC = () => {
  const { 
    getSedeAssignments, 
    getSedeEmployees, 
    getSedeCourses, 
    addAssignment, 
    updateAssignmentStatus, 
    getEmployeeById, 
    getCourseById,
    currentSedeId, currentYear, yearlySedeData, sedi
  } = useData();
  
  const assignments = getSedeAssignments(); // For currentSedeId & currentYear
  const employees = getSedeEmployees();     // For currentSedeId & currentYear
  const courses = getSedeCourses();         // For currentSedeId & currentYear

  const currentSedeObject = useMemo(() => sedi.find(s => s.id === currentSedeId), [sedi, currentSedeId]);
  const currentSedeName = currentSedeObject?.name;

  const isDataEffectivelyLoaded = currentSedeName && currentYear && 
                                  yearlySedeData[currentYear] && yearlySedeData[currentYear][currentSedeName] &&
                                  (yearlySedeData[currentYear][currentSedeName].employees.length > 0 || 
                                   yearlySedeData[currentYear][currentSedeName].courses.length > 0 || 
                                   yearlySedeData[currentYear][currentSedeName].assignments.length > 0);


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<Partial<TrainingAssignment> & { isEditing?: boolean }>({});
  const [filters, setFilters] = useState({ employee_id: '', course_id: '', status: '' });

  const handleOpenModal = (assignmentToEdit?: TrainingAssignment) => {
    if (!currentSedeId || !currentYear || !isDataEffectivelyLoaded) {
        alert("Seleziona sede/anno e carica i dati da Supabase prima di gestire le assegnazioni.");
        return;
    }
    if (employees.length === 0 || courses.length === 0) {
        alert("Devi avere dipendenti e corsi caricati per questa sede/anno per creare assegnazioni.");
        return;
    }

    if (assignmentToEdit) {
      setCurrentAssignment({ ...assignmentToEdit, isEditing: true });
    } else {
      setCurrentAssignment({
        employee_id: employees[0]?.id || '', 
        course_id: courses[0]?.id || '',    
        assignmentDate: new Date().toISOString().split('T')[0],
        completionStatus: AssignmentStatus.NOT_STARTED,
        isEditing: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentAssignment(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAssignment.employee_id || !currentAssignment.course_id || !currentAssignment.assignmentDate || !currentAssignment.completionStatus) {
      alert("Per favore, compila tutti i campi obbligatori.");
      return;
    }

    if (currentAssignment.isEditing && currentAssignment.id) {
      await updateAssignmentStatus(
        currentAssignment.id, 
        currentAssignment.completionStatus as AssignmentStatus, 
        currentAssignment.completionDate || undefined, 
        currentAssignment.score !== undefined && currentAssignment.score !== null ? Number(currentAssignment.score) : undefined
      );
    } else {
      await addAssignment({
        employee_id: currentAssignment.employee_id!,
        course_id: currentAssignment.course_id!,
        assignmentDate: currentAssignment.assignmentDate!,
        completionStatus: currentAssignment.completionStatus as AssignmentStatus,
        completionDate: null,
        score: null,
      });
    }
    setIsModalOpen(false);
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredAssignments = useMemo(() => {
    return assignments.filter(assignment => 
      (filters.employee_id === '' || assignment.employee_id === filters.employee_id) &&
      (filters.course_id === '' || assignment.course_id === filters.course_id) &&
      (filters.status === '' || assignment.completionStatus === filters.status)
    );
  }, [assignments, filters]);

  const getStatusColor = (status: AssignmentStatus) => {
    switch (status) {
      case AssignmentStatus.COMPLETED: return 'bg-green-100 text-green-800';
      case AssignmentStatus.IN_PROGRESS: return 'bg-yellow-100 text-yellow-800';
      case AssignmentStatus.NOT_STARTED: return 'bg-gray-100 text-gray-800';
      case AssignmentStatus.FAILED: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!currentSedeId || !currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-gray-600">Seleziona Sede e Anno dalla barra di navigazione.</p></div>;
  }
  if (!isDataEffectivelyLoaded && currentSedeId && currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-yellow-700">Dati per {currentSedeName || currentSedeId}/{currentYear} non caricati. Assicurati che siano presenti in Supabase e che la connessione sia attiva per il caricamento automatico.</p></div>;
  }


  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-3xl font-bold text-gray-800">Assegnazioni Corsi - {currentSedeName || currentSedeId} / {currentYear}</h1>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            disabled={employees.length === 0 || courses.length === 0}
          >
            <FaPlusCircle className="mr-2" /> Nuova Assegnazione
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
            Le modifiche vengono salvate direttamente nel database Supabase.
        </p>
        {(employees.length === 0 || courses.length === 0) && isDataEffectivelyLoaded && (
          <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md mt-3">
            Per creare assegnazioni, assicurati di aver caricato dipendenti e corsi per {currentSedeName || currentSedeId}/{currentYear}.
          </p>
        )}
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center"><FaFilter className="mr-2 text-primary" /> Filtra Assegnazioni</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select name="employee_id" value={filters.employee_id} onChange={handleFilterChange} className="p-3 border border-gray-400 rounded-lg focus:ring-primary focus:border-primary bg-white">
            <option value="">Tutti i Dipendenti</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <select name="course_id" value={filters.course_id} onChange={handleFilterChange} className="p-3 border border-gray-400 rounded-lg focus:ring-primary focus:border-primary bg-white">
            <option value="">Tutti i Corsi</option>
            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <select name="status" value={filters.status} onChange={handleFilterChange} className="p-3 border border-gray-400 rounded-lg focus:ring-primary focus:border-primary bg-white">
            <option value="">Tutti gli Stati</option>
            {Object.values(AssignmentStatus).map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </div>

      {filteredAssignments.length === 0 && assignments.length > 0 && (
         <p className="text-center text-gray-500 text-lg">Nessuna assegnazione corrisponde ai filtri.</p>
      )}
      {assignments.length === 0 && isDataEffectivelyLoaded && (
          <p className="text-center text-gray-500 text-lg py-8">Nessuna assegnazione creata per {currentSedeName || currentSedeId}/{currentYear}.</p>
      )}

      {filteredAssignments.length > 0 && (
        <div className="bg-white p-2 rounded-lg shadow-md overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dipendente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Assegnazione</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Completamento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punteggio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssignments.map(assign => {
                const employee = getEmployeeById(assign.employee_id);
                const course = getCourseById(assign.course_id);
                return (
                  <tr key={assign.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee?.name || assign.employee_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course?.name || assign.course_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(assign.assignmentDate).toLocaleDateString('it-IT')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(assign.completionStatus)}`}>
                        {assign.completionStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assign.completionDate ? new Date(assign.completionDate).toLocaleDateString('it-IT') : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assign.score !== null ? assign.score : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleOpenModal(assign)} className="text-primary hover:text-green-700"><FaEdit /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentAssignment.isEditing ? "Modifica Assegnazione" : "Nuova Assegnazione"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700">Dipendente</label>
            <select name="employee_id" id="employee_id" value={currentAssignment.employee_id || ''} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-gray-400 rounded-md shadow-sm bg-white focus:ring-primary focus:border-primary" disabled={currentAssignment.isEditing || employees.length === 0}>
              <option value="" disabled>{employees.length === 0 ? "Nessun dipendente" : "Seleziona Dipendente"}</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="course_id" className="block text-sm font-medium text-gray-700">Corso</label>
            <select name="course_id" id="course_id" value={currentAssignment.course_id || ''} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-gray-400 rounded-md shadow-sm bg-white focus:ring-primary focus:border-primary" disabled={currentAssignment.isEditing || courses.length === 0}>
              <option value="" disabled>{courses.length === 0 ? "Nessun corso" : "Seleziona Corso"}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="assignmentDate" className="block text-sm font-medium text-gray-700">Data Assegnazione (YYYY-MM-DD)</label>
            <input type="date" name="assignmentDate" id="assignmentDate" value={currentAssignment.assignmentDate || ''} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-gray-400 rounded-md shadow-sm focus:ring-primary focus:border-primary" disabled={currentAssignment.isEditing} />
          </div>
          <div>
            <label htmlFor="completionStatus" className="block text-sm font-medium text-gray-700">Stato Completamento</label>
            <select name="completionStatus" id="completionStatus" value={currentAssignment.completionStatus || ''} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-gray-400 rounded-md shadow-sm bg-white focus:ring-primary focus:border-primary">
              {Object.values(AssignmentStatus).map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          {currentAssignment.completionStatus === AssignmentStatus.COMPLETED && (
            <>
              <div>
                <label htmlFor="completionDate" className="block text-sm font-medium text-gray-700">Data Completamento (YYYY-MM-DD)</label>
                <input type="date" name="completionDate" id="completionDate" value={currentAssignment.completionDate || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-400 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
              </div>
              <div>
                <label htmlFor="score" className="block text-sm font-medium text-gray-700">Punteggio (opzionale)</label>
                <input type="number" name="score" id="score" value={currentAssignment.score === null || currentAssignment.score === undefined ? '' : currentAssignment.score} onChange={handleInputChange} min="0" max="100" className="mt-1 block w-full p-2 border border-gray-400 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
              </div>
            </>
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Annulla</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-green-700 rounded-md">{currentAssignment.isEditing ? "Salva Modifiche" : "Crea Assegnazione"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AssignmentsPage;
