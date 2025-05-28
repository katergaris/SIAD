import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { TrainingAssignment, AssignmentStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FaUserGraduate, FaBookOpen, FaCalendarCheck, FaTasks } from 'react-icons/fa'; 

const ReportsPage: React.FC = () => {
  const { 
    getSedeAssignments, getSedeEmployees, getSedeCourses, 
    getEmployeeById, getCourseById,
    currentSede, currentYear, availableYears: getContextAvailableYears // Use getContextAvailableYears
  } = useData();
  
  const assignments = getSedeAssignments(); // For currentSede & currentYear
  const employees = getSedeEmployees();     // For currentSede & currentYear
  const courses = getSedeCourses();         // For currentSede & currentYear

  // Filter year options based on years with actual data from context, or currentYear if selected
  const reportYearOptions = useMemo(() => {
    const contextYears = getContextAvailableYears();
    if (currentYear && !contextYears.includes(currentYear)) {
      return [currentYear, ...contextYears].sort((a,b) => b-a);
    }
    return contextYears;
  }, [getContextAvailableYears, currentYear]);


  const [filters, setFilters] = useState({ 
    employeeId: '', 
    courseId: '', 
    year: currentYear ? currentYear.toString() : (reportYearOptions.length > 0 ? reportYearOptions[0].toString() : '') 
  });
  
  // Sync filter year with global currentYear if it changes
  React.useEffect(() => {
    if (currentYear) {
        setFilters(f => ({...f, year: currentYear.toString()}));
    } else if (reportYearOptions.length > 0 && !filters.year) {
        setFilters(f => ({...f, year: reportYearOptions[0].toString()}));
    }
  }, [currentYear, reportYearOptions, filters.year]);


  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };


  const filteredAssignments = useMemo(() => {
    // Note: assignments from getSedeAssignments are already filtered by currentYear implicitly by the context
    return assignments.filter(assignment => {
      // const assignmentYear = new Date(assignment.assignmentDate).getFullYear().toString();
      return (
        (filters.employeeId === '' || assignment.employeeId === filters.employeeId) &&
        (filters.courseId === '' || assignment.courseId === filters.courseId) 
        // Year filter is now implicitly handled by how 'assignments' are fetched if 'filters.year' aligns with 'currentYear'
        // If we want to allow reports to look at OTHER years than currentYear, this logic needs adjustment
        // For now, assume 'assignments' are for 'currentYear' and 'filters.year' is mainly for display or if we expand this.
      );
    });
  }, [assignments, filters.employeeId, filters.courseId]); // Removed filters.year as assignments are already for currentYear

  const assignmentsByCourse = useMemo(() => {
    const counts: { [courseName: string]: number } = {};
    filteredAssignments.forEach(assignment => {
      const course = getCourseById(assignment.courseId);
      if (course) {
        counts[course.name] = (counts[course.name] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]): {name: string, value: number} => ({ name, value }));
  }, [filteredAssignments, getCourseById]);

  const assignmentsByStatus = useMemo(() => {
    const counts: { [status: string]: number } = {};
    Object.values(AssignmentStatus).forEach(s => counts[s] = 0); 
    filteredAssignments.forEach(assignment => {
      counts[assignment.completionStatus] = (counts[assignment.completionStatus] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]): {name: string, value: number} => ({ name, value }))
      .filter(item => item.value > 0 || filters.employeeId || filters.courseId || filters.year); 
  }, [filteredAssignments, filters]);
  
  // Theme colors for Pie Chart
  const COLORS: { [key in AssignmentStatus]: string } = {
    [AssignmentStatus.COMPLETED]: '#2E8540', // primary (SIAD Green)
    [AssignmentStatus.IN_PROGRESS]: '#ffc107', // warning
    [AssignmentStatus.NOT_STARTED]: '#6c757d', // secondary
    [AssignmentStatus.FAILED]: '#dc3545', // danger
  };

  const totalAssignments = filteredAssignments.length;
  const completedAssignments = filteredAssignments.filter(a => a.completionStatus === AssignmentStatus.COMPLETED).length;
  const completionRate = totalAssignments > 0 ? ((completedAssignments / totalAssignments) * 100).toFixed(1) : "0.0";

  if (!currentSede || !currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-gray-600">Seleziona Sede e Anno dalla barra di navigazione per visualizzare i report.</p></div>;
  }


  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Reportistica Formazione - {currentSede} / {filters.year || currentYear}</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select name="employeeId" value={filters.employeeId} onChange={handleFilterChange} className="p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary bg-white">
            <option value="">Tutti i Dipendenti</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <select name="courseId" value={filters.courseId} onChange={handleFilterChange} className="p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary bg-white">
            <option value="">Tutti i Corsi</option>
            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <select name="year" value={filters.year} onChange={handleFilterChange} className="p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary bg-white">
            <option value="">Anno Corrente ({currentYear})</option> 
            {reportYearOptions.map(y => <option key={y} value={y.toString()}>{y.toString()}</option>)}
          </select>
            <p className="text-xs text-gray-500 md:col-span-3 mt-1">
                I dati visualizzati sono sempre relativi all'anno selezionato globalmente ({currentYear}). Il filtro "Anno" qui sopra è per affinare ulteriormente se la logica di recupero dati fosse estesa.
            </p>
        </div>
      </div>

      {assignments.length === 0 && (
         <p className="text-center text-gray-500 text-lg py-8 bg-white rounded-lg shadow-md">Nessun dato di assegnazione per {currentSede}/{currentYear}. Carica i CSV da Admin.</p>
      )}

      {assignments.length > 0 && filteredAssignments.length === 0 && (
         <p className="text-center text-gray-500 text-lg py-8 bg-white rounded-lg shadow-md">Nessuna assegnazione per {currentSede}/{currentYear} corrisponde ai filtri.</p>
      )}

      {filteredAssignments.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <FaTasks className="text-4xl text-primary mx-auto mb-2" />
              <h3 className="text-xl font-semibold text-gray-700">Assegnazioni Totali</h3>
              <p className="text-3xl font-bold text-primary">{totalAssignments}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <FaUserGraduate className="text-4xl text-success mx-auto mb-2" />
              <h3 className="text-xl font-semibold text-gray-700">Completate</h3>
              <p className="text-3xl font-bold text-success">{completedAssignments}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <FaCalendarCheck className="text-4xl text-info mx-auto mb-2" />
              <h3 className="text-xl font-semibold text-gray-700">Tasso Completamento</h3>
              <p className="text-3xl font-bold text-info">{completionRate}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Assegnazioni per Corso</h2>
              {assignmentsByCourse.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={assignmentsByCourse} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={70} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#2E8540" name="Numero Assegnazioni" /> {/* Use primary color */}
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-center py-10">Nessun dato per questo grafico con i filtri attuali.</p>}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Distribuzione Stati Assegnazione</h2>
              {assignmentsByStatus.some(s => s.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={assignmentsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8" // Default fill, overridden by Cell
                      dataKey="value"
                    >
                      {assignmentsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as AssignmentStatus] || '#CCCCCC'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-center py-10">Nessun dato per questo grafico con i filtri attuali.</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Dettaglio Assegnazioni Filtrate ({currentSede} / {currentYear})</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dipendente</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corso</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Assegn.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Compl.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAssignments.map(assign => {
                  const employee = getEmployeeById(assign.employeeId);
                  const course = getCourseById(assign.courseId);
                  return (
                    <tr key={assign.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{employee?.name || 'N/D'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{course?.name || 'N/D'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(assign.assignmentDate).toLocaleDateString('it-IT')}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            assign.completionStatus === AssignmentStatus.COMPLETED ? 'bg-green-100 text-green-800' :
                            assign.completionStatus === AssignmentStatus.IN_PROGRESS ? 'bg-yellow-100 text-yellow-800' :
                            assign.completionStatus === AssignmentStatus.FAILED ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'}`}>
                            {assign.completionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{assign.completionDate ? new Date(assign.completionDate).toLocaleDateString('it-IT') : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;