import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { TrainingCourse, TrainingCourseStatus, PlanStatus, PlanApproval, CourseApproval, KeyPersonnelRole, TrainingType, PlanRecord } from '../types';
import { FaFilter, FaPlusCircle, FaEdit, FaTrash, FaCheckCircle, FaHourglassHalf, FaUserCheck, FaPaperPlane, FaTimesCircle } from 'react-icons/fa';
import Modal from '../components/Modal';

const PlanningPage: React.FC = () => {
  const { 
    getSedeCourses, addCourse, updateCourse, deleteCourse,
    currentSedeId, currentYear, yearlySedeData, sedi,
    getSedePlanRecord,
    approveCourseByQP, currentKeyPersonnel,
    submitPlanForApproval, approveOrRejectPlanStep
  } = useData();
  
  const courses = getSedeCourses();
  const planRecord = getSedePlanRecord();
  const planStatus = planRecord?.status;
  
  const currentSedeObject = useMemo(() => sedi.find(s => s.id === currentSedeId), [sedi, currentSedeId]);
  const currentSedeName = currentSedeObject?.name;

  const isDataEffectivelyLoaded = currentSedeName && currentYear && 
                                  yearlySedeData[currentYear] && yearlySedeData[currentYear][currentSedeName] &&
                                  (yearlySedeData[currentYear][currentSedeName].courses.length > 0 || 
                                   yearlySedeData[currentYear][currentSedeName].employees.length > 0 || 
                                   yearlySedeData[currentYear][currentSedeName].assignments.length > 0);


  const [filters, setFilters] = useState({ name: '', category: '', status: '', training_type: '' });
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Partial<TrainingCourse> & { isNew?: boolean } | null>(null);
  
  const [isQPModalOpen, setIsQPModalOpen] = useState(false);
  const [courseToApproveByQP, setCourseToApproveByQP] = useState<TrainingCourse | null>(null);

  const [isPlanApprovalModalOpen, setIsPlanApprovalModalOpen] = useState(false);
  const [planApprovalAction, setPlanApprovalAction] = useState<'Approvato' | 'Rigettato' | null>(null);
  const [planApprovalRole, setPlanApprovalRole] = useState<KeyPersonnelRole.QP | KeyPersonnelRole.QA_CENTRALE | null>(null);
  const [planApprovalComment, setPlanApprovalComment] = useState('');


  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      return (
        (filters.name === '' || course.name.toLowerCase().includes(filters.name.toLowerCase())) &&
        (filters.category === '' || course.category.toLowerCase().includes(filters.category.toLowerCase())) &&
        (filters.status === '' || course.status === filters.status) &&
        (filters.training_type === '' || course.training_type === filters.training_type)
      );
    });
  }, [courses, filters]);

  const openCourseModal = (course?: TrainingCourse) => {
    if (!currentSedeId || !currentYear || !isDataEffectivelyLoaded) {
        alert("Seleziona sede e anno, e assicurati che i dati siano caricati da Supabase.");
        return;
    }
    if (course) {
      setEditingCourse({ ...course, isNew: false });
    } else {
      setEditingCourse({ 
        date: new Date().toISOString().split('T')[0], 
        durationHours: 0, 
        category: '', 
        description: '', 
        name: '', 
        isNew: true, 
        status: TrainingCourseStatus.BOZZA,
        training_type: TrainingType.CONTINUA, // Default
        trainer_info: '',
        planned_period: '',
        gxp_area: ''
      });
    }
    setIsCourseModalOpen(true);
  };
  
  const handleSaveCourse = async () => {
    if (editingCourse && editingCourse.name && editingCourse.date && editingCourse.durationHours !== undefined && editingCourse.category && editingCourse.description) {
        const courseDataToSave = {
            name: editingCourse.name,
            description: editingCourse.description,
            date: editingCourse.date,
            durationHours: editingCourse.durationHours,
            category: editingCourse.category,
            training_type: editingCourse.training_type,
            trainer_info: editingCourse.trainer_info,
            planned_period: editingCourse.planned_period,
            gxp_area: editingCourse.gxp_area,
        };
        if (editingCourse.isNew) {
            await addCourse({ ...courseDataToSave });
        } else if(editingCourse.id) {
            await updateCourse(editingCourse.id, {
                ...courseDataToSave,
                status: editingCourse.status, 
            });
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
    if (!currentSedeId || !currentYear || !isDataEffectivelyLoaded) {
        alert("Dati sede/anno non caricati da Supabase."); return;
    }
    setCourseToApproveByQP(course);
    setIsQPModalOpen(true);
  };

  const handleQPApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (courseToApproveByQP && currentKeyPersonnel && currentKeyPersonnel.role === KeyPersonnelRole.QP) {
      const {success, message} = await approveCourseByQP(courseToApproveByQP.id);
      if (success) {
        setIsQPModalOpen(false);
        setCourseToApproveByQP(null);
        alert(`Corso ${courseToApproveByQP.name} approvato.`);
      } else {
        alert(`Errore approvazione QP: ${message || "Dettagli non disponibili"}`);
      }
    } else {
      alert("Devi essere loggato come QP per approvare, o il corso non è valido.");
    }
  };

  const openPlanApprovalModal = (role: KeyPersonnelRole.QP | KeyPersonnelRole.QA_CENTRALE, action: 'Approvato' | 'Rigettato') => {
    if (!planRecord) { alert("Piano non caricato."); return; }
    setPlanApprovalRole(role);
    setPlanApprovalAction(action);
    setPlanApprovalComment('');
    setIsPlanApprovalModalOpen(true);
  };

  const handlePlanApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planRecord || !planApprovalRole || !planApprovalAction) return;
    
    const {success, message} = await approveOrRejectPlanStep(
      planRecord.id,
      planApprovalRole,
      planApprovalAction,
      planApprovalComment
    );

    if (success) {
      alert(`Piano ${planApprovalAction.toLowerCase()} da ${planApprovalRole}.`);
      setIsPlanApprovalModalOpen(false);
    } else {
      alert(`Errore: ${message || "Operazione fallita."}`);
    }
  };
  
  const handleSubmitForApproval = async (targetRole: KeyPersonnelRole.QP | KeyPersonnelRole.QA_CENTRALE) => {
    if (!planRecord) { alert("Piano non caricato."); return; }
    const {success, message} = await submitPlanForApproval(planRecord.id, targetRole);
    if(success) {
        alert(`Piano inviato per approvazione a ${targetRole}.`);
    } else {
        alert(`Errore invio piano: ${message || "Dettagli non disponibili."}`);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if(confirm("Sei sicuro di voler eliminare questo corso? L'azione è irreversibile.")) {
        await deleteCourse(courseId); 
    }
  };

  const getCourseStatusPill = (status: TrainingCourseStatus) => { 
    switch (status) {
        case TrainingCourseStatus.BOZZA: return 'bg-gray-200 text-gray-800';
        case TrainingCourseStatus.APPROVATO_QP: return 'bg-yellow-200 text-yellow-800';
        case TrainingCourseStatus.PIANIFICATO: return 'bg-blue-200 text-blue-800';
        case TrainingCourseStatus.COMPLETATO: return 'bg-green-200 text-green-800';
        case TrainingCourseStatus.ANNULLATO: return 'bg-red-200 text-red-800';
        default: return 'bg-gray-200 text-gray-800';
    }
   };

  const getPlanStatusInfo = () => {
    if (!planRecord) {
        return { 
            text: "Non Definito" as string, 
            color: "bg-gray-300", 
            icon: <FaHourglassHalf/>, 
            canBeSubmittedToQP: false, 
            canBeSubmittedToQA_C: false, 
            canQPApprove: false, 
            canQACentraleApprove: false 
        };
    }

    let currentStatusText: string = planRecord.status; // Initialize with enum member name as string
    let color = "bg-gray-400";
    let icon: JSX.Element = <FaHourglassHalf/>;
    let canBeSubmittedToQP = false;
    let canBeSubmittedToQA_C = false;
    let canQPApprove = false;
    let canQACentraleApprove = false;

    switch (planRecord.status) {
        case PlanStatus.BOZZA: 
        case PlanStatus.IN_REVISIONE_QA_SITO:
        case PlanStatus.RIGETTATO_QP:
        case PlanStatus.RIGETTATO_QA_CENTRALE:
            currentStatusText = `In Lavorazione (${planRecord.status})`; 
            color = "bg-blue-200 text-blue-800"; 
            canBeSubmittedToQP = true; 
            break;
        case PlanStatus.IN_APPROVAZIONE_QP: 
            currentStatusText = "Attesa Approv. QP"; 
            color = "bg-yellow-400 text-black"; 
            canQPApprove = true; 
            break;
        case PlanStatus.APPROVATO_QP: 
            currentStatusText = "Approvato QP"; 
            color = "bg-lime-500 text-white"; 
            canBeSubmittedToQA_C = true; 
            break;
        case PlanStatus.IN_APPROVAZIONE_QA_CENTRALE: 
            currentStatusText = "Attesa Approv. QA Centrale"; 
            color = "bg-yellow-400 text-black"; 
            canQACentraleApprove = true; 
            break;
        case PlanStatus.APPROVATO_QA_CENTRALE: 
        case PlanStatus.APPROVATO: 
            currentStatusText = "Approvato Definitivo"; 
            color = "bg-success text-white"; 
            icon = <FaCheckCircle/>; 
            break;
        case PlanStatus.OBSOLETO: 
            currentStatusText = "Obsoleto"; 
            color = "bg-danger text-white"; 
            break;
        default:
            currentStatusText = planRecord.status; 
            color = "bg-gray-400";
            break;
    }
    return { text: currentStatusText, color, icon, canBeSubmittedToQP, canBeSubmittedToQA_C, canQPApprove, canQACentraleApprove };
  };
  const planStatusDisplay = getPlanStatusInfo();

  const canManageCourses = currentKeyPersonnel?.role === KeyPersonnelRole.ADMIN || currentKeyPersonnel?.role === KeyPersonnelRole.QA_SITO;
  const isQP = currentKeyPersonnel?.role === KeyPersonnelRole.QP;
  const isQACentrale = currentKeyPersonnel?.role === KeyPersonnelRole.QA_CENTRALE;
  const isQA_Sito = currentKeyPersonnel?.role === KeyPersonnelRole.QA_SITO;


  if (!currentSedeId || !currentYear) { return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-gray-600">Seleziona Sede e Anno dalla barra di navigazione.</p></div>; }
  if (!isDataEffectivelyLoaded && currentSedeId && currentYear) { return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-xl text-yellow-700">Dati per {currentSedeName || currentSedeId}/{currentYear} non caricati. Controlla la connessione e assicurati che i dati siano presenti in Supabase.</p></div>; }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Pianificazione Corsi - {currentSedeName || currentSedeId} / {currentYear}</h1>
            <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 ${planStatusDisplay.color}`}>
                {planStatusDisplay.icon}
                <span>Stato Piano: {planStatusDisplay.text}</span>
            </div>
        </div>
        
        {/* Azioni Piano */}
        <div className="mt-4 space-x-2 space-y-2">
            {isQA_Sito && planStatusDisplay.canBeSubmittedToQP && (
                <button onClick={() => handleSubmitForApproval(KeyPersonnelRole.QP)} className="btn-primary bg-orange-500 hover:bg-orange-600">
                    <FaPaperPlane className="mr-2"/> Invia a QP
                </button>
            )}
            {isQP && planStatusDisplay.canQPApprove && (
                <>
                <button onClick={() => openPlanApprovalModal(KeyPersonnelRole.QP, 'Approvato')} className="btn-primary bg-success hover:bg-green-700">
                    <FaCheckCircle className="mr-2"/> Approva (QP)
                </button>
                <button onClick={() => openPlanApprovalModal(KeyPersonnelRole.QP, 'Rigettato')} className="btn-primary bg-danger hover:bg-red-700">
                    <FaTimesCircle className="mr-2"/> Rigetta (QP)
                </button>
                </>
            )}
             {isQA_Sito && planStatusDisplay.canBeSubmittedToQA_C && ( // O chiunque sia responsabile di inviare a QA Centrale
                <button onClick={() => handleSubmitForApproval(KeyPersonnelRole.QA_CENTRALE)} className="btn-primary bg-orange-500 hover:bg-orange-600">
                    <FaPaperPlane className="mr-2"/> Invia a QA Centrale
                </button>
            )}
            {isQACentrale && planStatusDisplay.canQACentraleApprove && (
                 <>
                <button onClick={() => openPlanApprovalModal(KeyPersonnelRole.QA_CENTRALE, 'Approvato')} className="btn-primary bg-success hover:bg-green-700">
                    <FaCheckCircle className="mr-2"/> Approva (QA Centrale)
                </button>
                <button onClick={() => openPlanApprovalModal(KeyPersonnelRole.QA_CENTRALE, 'Rigettato')} className="btn-primary bg-danger hover:bg-red-700">
                    <FaTimesCircle className="mr-2"/> Rigetta (QA Centrale)
                </button>
                </>
            )}
        </div>

         {planRecord?.approvals && planRecord.approvals.length > 0 && (
            <div className="mt-6 p-4 border rounded-md bg-gray-50">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Storico Approvazioni Piano:</h4>
                <ul className="space-y-2 text-xs">
                    {planRecord.approvals.slice().sort((a,b) => new Date(b.approval_date).getTime() - new Date(a.approval_date).getTime()).map(app => (
                        <li key={app.id} className={`p-2 rounded ${app.approval_status === 'Approvato' ? 'bg-green-100' : 'bg-red-100'}`}>
                            <strong>{app.approver_name}</strong> ({app.approver_role}) ha <strong>{app.approval_status.toLowerCase()}</strong> il piano ({app.approval_step})
                            il {new Date(app.approval_date).toLocaleString('it-IT')}.
                            {app.approval_comment && <p className="mt-1 text-gray-600"><i>Commento: {app.approval_comment}</i></p>}
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h2 className="text-2xl font-semibold text-gray-700 flex items-center"><FaFilter className="mr-2 text-primary" /> Filtri Corsi</h2>
            {canManageCourses && (
                <button onClick={() => openCourseModal()} className="btn-primary">
                    <FaPlusCircle className="mr-2" /> Aggiungi Corso
                </button>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <input type="text" name="name" placeholder="Nome corso..." value={filters.name} onChange={handleFilterChange} className="input-field" />
          <input type="text" name="category" placeholder="Categoria..." value={filters.category} onChange={handleFilterChange} className="input-field" />
          <select name="status" value={filters.status} onChange={handleFilterChange} className="input-field bg-white">
            <option value="">Tutti gli stati</option>
            {Object.values(TrainingCourseStatus).map(status => ( <option key={status} value={status}>{status}</option> ))}
          </select>
          <select name="training_type" value={filters.training_type} onChange={handleFilterChange} className="input-field bg-white">
            <option value="">Tutti i Tipi Formazione</option>
            {Object.values(TrainingType).map(type => ( <option key={type} value={type}>{type}</option> ))}
          </select>
        </div>
      </div>
      
      {filteredCourses.length === 0 && courses.length > 0 && ( <p className="text-center text-gray-500 text-lg">Nessun corso corrisponde ai filtri.</p> )}
      {courses.length === 0 && isDataEffectivelyLoaded && ( <p className="text-center text-gray-500 text-lg py-8">Nessun corso caricato per {currentSedeName || currentSedeId}/{currentYear}.</p> )}

      {filteredCourses.length > 0 && (
        <div className="bg-white p-2 rounded-lg shadow-md overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="th-cell">Nome Corso</th>
                <th className="th-cell">Tipo Form.</th>
                <th className="th-cell">Categoria</th>
                <th className="th-cell">Data Prev.</th>
                <th className="th-cell">Periodo Prev.</th>
                <th className="th-cell">Durata (ore)</th>
                <th className="th-cell">Formatore</th>
                <th className="th-cell">Area GxP</th>
                <th className="th-cell">Stato</th>
                <th className="th-cell">Appr. QP</th>
                <th className="th-cell">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCourses.map(course => (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="td-cell font-medium text-gray-900">{course.name}</td>
                  <td className="td-cell">{course.training_type || '-'}</td>
                  <td className="td-cell">{course.category}</td>
                  <td className="td-cell">{new Date(course.date).toLocaleDateString('it-IT')}</td>
                  <td className="td-cell">{course.planned_period || '-'}</td>
                  <td className="td-cell">{course.durationHours}</td>
                  <td className="td-cell">{course.trainer_info || '-'}</td>
                  <td className="td-cell">{course.gxp_area || '-'}</td>
                  <td className="td-cell">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCourseStatusPill(course.status)}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="td-cell">
                    {course.approvals && course.approvals.length > 0 
                        ? course.approvals.map((app: CourseApproval) => `${app.qp_name} il ${new Date(app.approval_date).toLocaleDateString('it-IT')}`).join(', ') 
                        : 'No'}
                  </td>
                  <td className="td-cell space-x-2">
                    {canManageCourses && (
                        <>
                        <button onClick={() => openCourseModal(course)} className="text-primary hover:text-green-700" title="Modifica Corso"><FaEdit /></button>
                        <button onClick={() => handleDeleteCourse(course.id)} className="text-danger hover:text-red-700" title="Elimina Corso"><FaTrash /></button>
                        </>
                    )}
                    {isQP && course.status === TrainingCourseStatus.BOZZA && (
                        <button onClick={() => openQPApprovalModal(course)} className="text-success hover:text-green-700" title="Approva Corso (QP)"><FaCheckCircle /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} title={editingCourse?.isNew ? "Aggiungi Nuovo Corso GxP" : "Modifica Corso GxP"}>
        {editingCourse && (
            <form onSubmit={(e) => {e.preventDefault(); handleSaveCourse();}} className="space-y-3 text-sm">
                <div><label htmlFor="courseName">Nome Corso*</label><input type="text" name="name" id="courseName" value={editingCourse.name || ''} onChange={handleModalFieldChange} required className="input-field" /></div>
                <div><label htmlFor="courseDescription">Descrizione*</label><textarea name="description" id="courseDescription" value={editingCourse.description || ''} onChange={handleModalFieldChange} required rows={2} className="input-field"></textarea></div>
                <div><label htmlFor="courseCategory">Categoria*</label><input type="text" name="category" id="courseCategory" value={editingCourse.category || ''} onChange={handleModalFieldChange} required className="input-field" /></div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label htmlFor="courseDate">Data Prevista* (YYYY-MM-DD)</label><input type="date" name="date" id="courseDate" value={editingCourse.date || ''} onChange={handleModalFieldChange} required className="input-field" /></div>
                    <div><label htmlFor="courseDuration">Durata (ore)*</label><input type="number" name="durationHours" id="courseDuration" value={editingCourse.durationHours || 0} onChange={handleModalFieldChange} required min="0" className="input-field" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label htmlFor="training_type">Tipo Formazione</label>
                        <select name="training_type" id="training_type" value={editingCourse.training_type || ''} onChange={handleModalFieldChange} className="input-field bg-white">
                            <option value="">Seleziona tipo...</option>
                            {Object.values(TrainingType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div><label htmlFor="planned_period">Periodo Previsto (es. Q1, YYYY-MM-DD)</label><input type="text" name="planned_period" id="planned_period" value={editingCourse.planned_period || ''} onChange={handleModalFieldChange} className="input-field" /></div>
                </div>

                <div><label htmlFor="trainer_info">Formatore/i</label><input type="text" name="trainer_info" id="trainer_info" value={editingCourse.trainer_info || ''} onChange={handleModalFieldChange} className="input-field" /></div>
                <div><label htmlFor="gxp_area">Ambito GxP Pertinenza</label><input type="text" name="gxp_area" id="gxp_area" value={editingCourse.gxp_area || ''} onChange={handleModalFieldChange} className="input-field" /></div>
                
                {(canManageCourses || isQP) && !editingCourse.isNew && ( // QP può modificare lo stato se lo approva, Admin/QA_SITO possono cambiarlo
                    <div>
                        <label htmlFor="courseStatus">Stato Corso</label>
                        <select name="status" id="courseStatus" value={editingCourse.status || ''} onChange={handleModalFieldChange} className="input-field bg-white" disabled={!canManageCourses}>
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
        {courseToApproveByQP && isQP && (
          <form onSubmit={handleQPApprove} className="space-y-4">
            <p>Sei sicuro di voler approvare il corso "{courseToApproveByQP.name}" come QP?</p>
            <p className="text-sm text-gray-600">Questa azione imposterà lo stato del corso a '{TrainingCourseStatus.APPROVATO_QP}' e registrerà la tua approvazione.</p>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => setIsQPModalOpen(false)} className="btn-secondary">Annulla</button>
              <button type="submit" className="btn-primary bg-success hover:bg-green-700">Approva Corso</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isPlanApprovalModalOpen} onClose={() => setIsPlanApprovalModalOpen(false)} title={`${planApprovalAction} Piano Formativo (${planApprovalRole})`}>
        {planRecord && planApprovalRole && planApprovalAction && (
            <form onSubmit={handlePlanApprovalSubmit} className="space-y-4">
                <p>Stai per <strong>{planApprovalAction.toLowerCase()}</strong> il piano per {currentSedeName || currentSedeId}/{currentYear} come {planApprovalRole}.</p>
                <div>
                    <label htmlFor="planApprovalComment" className="block text-sm font-medium text-gray-700">Commento (opzionale, specialmente per rigetto):</label>
                    <textarea 
                        id="planApprovalComment" 
                        name="planApprovalComment"
                        rows={3}
                        value={planApprovalComment}
                        onChange={(e) => setPlanApprovalComment(e.target.value)}
                        className="input-field"
                    />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={() => setIsPlanApprovalModalOpen(false)} className="btn-secondary">Annulla</button>
                    <button type="submit" className={`btn-primary ${planApprovalAction === 'Approvato' ? 'bg-success hover:bg-green-700' : 'bg-danger hover:bg-red-700'}`}>{planApprovalAction}</button>
                </div>
            </form>
        )}
      </Modal>

      <style>{`
        .th-cell { @apply px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider; }
        .td-cell { @apply px-4 py-3 whitespace-nowrap text-sm text-gray-600; }
        .input-field { @apply mt-1 block w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-gray-900 bg-white; }
        .btn-primary { @apply px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-green-700 rounded-md transition-colors disabled:opacity-50; }
        .btn-secondary { @apply px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 transition-colors; }
      `}</style>
    </div>
  );
};

export default PlanningPage;
