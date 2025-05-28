import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { FaBuilding, FaUserCog, FaPlusCircle, FaTrash, FaEdit, FaUpload, FaFileCsv, FaDownload, FaFolderPlus, FaInfoCircle, FaClipboardList, FaLock, FaExclamationTriangle, FaBook, FaUserGraduate, FaLockOpen, FaKey } from 'react-icons/fa';
import Modal from '../components/Modal';
import { KeyPersonnel, KeyPersonnelRole, CSVExportType, NewKeyPersonnelPayload, UpdateKeyPersonnelPayload } from '../types';
import FileUpload from '../components/FileUpload'; 

type AdminSection = 'sedi' | 'personale' | 'dataManagement' | 'audit' | 'guides';

const AdminPage: React.FC = () => {
  const { 
    sedi, addSede, removeSede, 
    currentSedeId, 
    currentYear, 
    keyPersonnelList, addKeyPersonnel, updateKeyPersonnel, removeKeyPersonnel,
    loadKeyPersonnelFromMasterCSV, 
    downloadAuditLog, exportDataToCSV: triggerExport 
  } = useData();
  const [activeSection, setActiveSection] = useState<AdminSection>('dataManagement');
  
  const [isSedeModalOpen, setIsSedeModalOpen] = useState(false);
  const [newSedeName, setNewSedeName] = useState('');

  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<KeyPersonnel | null>(null);
  const [personnelFormData, setPersonnelFormData] = useState<Omit<NewKeyPersonnelPayload, 'passwordPlain'> & {passwordPlain?: string, confirmPassword?: string, id?: string, auth_user_id?: string}>({
    name: '', email: '', role: KeyPersonnelRole.QA_SITO, passwordPlain: '', confirmPassword: '' 
  });
  
  const [selectedSedeForDataLoad, setSelectedSedeForDataLoad] = useState<string | null>(currentSedeId);
  const [selectedYearForDataLoad, setSelectedYearForDataLoad] = useState<number | null>(currentYear);

  const [activeGuideSubSection, setActiveGuideSubSection] = useState<'user' | 'technical' | null>(null);
  const [isTechPasswordModalOpen, setIsTechPasswordModalOpen] = useState(false);
  const [techGuidePasswordInput, setTechGuidePasswordInput] = useState('');
  const [techGuidePasswordVerified, setTechGuidePasswordVerified] = useState(false);
  const ADMIN_MAIN_PASSWORD_FOR_GUIDE = "40sub3"; 

  useEffect(() => { setSelectedSedeForDataLoad(currentSedeId); }, [currentSedeId]);
  useEffect(() => { setSelectedYearForDataLoad(currentYear);}, [currentYear]);

  const handleAddSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSedeName.trim()) {
      const {success, message} = await addSede(newSedeName.trim());
      if(success) {
        setNewSedeName('');
        setIsSedeModalOpen(false);
      } else {
        alert(message || "Errore aggiunta sede.");
      }
    } else {
      alert("Il nome della sede non può essere vuoto.");
    }
  };
  
  const openPersonnelModal = (personnel?: KeyPersonnel) => {
    if (personnel) {
      setEditingPersonnel(personnel);
      setPersonnelFormData({ id: personnel.id, auth_user_id: personnel.auth_user_id, name: personnel.name, email: personnel.email || '', role: personnel.role, passwordPlain: '', confirmPassword: '' });
    } else {
      setEditingPersonnel(null);
      setPersonnelFormData({ name: '', email: '', role: KeyPersonnelRole.QA_SITO, passwordPlain: '', confirmPassword: '' });
    }
    setIsPersonnelModalOpen(true);
  };

  const handlePersonnelFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPersonnelFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSavePersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, role, email, passwordPlain, confirmPassword, auth_user_id } = personnelFormData;
    if (!name.trim() || !role || !email?.trim()) { alert("Nome, Email e Ruolo sono obbligatori."); return; }
    
    if (editingPersonnel && auth_user_id) { 
        const updatePayload: UpdateKeyPersonnelPayload = { name, role };
        if (passwordPlain) { 
            if (passwordPlain !== confirmPassword) { alert("Le password non coincidono."); return; }
            updatePayload.newPasswordPlain = passwordPlain;
        }
        const {success, message} = await updateKeyPersonnel(auth_user_id, updatePayload);
        if(!success) alert(message || "Errore aggiornamento personale.");
    } else if (!editingPersonnel) { 
        if (!passwordPlain || passwordPlain !== confirmPassword) { alert("Password obbligatoria e le password devono coincidere."); return; }
        const newPayload: NewKeyPersonnelPayload = { name, email, role, passwordPlain };
        const {success, message} = await addKeyPersonnel(newPayload);
        if(!success) alert(message || "Errore aggiunta personale.");
    }
    if (setIsPersonnelModalOpen) setIsPersonnelModalOpen(false); 
  };
  
  const handleTechGuidePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (techGuidePasswordInput === ADMIN_MAIN_PASSWORD_FOR_GUIDE) {
      setTechGuidePasswordVerified(true);
      setIsTechPasswordModalOpen(false);
      setActiveGuideSubSection('technical');
    } else {
      alert("Password Admin (per guida) errata.");
      setTechGuidePasswordVerified(false);
    }
    setTechGuidePasswordInput('');
  };

  const openTechnicalGuide = () => {
    if (techGuidePasswordVerified) {
        setActiveGuideSubSection('technical');
    } else {
        setIsTechPasswordModalOpen(true);
    }
  }

  const NavButton: React.FC<{section: AdminSection, label: string, icon: React.ReactElement}> = ({section, label, icon}) => (
    <button
        onClick={() => {setActiveSection(section); setActiveGuideSubSection(null);}}
        className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-150 ease-in-out
                    ${activeSection === section ? 'bg-primary text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-8">
      <header className="bg-gradient-to-r from-primary to-dark text-white p-8 rounded-lg shadow-xl">
        <h1 className="text-4xl font-bold mb-2">Pannello Amministrazione</h1>
        <p className="text-lg">Gestisci nomi sedi, personale chiave GxP, import/export e audit. I dati sono ora su database Supabase.</p>
      </header>

      <nav className="flex space-x-2 sm:space-x-4 border-b-2 border-gray-200 pb-4 mb-6 flex-wrap">
        <NavButton section="dataManagement" label="Import/Export CSV" icon={<FaFileCsv/>} />
        <NavButton section="sedi" label="Gestione Nomi Sedi" icon={<FaBuilding/>} />
        <NavButton section="personale" label="Personale Chiave GxP" icon={<FaUserCog/>} />
        <NavButton section="audit" label="Audit Log" icon={<FaClipboardList/>} />
        <NavButton section="guides" label="Guide" icon={<FaBook/>} />
      </nav>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-start">
          <FaInfoCircle className="text-3xl mr-4 mt-1 text-yellow-500 flex-shrink-0"/>
          <div>
            <h3 className="text-xl font-semibold mb-2">Istruzioni Fondamentali (con Supabase e Ruoli GxP)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li><strong>Configurazione Supabase (Una Tantum):</strong> Assicurati che il tuo progetto Supabase sia configurato con le tabelle corrette (vedi script SQL forniti) e che le variabili d'ambiente (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) siano nel file `.env.local`.</li>
              <li><strong>Utenti Chiave GxP (Admin):</strong>
                <ul className="list-disc list-inside pl-5 mt-1">
                    <li>Aggiungi utenti chiave (Admin, QA_SITO, QP, QA_CENTRALE) tramite la sezione "Personale Chiave GxP". Questo creerà un account in Supabase Authentication e un profilo `key_personnel`.</li>
                    <li>Per importazione massiva di personale chiave, usa la sezione "Import/Export CSV" &gt; "Importa Utenti Chiave GxP (CSV)". Richiede `name`, `role` (valido da enum GxP), `email`, `passwordPlain`.</li>
                </ul>
              </li>
              <li><strong>Nomi Sedi (Admin):</strong> Aggiungi nomi sedi da "Gestione Nomi Sedi".</li>
              <li><strong>Dati per Sede/Anno (Dipendenti, Corsi, Assegnazioni, Piani):</strong>
                <ul className="list-disc list-inside pl-5 mt-1">
                  <li>Seleziona Sede/Anno dalla barra di navigazione.</li>
                  <li>La gestione di Dipendenti, Corsi, Assegnazioni e Piani Formativi avviene direttamente nelle rispettive pagine ("Pianificazione", "Dipendenti", "Assegnazioni") attraverso l'interfaccia utente.</li>
                  <li>Le modifiche sono salvate direttamente nel database Supabase. Non è previsto l'import CSV per queste entità.</li>
                </ul>
              </li>
              <li><strong>Salvataggio Modifiche:</strong> Le modifiche effettuate tramite l'interfaccia utente sono salvate automaticamente su Supabase.</li>
              <li><strong>Export CSV (Backup/Analisi):</strong> Esporta dati da Supabase tramite la sezione "Import/Export CSV".</li>
               <li><strong>Sicurezza (Supabase):</strong> Gestita da Supabase Authentication e Row Level Security (RLS) policies. Assicurati che le RLS siano configurate correttamente per i ruoli GxP.</li>
            </ol>
          </div>
        </div>
      </div>

      {activeSection === 'guides' && (
         <section className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 border-b pb-3">Guide Operative (GxP & Supabase)</h2>
            <div className="flex space-x-4 mb-6">
                <button 
                    onClick={() => setActiveGuideSubSection('user')} 
                    className={`btn-secondary ${activeGuideSubSection === 'user' ? 'bg-primary text-white' : 'bg-gray-200'}`}
                >
                    <FaUserGraduate className="mr-2"/>Guida Utente GxP
                </button>
                <button 
                    onClick={openTechnicalGuide}
                    className={`btn-secondary ${activeGuideSubSection === 'technical' ? 'bg-primary text-white' : 'bg-gray-200'}`}
                >
                     <FaLockOpen className="mr-2"/>Guida Tecnica Supabase
                </button>
            </div>

            {activeGuideSubSection === 'user' && (
                <div className="prose max-w-none p-4 border rounded-md bg-sky-50 border-sky-200">
                    <h3 className="text-xl font-semibold text-sky-700">Guida Utente (Ruoli GxP e Supabase)</h3>
                    <p>Benvenuto! Questa piattaforma utilizza Supabase per la gestione dei dati e implementa ruoli GxP specifici.</p>
                    <h4>Flusso Operativo Generale:</h4>
                    <ol>
                        <li><strong>Login:</strong> Accedi con email/password. Il tuo ruolo GxP (Admin, QA_SITO, QP, QA_CENTRALE) determina le tue azioni.</li>
                        <li><strong>Selezione Sede e Anno.</strong></li>
                        <li><strong>Gestione Dati (in base al ruolo):</strong>
                            <ul>
                                <li><strong>QA_SITO:</strong> Definisce fabbisogni, predispone piano annuale, aggiorna schede partecipanti, report esterni, integra formazione speciale. Gestisce corsi, dipendenti, assegnazioni per la sua sede/anno.</li>
                                <li><strong>QP:</strong> Approva/Rigetta il piano formativo di sito. Approva/Rigetta modifiche al piano. Approva i singoli corsi.</li>
                                <li><strong>QA_CENTRALE:</strong> Approva/Rigetta il piano formativo di sito (dopo QP).</li>
                                <li><strong>Admin:</strong> Gestione utenti, sedi, export, override (con audit).</li>
                            </ul>
                        </li>
                        <li><strong>Salvataggio Modifiche:</strong> Automatico su Supabase.</li>
                    </ol>
                </div>
            )}
            {activeGuideSubSection === 'technical' && (
                 <div className="prose max-w-none p-4 border rounded-md bg-purple-50 border-purple-200">
                     <h3 className="text-xl font-semibold text-purple-700">Guida Tecnica (Supabase & GxP)</h3>
                    {!techGuidePasswordVerified && (
                        <div className="my-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700">
                            <FaExclamationTriangle className="inline mr-2"/>
                            Accesso limitato. Inserisci la password della guida per dettagli.
                        </div>
                    )}
                    <h4>Autenticazione e Ruoli GxP:</h4>
                    <ul>
                        <li>Supabase Authentication.</li>
                        <li>Ruoli GxP (Admin, QA_SITO, QP, QA_CENTRALE) in tabella `key_personnel` e usati nelle RLS.</li>
                    </ul>
                    <h4>Database (PostgreSQL su Supabase):</h4>
                    <ul>
                        <li>Schema SQL aggiornato per campi GxP nei corsi, stati piano GxP, e approvazioni dettagliate.</li>
                        <li>**Row Level Security (RLS) è CRUCIALE.** Implementare RLS granulari basate su `auth.uid()` e `get_user_role()` per i nuovi ruoli GxP.</li>
                    </ul>
                 </div>
            )}
        </section>
      )}

      {activeSection === 'audit' && (
        <section className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 border-b pb-3">Audit Log</h2>
            <div className="p-4 border rounded-md bg-teal-50 border-teal-200">
                 <h3 className="text-xl font-semibold text-teal-700 mb-2 flex items-center"><FaClipboardList className="mr-2"/> Visualizza e Scarica Audit Log</h3>
                 <p className="text-sm text-teal-600 mb-3">Le voci di audit sono registrate nel database Supabase.</p>
                 <button onClick={downloadAuditLog} className="btn-primary bg-teal-600 hover:bg-teal-700">
                    <FaDownload className="mr-2"/> Scarica Audit Log (CSV)
                 </button>
            </div>
        </section>
      )}

      {activeSection === 'dataManagement' && (
        <section className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 border-b pb-3">Import/Export Dati (CSV)</h2>
            <div className="p-4 border rounded-md bg-blue-50 border-blue-200">
                <h3 className="text-xl font-semibold text-blue-700 mb-2">Importa Utenti Chiave GxP (CSV)</h3>
                <p className="text-sm text-blue-600 mb-3">Richiede colonne: `name`, `role` (deve essere uno tra: {Object.values(KeyPersonnelRole).join(', ')}), `email`, `passwordPlain`.</p>
                <FileUpload 
                    onFileUpload={(file) => loadKeyPersonnelFromMasterCSV(file)} 
                    label="Carica CSV Utenti Chiave GxP" 
                    acceptedFileType=".csv" 
                />
            </div>
            
            <div className="p-4 border rounded-md bg-gray-100 border-gray-300">
                 <h3 className="text-xl font-semibold text-gray-700 mb-2">Importazione Dati Operativi (Dipendenti, Corsi, Piani, ecc.)</h3>
                 <p className="text-sm text-gray-600 mb-3">
                    La gestione dei dipendenti, corsi, assegnazioni e piani formativi avviene ora esclusivamente attraverso le rispettive sezioni dell'applicazione (Pianificazione, Dipendenti, Assegnazioni) tramite interazione con il database Supabase.
                 </p>
                 <p className="text-sm text-gray-600">
                    Non è più supportata l'importazione CSV per queste entità operative. Per esportare dati per backup o analisi, utilizza le opzioni di esportazione qui sotto.
                 </p>
            </div>

            <div className="p-4 border rounded-md bg-purple-50 border-purple-200">
                <h3 className="text-xl font-semibold text-purple-700 mb-2">Esporta Dati (CSV)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="adminSedeSelectExport" className="block text-sm font-medium text-gray-700 mb-1">Sede (per export specifici):</label>
                        <select id="adminSedeSelectExport" value={selectedSedeForDataLoad || ''} onChange={(e) => setSelectedSedeForDataLoad(e.target.value || null)} className="input-field bg-white">
                            <option value="" disabled>-- Seleziona Sede --</option>
                            {sedi.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="adminYearSelectExport" className="block text-sm font-medium text-gray-700 mb-1">Anno (per export specifici):</label>
                         <input type="number" id="adminYearSelectExport" placeholder="Es. 2024" value={selectedYearForDataLoad || ''} onChange={(e) => setSelectedYearForDataLoad(e.target.value ? parseInt(e.target.value) : null)} className="input-field" />
                    </div>
                </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {(['employees', 'courses', 'assignments', 'planRecords', 'keyPersonnel', 'auditTrail'] as CSVExportType[]).map(type => (
                        (type !== 'allData') && 
                        <button 
                            key={type}
                            onClick={() => triggerExport(type, selectedSedeForDataLoad || undefined, selectedYearForDataLoad || undefined)}
                            className="btn-secondary py-2 px-3 flex items-center justify-center"
                            title={`Esporta ${type}`}
                        > <FaDownload className="mr-1"/> Esporta {type} </button>
                    ))}
                </div>
            </div>
        </section>
      )}

      {activeSection === 'sedi' && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Elenco Nomi Sedi</h2>
            <button onClick={() => setIsSedeModalOpen(true)} className="btn-primary">
              <FaPlusCircle className="mr-2" /> Aggiungi Nome Sede
            </button>
          </div>
          {sedi.length > 0 ? (
            <ul className="space-y-3">
              {sedi.map(sedeObj => (
                <li key={sedeObj.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 rounded-md border">
                  <span className="text-gray-700 font-medium mb-2 sm:mb-0">{sedeObj.name} (ID: {sedeObj.id})</span>
                  <button onClick={() => removeSede(sedeObj.id)} className="text-danger hover:text-red-700 p-1"><FaTrash size={18}/></button>
                </li>
              ))}
            </ul>
          ) : ( <p className="text-gray-500 text-center py-4">Nessun nome sede definito.</p> )}
        </section>
      )}

      {activeSection === 'personale' && (
        <section className="bg-white p-6 rounded-lg shadow-md">
           <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Personale Chiave GxP</h2>
            <button onClick={() => openPersonnelModal()} className="btn-primary"> <FaPlusCircle className="mr-2" /> Aggiungi </button>
          </div>
          {keyPersonnelList.length === 0 && <p className="text-sm text-gray-600 mb-3">Nessun utente chiave GxP trovato.</p>}
          {keyPersonnelList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr><th className="th-cell">Nome</th><th className="th-cell">Email (Login)</th><th className="th-cell">Ruolo GxP</th><th className="th-cell">Azioni</th></tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {keyPersonnelList.map(p => (
                        <tr key={p.auth_user_id} className="hover:bg-gray-50">
                            <td className="td-cell font-medium">{p.name}</td>
                            <td className="td-cell">{p.email || 'N/A'}</td>
                            <td className="td-cell">{p.role}</td>
                            <td className="td-cell space-x-3">
                                <button onClick={() => openPersonnelModal(p)} className="text-primary hover:text-green-700" title="Modifica"><FaEdit/></button>
                                <button onClick={() => removeKeyPersonnel(p.auth_user_id)} className="text-danger hover:text-red-700" title="Rimuovi"><FaTrash/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : ( <p className="text-gray-500 text-center py-4">Nessun personale chiave GxP.</p> )}
        </section>
      )}

      <Modal isOpen={isSedeModalOpen} onClose={() => setIsSedeModalOpen(false)} title="Aggiungi Nome Nuova Sede">
        <form onSubmit={handleAddSede} className="space-y-4">
          <div>
            <label htmlFor="newSedeNameModal" className="block text-sm font-medium text-gray-700">Nome Sede</label>
            <input type="text" id="newSedeNameModal" value={newSedeName} onChange={(e) => setNewSedeName(e.target.value)} className="input-field" required />
          </div>
          <div className="flex justify-end pt-2"><button type="submit" className="btn-primary">Aggiungi</button></div>
        </form>
      </Modal>

      <Modal isOpen={isPersonnelModalOpen} onClose={() => setIsPersonnelModalOpen(false)} title={editingPersonnel ? "Modifica Personale Chiave GxP" : "Aggiungi Personale Chiave GxP"}>
        <form onSubmit={handleSavePersonnel} className="space-y-4">
            <div><label htmlFor="personnelNameModal">Nome</label><input type="text" name="name" id="personnelNameModal" value={personnelFormData.name} onChange={handlePersonnelFormChange} required className="input-field" /></div>
            <div><label htmlFor="personnelEmailModal">Email (per Login)</label><input type="email" name="email" id="personnelEmailModal" value={personnelFormData.email || ''} onChange={handlePersonnelFormChange} required className="input-field" disabled={!!editingPersonnel} /></div>
            <div><label htmlFor="personnelRoleModal">Ruolo GxP</label>
                <select name="role" id="personnelRoleModal" value={personnelFormData.role} onChange={handlePersonnelFormChange} required className="input-field bg-white">
                    {Object.values(KeyPersonnelRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
             <div><label htmlFor="personnelPasswordModal">Password {editingPersonnel ? "(lascia vuoto per non cambiare)" : ""}</label><input type="password" name="passwordPlain" id="personnelPasswordModal" value={personnelFormData.passwordPlain || ''} onChange={handlePersonnelFormChange} required={!editingPersonnel} className="input-field" /></div>
             <div><label htmlFor="personnelConfirmPasswordModal">Conferma Password</label><input type="password" name="confirmPassword" id="personnelConfirmPasswordModal" value={personnelFormData.confirmPassword || ''} onChange={handlePersonnelFormChange} required={!editingPersonnel || !!personnelFormData.passwordPlain} className="input-field" /></div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsPersonnelModalOpen(false)} className="btn-secondary">Annulla</button>
                <button type="submit" className="btn-primary">{editingPersonnel ? "Salva Modifiche" : "Crea Utente"}</button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isTechPasswordModalOpen} onClose={() => setIsTechPasswordModalOpen(false)} title="Accesso Guida Tecnica">
            <form onSubmit={handleTechGuidePasswordSubmit} className="space-y-4">
                <div>
                    <label htmlFor="techGuidePasswordInputModal" className="block text-sm font-medium text-gray-700">Password Guida</label>
                    <input type="password" id="techGuidePasswordInputModal" value={techGuidePasswordInput} onChange={(e) => setTechGuidePasswordInput(e.target.value)} className="input-field" required />
                </div>
                <button type="submit" className="w-full btn-primary">Accedi</button>
            </form>
        </Modal>

       <style>{`
        .th-cell { @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider; }
        .td-cell { @apply px-6 py-4 whitespace-nowrap text-sm; }
        .input-field { @apply mt-1 block w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-gray-900 bg-white; }
        .input-field option { @apply text-gray-900; }
        .btn-primary { @apply inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-green-700 rounded-md transition-colors disabled:opacity-50; }
        .btn-secondary { @apply inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 transition-colors disabled:opacity-50; }
        .prose { @apply text-gray-700; }
        .prose h4 { @apply text-lg font-semibold mt-5 mb-2 text-gray-800; }
        .prose ul { @apply list-disc pl-5 space-y-1; }
        .prose ol { @apply list-decimal pl-5 space-y-1; }
        .prose li > ul { @apply mt-1; }
        .prose li > ol { @apply mt-1; }
        .prose strong { @apply font-semibold; }
        .prose code { @apply bg-gray-200 text-sm px-1 py-0.5 rounded; }
      `}</style>
    </div>
  );
};

export default AdminPage;
