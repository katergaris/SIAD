import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { TrainingCourse, TrainingCourseStatus, PlanStatus, PlanApproval } from '../types';
import { FaFilter, FaPlusCircle, FaEdit, FaTrash, FaCheckCircle, FaHourglassHalf, FaExclamationTriangle, FaUserCheck, FaInfoCircle } from 'react-icons/fa';
import Modal from '../components/Modal';

const PlanningPage: React.FC = () => {
  const { 
    getSedeCourses, addCourse, updateCourse, deleteCourse,
    currentSede, currentYear, yearlySedeData,
    getSedePlanStatus, getSedePlanApprovals,
    approveCourseByQP, currentKeyPersonnel,
    approveCurrentSedePlanByResponsabile
  } = useData();
  
  const courses = getSedeCourses(); // Gets courses for currentSede & currentYear
  const planStatus = getSedePlanStatus();
  const planApprovals = getSedePlanApprovals(); // Get the array of approvals
  
  const isDataEffectivelyLoaded = currentSede && currentYear && 
                                  yearlySedeData[currentYear] && yearlySedeData[currentYear][currentSede] &&
                                  (yearlySedeData[currentYear][currentSede].courses.length > 0 || 
                                   yearlySedeData[currentYear][currentSede].employees.length > 0 || 
                                   yearlySedeData[currentYear][currentSede].assignments.length > 0);


  const [filters, setFilters] = useState({ name: '', category: '', status: '' });
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Partial<TrainingCourse> & { isNew?: boolean } | null>(null);
  
  const [isQPModalOpen, setIsQPModalOpen] = useState(false);
  const [courseToApproveByQP, setCourseToApproveByQP] = useState<TrainingCourse | null>(null);
  const [qpPassword, setQpPassword] = useState('');

  const [isResponsabileModalOpen, setIsResponsabileModalOpen] = useState(false);
  const [responsabilePassword, setResponsabilePassword] = useState('');


  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      return (
        (filters.name === '' || course.name.toLowerCase().includes(filters.name.toLowerCase())) &&
        (filters.category === '' || course.category.toLowerCase().includes(filters.category.toLowerCase())) &&
        (filters.status === '' || course.status === filters.status)
      );
    });
  }, [courses, filters]);

  const openCourseModal = (course?: TrainingCourse) => {
    if (!currentSede || !currentYear || !isDataEffectivelyLoaded) {
        alert("Seleziona sede e anno, poi carica i dati CSV da Admin prima di aggiungere/modificare corsi.");
        return;
    }
    if (course) {
      setEditingCourse({ ...course, isNew: false });
    } else {
      setEditingCourse({ date: new Date().toISOString().split('T')[0], durationHours: 0, category: '', description: '', name: '', isNew: true });
    }
    setIsCourseModalOpen(true);
  };
  
  const handleSaveCourse = () => {
    if (editingCourse && editingCourse.name && editingCourse.date && editingCourse.durationHours !== undefined && editingCourse.category && editingCourse.description) {
        const courseDataToSave = {
            name: editingCourse.name,
            description: editingCourse.description,
            date: editingCourse.date,
            durationHours: editingCourse.durationHours,
            category: editingCourse.category,
        };
        if (editingCourse.isNew) {
            addCourse(courseDataToSave);
            // Alert about CSV download is handled by context
        } else if(editingCourse.id) {
            updateCourse(editingCourse.id, {
                ...courseDataToSave,
                status: editingCourse.status, 
                approvals: editingCourse.approvals,
            });
             // Alert about CSV download is handled by context
        }
      setIsCourseModalOpen(false);
      setEditingCourse(null);
    } else {
        alert("Per favore, compila tutti i campi obbligatori del corso.");
    }
  };
  
  const handleModalFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (editingCourse) {
        const { name, value } = e.target;
        setEditingCourse({
            ...editingCourse,
            [name]: name === 'durationHours' ? parseInt(value, 10) : value
        });
    }
  };

  const openQPApprovalModal = (course: TrainingCourse) => {
    if (!currentSede || !currentYear || !isDataEffectivelyLoaded) {
        alert("Dati sede/anno non caricati. Vai in Admin > Gestione Dati CSV.");
        return;
    }
    setCourseToApproveByQP(course);
    setQpPassword('');
    setIsQPModalOpen(true);
  };

  const handleQPApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (courseToApproveByQP && currentKeyPersonnel && currentKeyPersonnel.role === 'QP') {
      if (approveCourseByQP(courseToApproveByQP.id, currentKeyPersonnel.id, qpPassword)) {
        setIsQPModalOpen(false);
        setCourseToApproveByQP(null);
      }
    } else {
      alert("Devi essere loggato come QP per approvare.");
    }
  };

  const openResponsabileApprovalModal = () => {
     if (!currentSede || !currentYear || !isDataEffectivelyLoaded) {
        alert("Dati sede/anno non caricati. Vai in Admin > Gestione Dati CSV.");
        return;
    }
    setResponsabilePassword('');
    setIsResponsabileModalOpen(true);
  };

  const handleResponsabileApprovePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentKeyPersonnel && currentKeyPersonnel.role === 'Responsabile') {
      if (approveCurrentSedePlanByResponsabile(currentKeyPersonnel.id, responsabilePassword)) {
        setIsResponsabileModalOpen(false);
      }
    } else {
      alert("Devi essere loggato come Responsabile per approvare il piano.");
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    if (!currentSede || !currentYear || !isDataEffectivelyLoaded) {
        alert("Dati sede/anno non caricati.");
        return;
    }
    deleteCourse(courseId); 
  };


  const getCourseStatusPill = (status: TrainingCourseStatus) => {
    switch (status) {
      case TrainingCourseStatus.BOZZA: return 'bg-gray-200 text-gray-700';
      case TrainingCourseStatus.APPROVATO_QP: return 'bg-yellow-200 text-yellow-800';
      case TrainingCourseStatus.PIANIFICATO: return 'bg-blue-100 text-blue-800'; // Consider using info color from theme
      case TrainingCourseStatus.COMPLETATO: return 'bg-green-100 text-green-800'; // success color from theme
      case TrainingCourseStatus.ANNULLATO: return 'bg-red-100 text-red-800'; // danger color from theme
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanStatusInfo = () => {
    const latestApproval = planApprovals && planApprovals.length > 0 ? planApprovals[planApprovals.length - 1] : null;
    switch (planStatus) {
        case PlanStatus.BOZZA: return { text: "Bozza", color: "bg-secondary", icon: <FaHourglassHalf/> }; // Use secondary from theme
        case PlanStatus.IN_APPROVAZIONE_RESPONSABILE: return { text: "In Approvazione Resp.", color: "bg-warning text-black", icon: <FaHourglassHalf/> }; // Use warning from theme
        case PlanStatus.APPROVATO: 
            const approver = latestApproval ? ` da ${latestApproval.responsabileName} il ${new Date(latestApproval.approvalDate).toLocaleDateString()}` : "";
            return { text: `Approvato${approver}`, color: "bg-success text-white", icon: <FaCheckCircle/> }; // Use success from theme
        case PlanStatus.OBSOLETO: return { text: "Obsoleto", color: "bg-danger text-white", icon: <FaExclamationTriangle/> }; // Use danger from theme
        default: return { text: "Sconosciuto", color: "bg-gray-300", icon: <FaHourglassHalf/> };
    }
  };
  const planStatusDisplay = getPlanStatusInfo();
  const canManageCourses = currentKeyPersonnel?.role === 'Admin';

  if (!currentSede || !currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-gray-600">Seleziona Sede e Anno dalla barra di navigazione.</p></div>;
  }
  if (!isDataEffectivelyLoaded && currentSede && currentYear) {
    return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-yellow-700">Dati per {currentSede}/{currentYear} non caricati. Vai su Admin &gt; Gestione Dati CSV.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Pianificazione Corsi - {currentSede} / {currentYear}</h1>
            <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 ${planStatusDisplay.color}`}>
                {planStatusDisplay.icon}
                <span>Stato Piano: {planStatusDisplay.text}</span>
            </div>
        </div>
         {currentKeyPersonnel?.role === 'Responsabile' && (planStatus === PlanStatus.BOZZA || planStatus === PlanStatus.IN_APPROVAZIONE_RESPONSABILE) && (
            <button 
                onClick={openResponsabileApprovalModal}
                className="mt-4 bg-success hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
                <FaUserCheck className="mr-2" /> Approva Piano Formativo ({currentYear})
            </button>
        )}
         <p className="text-xs text-gray-500 mt-2">
             Modifiche ai corsi attiveranno download di <code>{currentSede}_{currentYear}_corsi.csv</code>. <br/>
             Approvazione Piano attiverà download di <code>{currentSede}_{currentYear}_stato_piano.csv</code>. Salvare manualmente.
         </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h2 className="text-2xl font-semibold text-gray-700 flex items-center"><FaFilter className="mr-2 text-primary" /> Filtri Corsi</h2>
            {canManageCourses && (
                <button
                    onClick={() => openCourseModal()}
                    className="bg-primary hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
                >
                    <FaPlusCircle className="mr-2" /> Aggiungi Corso
                </button>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <input type="text" name="name" placeholder="Filtra per nome corso..." value={filters.name} onChange={handleFilterChange} className="p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" />
          <input type="text" name="category" placeholder="Filtra per categoria..." value={filters.category} onChange={handleFilterChange} className="p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" />
          <select name="status" value={filters.status} onChange={handleFilterChange} className="p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary bg-white">
            <option value="">Tutti gli stati</option>
            {Object.values(TrainingCourseStatus).map(status => ( <option key={status} value={status}>{status}</option> ))}
          </select>
        </div>
      </div>
      
      {filteredCourses.length === 0 && courses.length > 0 && ( <p className="text-center text-gray-500 text-lg">Nessun corso corrisponde ai filtri.</p> )}
      {courses.length === 0 && isDataEffectivelyLoaded && ( <p className="text-center text-gray-500 text-lg py-8">Nessun corso caricato per {currentSede}/{currentYear}.</p> )}

      {filteredCourses.length > 0 && (
        <div className="bg-white p-2 rounded-lg shadow-md overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="th-cell">Nome Corso</th>
                <th className="th-cell">Categoria</th>
                <th className="th-cell">Data</th>
                <th className="th-cell">Durata (ore)</th>
                <th className="th-cell">Stato</th>
                <th className="th-cell">Approvato da QP</th>
                <th className="th-cell">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCourses.map(course => (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="td-cell font-medium text-gray-900">{course.name}</td>
                  <td className="td-cell">{course.category}</td>
                  <td className="td-cell">{new Date(course.date).toLocaleDateString('it-IT')}</td>
                  <td className="td-cell">{course.durationHours}</td>
                  <td className="td-cell">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCourseStatusPill(course.status)}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="td-cell">
                    {course.approvals && course.approvals.length > 0 
                        ? course.approvals.map(app => `${app.qpName} il ${new Date(app.approvalDate).toLocaleDateString()}`).join(', ') 
                        : 'N/A'}
                  </td>
                  <td className="td-cell space-x-2">
                    {canManageCourses && (
                        <>
                        <button onClick={() => openCourseModal(course)} className="text-primary hover:text-green-700" title="Modifica Corso"><FaEdit /></button>
                        <button onClick={() => handleDeleteCourse(course.id)} className="text-danger hover:text-red-700" title="Elimina Corso"><FaTrash /></button>
                        </>
                    )}
                    {currentKeyPersonnel?.role === 'QP' && course.status === TrainingCourseStatus.BOZZA && (
                        <button onClick={() => openQPApprovalModal(course)} className="text-success hover:bg-green-700" title="Approva Corso (QP)"><FaCheckCircle /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} title={editingCourse?.isNew ? "Aggiungi Nuovo Corso" : "Modifica Corso"}>
        {editingCourse && (
            <form onSubmit={(e) => {e.preventDefault(); handleSaveCourse();}} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome Corso</label>
                    <input type="text" name="name" id="name" value={editingCourse.name || ''} onChange={handleModalFieldChange} required className="input-field" />
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrizione</label>
                    <textarea name="description" id="description" value={editingCourse.description || ''} onChange={handleModalFieldChange} required rows={3} className="input-field"></textarea>
                </div>
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">Categoria</label>
                    <input type="text" name="category" id="category" value={editingCourse.category || ''} onChange={handleModalFieldChange} required className="input-field" />
                </div>
                <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">Data (YYYY-MM-DD)</label>
                    <input type="date" name="date" id="date" value={editingCourse.date || ''} onChange={handleModalFieldChange} required className="input-field" />
                </div>
                <div>
                    <label htmlFor="durationHours" className="block text-sm font-medium text-gray-700">Durata (ore)</label>
                    <input type="number" name="durationHours" id="durationHours" value={editingCourse.durationHours || 0} onChange={handleModalFieldChange} required min="0" className="input-field" />
                </div>
                {canManageCourses && !editingCourse.isNew && (
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700">Stato Corso (Admin)</label>
                        <select name="status" id="status" value={editingCourse.status || ''} onChange={handleModalFieldChange} className="input-field bg-white">
                            {Object.values(TrainingCourseStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                )}
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={() => setIsCourseModalOpen(false)} className="btn-secondary">Annulla</button>
                    <button type="submit" className="btn-primary">{editingCourse?.isNew ? "Aggiungi Corso" : "Salva Modifiche"}</button>
                </div>
            </form>
        )}
      </Modal>

      <Modal isOpen={isQPModalOpen} onClose={() => setIsQPModalOpen(false)} title={`Approva Corso: ${courseToApproveByQP?.name}`}>
        {courseToApproveByQP && currentKeyPersonnel?.role === 'QP' && (
            <form onSubmit={handleQPApprove} className="space-y-4">
                <p>Stai per approvare il corso <strong>{courseToApproveByQP.name}</strong> per {currentSede}/{currentYear}.</p>
                <p>Inserisci la tua password QP ({currentKeyPersonnel.name}). Verrà scaricato il CSV corsi aggiornato.</p>
                <div>
                    <label htmlFor="qpPassword" className="block text-sm font-medium text-gray-700">Password QP</label>
                    <input type="password" id="qpPassword" value={qpPassword} onChange={(e) => setQpPassword(e.target.value)} required className="input-field" />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={() => setIsQPModalOpen(false)} className="btn-secondary">Annulla</button>
                    <button type="submit" className="btn-primary bg-success hover:bg-green-700">Approva Corso</button>
                </div>
            </form>
        )}
      </Modal>

       <Modal isOpen={isResponsabileModalOpen} onClose={() => setIsResponsabileModalOpen(false)} title={`Approva Piano Sede: ${currentSede} / ${currentYear}`}>
        {currentKeyPersonnel?.role === 'Responsabile' && (
            <form onSubmit={handleResponsabileApprovePlan} className="space-y-4">
                <p>Stai per approvare il piano per <strong>{currentSede} / {currentYear}</strong> come Responsabile ({currentKeyPersonnel.name}).</p>
                <p>Assicurati che i corsi siano stati approvati dai QP. Verrà scaricato il CSV stato piano.</p>
                <div>
                    <label htmlFor="responsabilePassword" className="block text-sm font-medium text-gray-700">Password Responsabile</label>
                    <input type="password" id="responsabilePassword" value={responsabilePassword} onChange={(e) => setResponsabilePassword(e.target.value)} required className="input-field" />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={() => setIsResponsabileModalOpen(false)} className="btn-secondary">Annulla</button>
                    <button type="submit" className="btn-primary bg-success hover:bg-green-700">Approva Piano</button>
                </div>
            </form>
        )}
      </Modal>

      <style>{`
        .th-cell { @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider; }
        .td-cell { @apply px-6 py-4 whitespace-nowrap text-sm text-gray-500; }
        .input-field { @apply mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm; }
        .btn-primary { @apply px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-green-700 rounded-md transition-colors; }
        .btn-secondary { @apply px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 transition-colors; }
      `}</style>
    </div>
  );
};

export default PlanningPage;