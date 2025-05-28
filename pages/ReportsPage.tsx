import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { TrainingAssignment, AssignmentStatus, Employee, TrainingCourse, PlanRecord, PlanApproval, TrainingCourseStatus, KeyPersonnelRole } from '../types';
import { FaPrint, FaUserGraduate, FaBookOpen, FaCalendarCheck, FaTasks, FaFilePdf, FaFilter } from 'react-icons/fa'; 

const ReportsPage: React.FC = () => {
  const { 
    getSedeAssignments, getSedeEmployees, getSedeCourses, getSedePlanRecord,
    getEmployeeById, getCourseById,
    currentSedeId, currentYear, sedi, availableYears: getContextAvailableYears 
  } = useData();
  
  const assignments = getSedeAssignments(); 
  const allEmployeesForSede = getSedeEmployees();     
  const allCoursesForSede = getSedeCourses();
  const planRecord = getSedePlanRecord();         

  const currentSedeObject = useMemo(() => sedi.find(s => s.id === currentSedeId), [sedi, currentSedeId]);
  const currentSedeName = currentSedeObject?.name;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedReportYear, setSelectedReportYear] = useState<number | null>(currentYear);

  useEffect(() => {
    // Ensure selectedReportYear is synced with currentYear from context if available
    if (currentYear && selectedReportYear !== currentYear) {
        setSelectedReportYear(currentYear);
    } else if (!currentYear && getContextAvailableYears().length > 0 && selectedReportYear !== getContextAvailableYears()[0]) {
        // Default to the latest available year if currentYear is not set but others are
        setSelectedReportYear(getContextAvailableYears()[0]);
    }
  }, [currentYear, getContextAvailableYears, selectedReportYear]);
  
  const reportYearOptions = useMemo(() => 
      getContextAvailableYears().map(y => ({ value: y, label: y.toString() }))
  , [getContextAvailableYears]);


  // Data for Annual Plan Report (already filtered by currentSedeId/currentYear by context getters)
  const annualPlanCourses = allCoursesForSede;
  const annualPlanApprovals = planRecord?.approvals?.sort((a,b) => new Date(b.approval_date).getTime() - new Date(a.approval_date).getTime()) || [];
  const annualPlanStatus = planRecord?.status;

  // Data for Employee Training Record Report
  const employeeTrainingRecords = useMemo(() => {
    if (!selectedEmployeeId) return [];
    return assignments
      .filter(a => a.employee_id === selectedEmployeeId && a.year === selectedReportYear)
      .map(a => {
        const course = getCourseById(a.course_id);
        return { ...a, courseName: course?.name || 'N/D', courseDetails: course };
      })
      .sort((a,b) => new Date(b.assignmentDate).getTime() - new Date(a.assignmentDate).getTime());
  }, [selectedEmployeeId, assignments, getCourseById, selectedReportYear]);

  // Data for Course Attendance Report
  const courseAttendanceRecords = useMemo(() => {
    if (!selectedCourseId) return [];
    return assignments
      .filter(a => a.course_id === selectedCourseId && a.year === selectedReportYear)
      .map(a => {
        const employee = getEmployeeById(a.employee_id);
        return { ...a, employeeName: employee?.name || 'N/D', employeeRole: employee?.currentRole || 'N/D' };
      })
      .sort((a,b) => (a.employeeName || "").localeCompare(b.employeeName || ""));
  }, [selectedCourseId, assignments, getEmployeeById, selectedReportYear]);
  
  const selectedCourseDetailsForReport = useMemo(() => getCourseById(selectedCourseId), [selectedCourseId, getCourseById]);


  const handlePrint = () => {
    const printContents = document.getElementById('printable-report-area')?.innerHTML;
    const originalContents = document.body.innerHTML;
    if (printContents) {
      document.body.innerHTML = `
        <html>
          <head>
            <title>Report Formazione SIAD GxP</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em;}
              th { background-color: #f2f2f2; }
              h1, h2, h3 { color: #2E8540; margin-bottom:10px; }
              .no-print { display: none; }
              .report-header { margin-bottom: 30px; text-align: center; }
              .report-section { margin-bottom: 40px; page-break-inside: avoid; }
            </style>
          </head>
          <body>
            <div class="report-header">
              <img src="/logo.png" alt="SIAD Logo" style="height: 40px; margin-bottom: 10px;" />
              <h1>Report Formazione SIAD GxP</h1>
            </div>
            ${printContents}
          </body>
        </html>
      `;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); // To re-attach event listeners and React components
    }
  };

  if (!currentSedeId || !currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-gray-600">Seleziona Sede e Anno dalla barra di navigazione per visualizzare i report.</p></div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Reportistica Formazione</h1>
            <p className="text-sm text-gray-600">Sede: {currentSedeName || currentSedeId} - Anno di riferimento per i dati: {currentYear}</p>
        </div>
        <button 
            onClick={handlePrint}
            className="btn-primary bg-primary hover:bg-green-700 flex items-center no-print"
        >
            <FaPrint className="mr-2"/> Stampa Report Visualizzati
        </button>
      </div>
      
      {/* Filters for Employee and Course specific reports */}
      <div className="bg-white p-6 rounded-lg shadow-md space-y-4 no-print">
          <h2 className="text-xl font-semibold text-gray-700 flex items-center"><FaFilter className="mr-2 text-primary"/> Filtri Specifici per Report</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label htmlFor="reportEmployeeFilter" className="block text-sm font-medium text-gray-700">Dipendente (per Report Dipendente):</label>
                <select id="reportEmployeeFilter" name="selectedEmployeeId" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="input-field bg-white">
                    <option value="">-- Seleziona Dipendente --</option>
                    {allEmployeesForSede.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="reportCourseFilter" className="block text-sm font-medium text-gray-700">Corso (per Report Corso):</label>
                <select id="reportCourseFilter" name="selectedCourseId" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="input-field bg-white">
                    <option value="">-- Seleziona Corso --</option>
                    {allCoursesForSede.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="reportYearFilter" className="block text-sm font-medium text-gray-700">Anno (per Report Dipendente/Corso):</label>
                <select 
                    id="reportYearFilter" 
                    name="selectedReportYear" 
                    value={selectedReportYear || ''} 
                    onChange={(e) => setSelectedReportYear(e.target.value ? parseInt(e.target.value) : null)} 
                    className="input-field bg-white"
                >
                    <option value="">-- Seleziona Anno --</option>
                    {reportYearOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
          </div>
      </div>

      <div id="printable-report-area">
        {/* 1. Report Piano Annuale */}
        <section className="bg-white p-6 rounded-lg shadow-md report-section">
          <h2 className="text-2xl font-bold text-primary mb-4">Report Piano Annuale Formazione</h2>
          <p className="mb-1"><strong>Sede:</strong> {currentSedeName || 'N/D'}</p>
          <p className="mb-1"><strong>Anno di Riferimento:</strong> {currentYear || 'N/D'}</p>
          <p className="mb-1"><strong>Stato Piano:</strong> <span className="font-semibold">{annualPlanStatus || 'Non Definito'}</span></p>
          {planRecord?.created_by_name && <p className="mb-1 text-sm"><strong>Redatto da:</strong> {planRecord.created_by_name}</p>}
          {planRecord?.last_modified_by_name && <p className="mb-3 text-sm"><strong>Ultima modifica da:</strong> {planRecord.last_modified_by_name} il {planRecord.last_modified_at ? new Date(planRecord.last_modified_at).toLocaleString('it-IT') : 'N/D'}</p>}


          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Corsi Programmati:</h3>
          {annualPlanCourses.length > 0 ? (
            <table className="min-w-full report-table">
              <thead>
                <tr>
                  <th>Nome Corso</th><th>Tipo</th><th>Periodo Prev.</th><th>Durata (ore)</th><th>Formatore/i</th><th>Area GxP</th><th>Stato Corso</th>
                </tr>
              </thead>
              <tbody>
                {annualPlanCourses.map(course => (
                  <tr key={course.id}>
                    <td>{course.name}</td>
                    <td>{course.training_type || '-'}</td>
                    <td>{course.planned_period || new Date(course.date).toLocaleDateString('it-IT')}</td>
                    <td>{course.durationHours}</td>
                    <td>{course.trainer_info || '-'}</td>
                    <td>{course.gxp_area || '-'}</td>
                    <td>{course.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>Nessun corso programmato per questa sede/anno.</p>}

          <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Approvazioni Piano:</h3>
          {annualPlanApprovals.length > 0 ? (
            <table className="min-w-full report-table">
              <thead><tr><th>Approvatore</th><th>Ruolo</th><th>Decisione</th><th>Data</th><th>Commento</th></tr></thead>
              <tbody>
                {annualPlanApprovals.map(app => (
                  <tr key={app.id}>
                    <td>{app.approver_name}</td>
                    <td>{app.approver_role}</td>
                    <td className={app.approval_status === 'Rigettato' ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>{app.approval_status}</td>
                    <td>{new Date(app.approval_date).toLocaleString('it-IT')}</td>
                    <td>{app.approval_comment || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>Nessuna approvazione registrata per questo piano.</p>}
          
          {/* TODO: Ore totali svolte vs preventivate (richiede aggregazione da assignments) */}
          <p className="mt-4 text-sm"><i>(Dettaglio ore totali e personale coinvolto per corso da implementare)</i></p>
        </section>

        {/* 2. Report Formazione Dipendente */}
        {selectedEmployeeId && selectedReportYear && (
          <section className="bg-white p-6 rounded-lg shadow-md mt-8 report-section">
            <h2 className="text-2xl font-bold text-primary mb-4">Report Formazione Dipendente</h2>
            <p className="mb-1"><strong>Dipendente:</strong> {getEmployeeById(selectedEmployeeId)?.name || 'N/D'}</p>
            <p className="mb-3"><strong>Anno di Riferimento Selezionato:</strong> {selectedReportYear}</p>
            {employeeTrainingRecords.length > 0 ? (
              <table className="min-w-full report-table">
                <thead><tr><th>Corso</th><th>Data Ass.</th><th>Stato</th><th>Data Compl.</th><th>Tipo Form.</th><th>Formatore</th><th>Durata</th></tr></thead>
                <tbody>
                  {employeeTrainingRecords.map(record => (
                    <tr key={record.id}>
                      <td>{record.courseName}</td>
                      <td>{new Date(record.assignmentDate).toLocaleDateString('it-IT')}</td>
                      <td>{record.completionStatus}</td>
                      <td>{record.completionDate ? new Date(record.completionDate).toLocaleDateString('it-IT') : '-'}</td>
                      <td>{record.courseDetails?.training_type || '-'}</td>
                      <td>{record.courseDetails?.trainer_info || '-'}</td>
                      <td>{record.courseDetails?.durationHours || '-'} ore</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>Nessun corso trovato per questo dipendente nel periodo selezionato ({selectedReportYear}).</p>}
          </section>
        )}

        {/* 3. Report Partecipazione Corso */}
        {selectedCourseId && selectedReportYear && (
          <section className="bg-white p-6 rounded-lg shadow-md mt-8 report-section">
            <h2 className="text-2xl font-bold text-primary mb-4">Report Partecipazione Corso</h2>
            <p className="mb-1"><strong>Corso:</strong> {selectedCourseDetailsForReport?.name || 'N/D'}</p>
            <p className="mb-1"><strong>Tipo:</strong> {selectedCourseDetailsForReport?.training_type || '-'}</p>
            <p className="mb-1"><strong>Data Prevista:</strong> {selectedCourseDetailsForReport ? new Date(selectedCourseDetailsForReport.date).toLocaleDateString('it-IT') : '-'}</p>
            <p className="mb-3"><strong>Anno di Riferimento Selezionato:</strong> {selectedReportYear}</p>
            
            {courseAttendanceRecords.length > 0 ? (
              <table className="min-w-full report-table">
                <thead><tr><th>Nome Dipendente</th><th>Ruolo Dipendente</th><th>Stato Ass.</th><th>Data Completamento</th></tr></thead>
                <tbody>
                  {courseAttendanceRecords.map(record => (
                    <tr key={record.id}>
                      <td>{record.employeeName}</td>
                      <td>{record.employeeRole}</td>
                      <td>{record.completionStatus}</td>
                      <td>{record.completionDate ? new Date(record.completionDate).toLocaleDateString('it-IT') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>Nessun dipendente ha partecipato a questo corso nel periodo selezionato ({selectedReportYear}).</p>}
          </section>
        )}
      </div>
      <style>{`
        .input-field { @apply mt-1 block w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-gray-900 bg-white; }
        .btn-primary { @apply px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-green-700 rounded-md transition-colors; }
        .report-table th, .report-table td { border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; font-size: 0.875rem; }
        .report-table th { background-color: #f7fafc; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};

export default ReportsPage;