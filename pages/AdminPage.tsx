
import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { FaBuilding, FaUserCog, FaPlusCircle, FaTrash, FaEdit, FaUpload, FaFileCsv, FaCalendarDay, FaDownload, FaFolderPlus, FaInfoCircle, FaKey, FaClipboardList, FaLock, FaExclamationTriangle, FaBook, FaUserGraduate, FaLockOpen } from 'react-icons/fa';
import Modal from '../components/Modal';
import { KeyPersonnel, KeyPersonnelRole, CSVExportType } from '../types';
import FileUpload from '../components/FileUpload'; 
import { exportDataToCSV } from '../services/csvExporter';

type AdminSection = 'sedi' | 'personale' | 'dataManagement' | 'security' | 'guides';

const AdminPage: React.FC = () => {
  const { 
    sedi, addSede, removeSede, 
    currentSede, setCurrentSede,
    currentYear, availableYears, 
    keyPersonnelList, addKeyPersonnel, updateKeyPersonnel, removeKeyPersonnel,
    loadKeyPersonnelFromMasterCSV, loadSedeDataFromCSV, loadSedePlanStatusFromCSV,
    setUserEncryptionKey, loadUserEncryptionKeyFromFile, isUserKeySet, downloadAuditLog
  } = useData();
  const [activeSection, setActiveSection] = useState<AdminSection>('dataManagement');
  
  const [isSedeModalOpen, setIsSedeModalOpen] = useState(false);
  const [newSedeName, setNewSedeName] = useState('');

  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<KeyPersonnel | null>(null);
  const [personnelFormData, setPersonnelFormData] = useState<{id?: string, name: string, role: KeyPersonnelRole, password: string, confirmPassword?: string}>({
    name: '', role: 'QP', password: '', confirmPassword: ''
  });

  const [sedeDataFileEmployees, setSedeDataFileEmployees] = useState<File | null>(null);
  const [sedeDataFileCourses, setSedeDataFileCourses] = useState<File | null>(null);
  const [sedeDataFileAssignments, setSedeDataFileAssignments] = useState<File | null>(null);
  const [sedeDataFilePlanStatus, setSedeDataFilePlanStatus] = useState<File | null>(null);
  
  const [selectedSedeForDataLoad, setSelectedSedeForDataLoad] = useState<string | null>(currentSede);
  const [selectedYearForDataLoad, setSelectedYearForDataLoad] = useState<number | null>(currentYear);

  const [newUserEncryptionPassword, setNewUserEncryptionPassword] = useState('');
  const [confirmNewUserEncryptionPassword, setConfirmNewUserEncryptionPassword] = useState('');
  const [encryptionKeyConfigFile, setEncryptionKeyConfigFile] = useState<File | null>(null);

  // For Guides
  const [activeGuideSubSection, setActiveGuideSubSection] = useState<'user' | 'technical' | null>(null);
  const [isTechPasswordModalOpen, setIsTechPasswordModalOpen] = useState(false);
  const [techGuidePasswordInput, setTechGuidePasswordInput] = useState('');
  const [techGuidePasswordVerified, setTechGuidePasswordVerified] = useState(false);
  const ADMIN_MAIN_PASSWORD = "40sub3"; // To compare for tech guide access

  useEffect(() => { setSelectedSedeForDataLoad(currentSede); }, [currentSede]);
  useEffect(() => { setSelectedYearForDataLoad(currentYear);}, [currentYear]);


  const handleAddSede = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSedeName.trim()) {
      if(addSede(newSedeName.trim())) {
        // const addedSedeName = newSedeName.trim(); // already handled by context
        setNewSedeName('');
        setIsSedeModalOpen(false);
      }
    } else {
      alert("Il nome della sede non può essere vuoto.");
    }
  };
  
  const openPersonnelModal = (personnel?: KeyPersonnel) => {
    if (personnel) {
      setEditingPersonnel(personnel);
      setPersonnelFormData({ id: personnel.id, name: personnel.name, role: personnel.role, password: '', confirmPassword: '' });
    } else {
      setEditingPersonnel(null);
      setPersonnelFormData({ name: '', role: 'QP', password: '', confirmPassword: '' });
    }
    setIsPersonnelModalOpen(true);
  };

  const handlePersonnelFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPersonnelFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSavePersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, role, password, confirmPassword } = personnelFormData;
    if (!name.trim() || !role) { alert("Nome e Ruolo sono obbligatori."); return; }
    
    if (editingPersonnel) { 
        let updatePayload: Partial<Omit<KeyPersonnel, 'id' | 'password'>> & {newPassword?: string} = { name, role };
        if (password) { 
            if (password !== confirmPassword) { alert("Le password non coincidono."); return; }
            updatePayload.newPassword = password;
        }
        updateKeyPersonnel(editingPersonnel.id, updatePayload);
    } else { 
        if (!password || password !== confirmPassword) { alert("Password obbligatoria e le password devono coincidere."); return; }
        addKeyPersonnel({ name, role, password });
    }
    setIsPersonnelModalOpen(false);
  };

  const handleLoadSedeDataAll = async () => {
    if (!selectedSedeForDataLoad || !selectedYearForDataLoad) {
        alert("Seleziona una sede e un anno."); return;
    }
    if (!sedeDataFileEmployees || !sedeDataFileCourses || !sedeDataFileAssignments || !sedeDataFilePlanStatus) {
        alert("Seleziona tutti e quattro i file CSV."); return;
    }
    try {
        const yearStr = selectedYearForDataLoad.toString();
        await loadSedeDataFromCSV(selectedSedeForDataLoad, yearStr, 'employees', sedeDataFileEmployees);
        await loadSedeDataFromCSV(selectedSedeForDataLoad, yearStr, 'courses', sedeDataFileCourses);
        await loadSedeDataFromCSV(selectedSedeForDataLoad, yearStr, 'assignments', sedeDataFileAssignments);
        await loadSedePlanStatusFromCSV(selectedSedeForDataLoad, yearStr, sedeDataFilePlanStatus);
        setSedeDataFileEmployees(null); setSedeDataFileCourses(null);
        setSedeDataFileAssignments(null); setSedeDataFilePlanStatus(null);
    } catch (error) {
        alert(`Errore caricamento dati: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDownloadTemplate = (sede: string, year: number, type: CSVExportType) => {
    exportDataToCSV([], type as any, { sede, year: year.toString(), type });
  };
  
  const handleSetUserEncryptionKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEncryptionPassword) {
        alert("La password per la chiave di criptazione utente non può essere vuota."); return;
    }
    if (newUserEncryptionPassword !== confirmNewUserEncryptionPassword) {
        alert("Le password per la chiave di criptazione utente non coincidono."); return;
    }
    await setUserEncryptionKey(newUserEncryptionPassword);
    setNewUserEncryptionPassword('');
    setConfirmNewUserEncryptionPassword('');
  };

  const handleLoadUserEncryptionKeyFile = async () => {
    if (encryptionKeyConfigFile) {
        await loadUserEncryptionKeyFromFile(encryptionKeyConfigFile);
        setEncryptionKeyConfigFile(null); 
    } else {
        alert("Seleziona prima un file di configurazione chiave.");
    }
  };

  const handleTechGuidePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (techGuidePasswordInput === ADMIN_MAIN_PASSWORD) {
      setTechGuidePasswordVerified(true);
      setIsTechPasswordModalOpen(false);
      setActiveGuideSubSection('technical'); // Ensure technical guide is shown
    } else {
      alert("Password Admin errata per la Guida Tecnica.");
      setTechGuidePasswordVerified(false); // Ensure it's reset if wrong
    }
    setTechGuidePasswordInput(''); // Clear input regardless
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
        onClick={() => {setActiveSection(section); setActiveGuideSubSection(null);}} // Reset guide subsection when changing main section
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
        <p className="text-lg">Gestisci nomi sedi, personale chiave, caricamento dati, sicurezza e guide.</p>
      </header>

      <nav className="flex space-x-2 sm:space-x-4 border-b-2 border-gray-200 pb-4 mb-6 flex-wrap">
        <NavButton section="dataManagement" label="Gestione Dati CSV" icon={<FaFileCsv/>} />
        <NavButton section="sedi" label="Gestione Nomi Sedi" icon={<FaBuilding/>} />
        <NavButton section="personale" label="Personale Chiave" icon={<FaUserCog/>} />
        <NavButton section="security" label="Sicurezza & Audit" icon={<FaLock/>} />
        <NavButton section="guides" label="Guide" icon={<FaBook/>} />
      </nav>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-start">
          <FaInfoCircle className="text-3xl mr-4 mt-1 text-yellow-500 flex-shrink-0"/>
          <div>
            <h3 className="text-xl font-semibold mb-2">Istruzioni Fondamentali per la Gestione dei Dati</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li><strong>Struttura Cartelle (Manuale):</strong> Crea `database/` e `database/[NomeSede]/` nella root dell'app.</li>
              <li><strong>Chiave Criptazione Utente (Admin):</strong>
                <ul className="list-disc list-inside pl-5 mt-1">
                    <li>Vai su "Sicurezza & Audit" per impostare una password per la criptazione dei CSV per gli utenti non-admin. Verrà scaricato `database-encryption_key_config.csv`. Salvalo in `database/`.</li>
                    <li>All'avvio, l'admin (o un utente) può caricare questo file se la chiave non è in memoria.</li>
                </ul>
              </li>
              <li><strong>Utenti Chiave (Admin):</strong> Carica `utenti_chiave.csv` (plaintext per admin). Verrà scaricato come `database-utenti_chiave-[timestamp].csv`. Salvalo in `database/`.</li>
               <li><strong>Dati per Sede/Anno (Tutti gli utenti):</strong>
                <ul className="list-disc list-inside pl-5 mt-1">
                  <li>Aggiungi Nomi Sedi. Scarica template CSV (verranno nominati con timestamp).</li>
                  <li>Compila i template. Carica i 4 CSV (dipendenti, corsi, assegnazioni, stato piano).
                      Se la chiave utente è attiva e non sei admin, i file caricati dovrebbero essere quelli criptati precedentemente scaricati dal sistema.
                      L'admin carica/scarica sempre in chiaro.
                  </li>
                </ul>
              </li>
              <li><strong>Salvataggio Modifiche (Tutti gli utenti):</strong> Ogni modifica dati attiva download CSV (es. `database-SedeMilano-2024-corsi-[timestamp].csv`).
                  Se non sei admin e la chiave utente è attiva, il file sarà criptato.
                  **Salva questo file sovrascrivendo quello rilevante nella cartella `database/[NOME_SEDE]/` per persistere.**
              </li>
               <li><strong>Backup:</strong> Effettua regolarmente il backup dell'intera cartella `database`.</li>
            </ol>
          </div>
        </div>
      </div>

      {activeSection === 'guides' && (
        <section className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 border-b pb-3">Guide Operative</h2>
            <div className="flex space-x-4 mb-6">
                <button 
                    onClick={() => setActiveGuideSubSection('user')} 
                    className={`btn-secondary ${activeGuideSubSection === 'user' ? 'bg-primary text-white' : 'bg-gray-200'}`}
                >
                    <FaUserGraduate className="mr-2"/>Guida Utente (Non Tecnica)
                </button>
                <button 
                    onClick={openTechnicalGuide}
                    className={`btn-secondary ${activeGuideSubSection === 'technical' ? 'bg-primary text-white' : 'bg-gray-200'}`}
                >
                     <FaLockOpen className="mr-2"/>Guida Tecnica (Dettagliata)
                </button>
            </div>

            {activeGuideSubSection === 'user' && (
                <div className="prose max-w-none p-4 border rounded-md bg-sky-50 border-sky-200">
                    <h3 className="text-xl font-semibold text-sky-700">Guida Utente alla Piattaforma SIAD GxP Training</h3>
                    <p>Benvenuto! Questa guida ti aiuterà a utilizzare la piattaforma per gestire la formazione.</p>
                    
                    <h4>Flusso Operativo Generale:</h4>
                    <ol>
                        <li><strong>Selezione Sede e Anno:</strong> Utilizza i menu a tendina nella barra di navigazione in alto per scegliere la Sede e l'Anno su cui vuoi lavorare. Questa selezione è fondamentale perché tutti i dati visualizzati e modificati dipenderanno da essa.</li>
                        <li><strong>Caricamento Dati Iniziali (Principalmente per Admin):</strong>
                            <ul>
                                <li>L'Admin deve prima configurare i "Nomi Sedi" e il "Personale Chiave" (QP, Responsabili, QA) tramite il Pannello Admin.</li>
                                <li>L'Admin imposta una "Chiave di Criptazione Utente" nella sezione "Sicurezza & Audit". Questo passaggio è cruciale se utenti non-admin devono caricare/scaricare CSV criptati. Il file <code>database-encryption_key_config.csv</code> generato va salvato nella cartella <code>database/</code>.</li>
                                <li>Successivamente, l'Admin (o un utente autorizzato, se la chiave di criptazione è attiva) carica i file CSV specifici per la Sede/Anno selezionati: Dipendenti, Corsi, Assegnazioni, Stato Piano. Questi file vanno caricati dalla sezione "Gestione Dati CSV" nel Pannello Admin.</li>
                            </ul>
                        </li>
                        <li><strong>Gestione Dati:</strong>
                            <ul>
                                <li><strong>Pianificazione:</strong> Aggiungi, modifica corsi. I QP possono approvare i corsi. I Responsabili possono approvare il piano formativo annuale per la sede.</li>
                                <li><strong>Dipendenti:</strong> Aggiungi nuovi dipendenti, aggiorna i loro ruoli.</li>
                                <li><strong>Assegnazioni:</strong> Assegna i corsi approvati ai dipendenti, traccia il loro stato di completamento.</li>
                            </ul>
                        </li>
                        <li><strong>Salvataggio Modifiche (CRUCIALE!):</strong>
                            <ul>
                                <li>Ogni volta che fai una modifica che impatta i dati (es. aggiungi un corso, aggiorni uno stato), la piattaforma genererà automaticamente un file CSV aggiornato e lo scaricherà sul tuo computer.</li>
                                <li><strong>DEVI</strong> prendere questo file scaricato e salvarlo nella cartella corretta sul tuo sistema (es. <code>database/[NomeSede]/[NomeSede]_[Anno]_corsi_[timestamp].csv</code>), sovrascrivendo il file precedente se necessario. Questo è il modo in cui le modifiche diventano permanenti per le sessioni future.</li>
                                <li>Se non sei un Admin e la chiave di criptazione utente è attiva, il file scaricato sarà criptato. Quando lo ricaricherai, il sistema lo decripterà automaticamente.</li>
                            </ul>
                        </li>
                        <li><strong>Reportistica:</strong> Visualizza grafici e tabelle riassuntive sulla formazione.</li>
                    </ol>

                    <h4>Note Importanti:</h4>
                    <ul>
                        <li><strong>Struttura Cartelle:</strong> L'Admin deve assicurarsi che esista una cartella chiamata <code>database</code> nella directory principale dell'applicazione, e al suo interno, una sottocartella per ogni nome sede definito (es. <code>database/SedeMilano/</code>). È qui che i CSV vanno salvati.</li>
                        <li><strong>Login:</strong> Esiste un login Admin e un login per Utenti Chiave (QP, Responsabile, QA). Ogni ruolo ha permessi specifici.</li>
                        <li><strong>Offline:</strong> La piattaforma funziona caricando i dati dai CSV locali. Non c'è un database online centralizzato. La persistenza dei dati dipende dal corretto salvataggio dei file CSV scaricati.</li>
                    </ul>
                     <p>Per dettagli tecnici sulla crittografia o sulla gestione avanzata, consulta la Guida Tecnica (richiede password Admin).</p>
                </div>
            )}

            {activeGuideSubSection === 'technical' && (
                <div className="prose max-w-none p-4 border rounded-md bg-purple-50 border-purple-200">
                     <h3 className="text-xl font-semibold text-purple-700">Guida Tecnica Dettagliata</h3>
                    {!techGuidePasswordVerified && (
                        <div className="my-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700">
                            <FaExclamationTriangle className="inline mr-2"/>
                            Stai visualizzando la versione limitata della Guida Tecnica. Alcuni dettagli sensibili sono omessi.
                            Inserisci la password Admin corretta per visualizzare la guida completa.
                        </div>
                    )}

                    <h4>Architettura Generale e Flusso Dati:</h4>
                    <p>La piattaforma è un'applicazione React single-page che opera interamente lato client. Non utilizza un database backend tradizionale; la persistenza dei dati è affidata a file CSV gestiti localmente dall'utente e organizzati in una struttura di cartelle specifica (<code>database/[NomeSede]/</code>).</p>
                    
                    <h4>Gestione delle Password e Chiavi:</h4>
                    <ul>
                        <li><strong>Password Admin Principale:</strong> {techGuidePasswordVerified ? (<code>"{ADMIN_MAIN_PASSWORD}"</code>) : (<em>"[Visibile solo con password Admin corretta]"</em>)}. Questa password è hardcoded nell'applicazione (in <code>contexts/DataContext.tsx</code> e usata in <code>pages/AdminPage.tsx</code> per questa guida) e permette l'accesso al Pannello Admin e alla versione completa di questa guida tecnica. 
                        {techGuidePasswordVerified && <span className="font-bold text-red-600"> In un ambiente di produzione reale, questa password NON dovrebbe MAI essere hardcoded ma gestita tramite variabili d'ambiente sicure o sistemi di autenticazione robusti.</span>}
                        </li>
                        <li><strong>Chiave di Criptazione Utente (per CSV Non-Admin):</strong>
                            <ul>
                                <li>L'Admin, tramite la sezione "Sicurezza & Audit", imposta una password scelta dall'Admin stesso. Questa password scelta dall'Admin (chiamiamola `UserChosenPassword`) è destinata a diventare la base per la chiave che cripterà i CSV per gli utenti non-Admin.</li>
                                <li>La `UserChosenPassword` **NON** viene memorizzata in chiaro. Invece, viene criptata utilizzando la `Password Admin Principale` (<code>{techGuidePasswordVerified ? ADMIN_MAIN_PASSWORD : "ADMIN_PASSWORD"}</code>).</li>
                                <li>Il risultato di questa crittografia, insieme al salt e all'IV (Initialization Vector) usati, viene salvato nel file <code>database-encryption_key_config.csv</code>.
                                    {techGuidePasswordVerified ? (
                                    <span> La struttura è: <code>IV_base64</code>, <code>EncryptedUserChosenPassword_base64</code>, <code>SaltForAdminPassword_base64</code>. Questo file viene scaricato e l'admin deve salvarlo in <code>database/</code>.</span>
                                    ) : (<em>Dettagli sul formato del file omessi.</em>)}
                                </li>
                                <li>Quando un utente (o l'admin all'avvio) carica <code>database-encryption_key_config.csv</code>, l'applicazione:
                                    <ol>
                                        <li>Richiede la <code>Password Admin Principale</code> (<code>{techGuidePasswordVerified ? ADMIN_MAIN_PASSWORD : "ADMIN_PASSWORD"}</code>) per decriptare il contenuto di questo file.</li>
                                        <li>Una volta decriptato, ottiene la `UserChosenPassword` originale.</li>
                                        <li>Questa `UserChosenPassword` viene quindi utilizzata per derivare la vera e propria chiave di crittografia (`CryptoKey` object) che verrà usata per criptare/decriptare i CSV degli utenti. 
                                        {techGuidePasswordVerified ? (<span> Per questa derivazione, viene usato un **salt fisso hardcoded** (<code>"a-fixed-salt-for-user-key"</code>) definito in <code>services/cryptoService.ts</code>. Anche questo è un compromesso per la semplicità; idealmente, anche questo salt dovrebbe essere gestito diversamente.</span>) : (<em>Dettagli sul salt omessi.</em>)}
                                        </li>
                                    </ol>
                                </li>
                                 <li>Questa `CryptoKey` derivata (chiamiamola `UserActualEncryptionKey`) è quella memorizzata nello stato dell'applicazione (<code>userEncryptionKey</code> in `DataContext`) e usata per le operazioni di criptazione/decriptazione dei dati CSV per gli utenti non-admin.</li>
                            </ul>
                        </li>
                        <li><strong>Password Utenti Chiave (QP, QA, Responsabile):</strong> Memorizzate nel file `database-utenti_chiave-[timestamp].csv`. Attualmente, se l'admin carica/scarica questo file, le password sono in chiaro. Se un utente non-admin con `UserActualEncryptionKey` attiva scarica questo file, le password (e tutto il file) saranno criptate. Se un non-admin carica questo file, si aspetta che sia criptato e tenterà di decriptarlo.</li>
                    </ul>

                    <h4>Processo di Criptazione/Decriptazione CSV (per Non-Admin con Chiave Attiva):</h4>
                    <ul>
                        <li><strong>Algoritmo:</strong> AES-GCM a 256 bit.</li>
                        <li><strong>Derivazione Chiave:</strong> PBKDF2 con SHA-256 e {techGuidePasswordVerified ? "100,000" : "molte"} iterazioni.</li>
                        <li><strong>Formato Dati Criptati nel CSV:</strong> Quando un file CSV (es. `corsi.csv`) viene criptato, l'intero contenuto testuale del CSV viene prima generato, poi criptato. Il risultato è una stringa nel formato: <code>IV_in_base64:Ciphertext_in_base64</code>. Questa singola stringa costituisce l'intero contenuto del file CSV criptato.</li>
                        <li><strong>File Esclusi dalla Criptazione Utente:</strong> Il file <code>database-encryption_key_config.csv</code> non viene mai criptato con la `UserActualEncryptionKey` (è già criptato con la password admin).</li>
                    </ul>
                    
                    <h4>Flusso File CSV:</h4>
                    <ul>
                        <li><strong>Caricamento:</strong>
                            <ul>
                                <li>Admin: Carica sempre file CSV in chiaro.</li>
                                <li>Non-Admin (con chiave utente attiva): Si aspetta file CSV criptati (nel formato <code>IV:Ciphertext</code>). Il sistema tenta di decriptarli usando la `UserActualEncryptionKey`. Se la decriptazione fallisce (es. file non criptato o chiave errata in memoria), il parsing potrebbe fallire o interpretare i dati come testo normale (con risultati imprevedibili).</li>
                            </ul>
                        </li>
                        <li><strong>Salvataggio/Download:</strong>
                            <ul>
                                <li>Admin: Scarica sempre file CSV in chiaro.</li>
                                <li>Non-Admin (con chiave utente attiva): I dati vengono prima convertiti in formato CSV testuale, poi l'intera stringa CSV viene criptata (generando <code>IV:Ciphertext</code>) e questo è ciò che viene scaricato.</li>
                            </ul>
                        </li>
                        <li><strong>Nomenclatura File:</strong> I file scaricati includono Sede, Anno, Tipo e un Timestamp per aiutare nel versionamento manuale (es. <code>database-SedeMilano-2024-corsi-03AUG20231405.csv</code>). Fa eccezione <code>database-encryption_key_config.csv</code>.</li>
                    </ul>
                     <p>Questa guida fornisce una panoramica. Per i dettagli implementativi esatti, fare riferimento al codice sorgente, in particolare <code>services/cryptoService.ts</code> e <code>contexts/DataContext.tsx</code>.</p>
                </div>
            )}
        </section>
      )}

      {activeSection === 'security' && (
        <section className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 border-b pb-3">Gestione Sicurezza e Audit Log</h2>
            
            <div className="p-4 border rounded-md bg-indigo-50 border-indigo-200">
                <h3 className="text-xl font-semibold text-indigo-700 mb-2 flex items-center"><FaKey className="mr-2"/> Chiave Criptazione CSV Utenti</h3>
                <p className="text-sm text-indigo-600 mb-1">
                    Questa chiave è usata per criptare/decriptare i file CSV scaricati/caricati dagli utenti non-admin.
                    L'admin interagisce sempre con i file in chiaro.
                </p>
                <p className="text-sm text-indigo-600 mb-3">
                    Stato attuale: Chiave Utente <strong>{isUserKeySet() ? "IMPOSTATA" : "NON IMPOSTATA"}</strong>.
                </p>

                <form onSubmit={handleSetUserEncryptionKey} className="space-y-3 mb-4 p-3 border-t pt-3">
                    <h4 className="font-medium text-indigo-700">Imposta Nuova Chiave Criptazione Utente:</h4>
                    <div>
                        <label htmlFor="newUserEncryptionPassword">Password per la Chiave Utente:</label>
                        <input type="password" id="newUserEncryptionPassword" value={newUserEncryptionPassword} onChange={e => setNewUserEncryptionPassword(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label htmlFor="confirmNewUserEncryptionPassword">Conferma Password:</label>
                        <input type="password" id="confirmNewUserEncryptionPassword" value={confirmNewUserEncryptionPassword} onChange={e => setConfirmNewUserEncryptionPassword(e.target.value)} className="input-field" />
                    </div>
                    <button type="submit" className="btn-primary bg-indigo-600 hover:bg-indigo-700">Imposta e Scarica Config. Chiave</button>
                </form>
                
                <div className="p-3 border-t pt-3">
                    <h4 className="font-medium text-indigo-700">Carica Configurazione Chiave Utente Esistente:</h4>
                    <p className="text-xs text-indigo-500 mb-2">Carica il file `database-encryption_key_config.csv` precedentemente salvato.</p>
                    <FileUpload 
                        onFileUpload={(file) => setEncryptionKeyConfigFile(file)}
                        label="Carica File Config. Chiave (.csv)"
                        acceptedFileType=".csv"
                    />
                    {encryptionKeyConfigFile && (
                        <button onClick={handleLoadUserEncryptionKeyFile} className="mt-2 btn-secondary">
                            Processa File Configurazione Chiave
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 border rounded-md bg-teal-50 border-teal-200">
                 <h3 className="text-xl font-semibold text-teal-700 mb-2 flex items-center"><FaClipboardList className="mr-2"/> Audit Log</h3>
                 <p className="text-sm text-teal-600 mb-3">Scarica il log delle attività del sistema.</p>
                 <button onClick={downloadAuditLog} className="btn-primary bg-teal-600 hover:bg-teal-700">
                    <FaDownload className="mr-2"/> Scarica Audit Log
                 </button>
            </div>
        </section>
      )}

      {activeSection === 'dataManagement' && (
        <section className="bg-white p-6 rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 border-b pb-3">Caricamento Dati CSV Annuali</h2>
            {!isUserKeySet() && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                    <FaExclamationTriangle className="inline mr-1"/> Attenzione: la chiave di criptazione utente non è impostata. I file CSV per gli utenti non-admin non saranno criptati.
                    Impostala in "Sicurezza & Audit".
                </p>
            )}
            <div className="p-4 border rounded-md bg-blue-50 border-blue-200">
                <h3 className="text-xl font-semibold text-blue-700 mb-2">Utenti Chiave (Globale)</h3>
                <p className="text-sm text-blue-600 mb-3">Carica <code>utenti_chiave.csv</code>. Scaricato come `database-utenti_chiave-[timestamp].csv`.</p>
                <FileUpload 
                    onFileUpload={(file) => loadKeyPersonnelFromMasterCSV(file)} 
                    label="Carica CSV Utenti Chiave" 
                    acceptedFileType=".csv" 
                />
            </div>

            <div className="p-4 border rounded-md bg-green-50 border-green-200">
                <h3 className="text-xl font-semibold text-green-700 mb-2">Dati Sede per Anno Specifico</h3>
                <p className="text-sm text-green-600 mb-3">
                    Seleziona Sede/Anno, poi carica i 4 file CSV. I nomi file scaricati avranno timestamp.
                </p>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="adminSedeSelect" className="block text-sm font-medium text-gray-700 mb-1">Sede:</label>
                        <select id="adminSedeSelect" value={selectedSedeForDataLoad || ''} onChange={(e) => setSelectedSedeForDataLoad(e.target.value || null)} className="input-field bg-white">
                            <option value="" disabled>-- Seleziona Sede --</option>
                            {sedi.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="adminYearSelect" className="block text-sm font-medium text-gray-700 mb-1">Anno:</label>
                         <input type="number" id="adminYearSelect" placeholder="Es. 2024" value={selectedYearForDataLoad || ''} onChange={(e) => setSelectedYearForDataLoad(e.target.value ? parseInt(e.target.value) : null)} className="input-field" />
                    </div>
                </div>

                {selectedSedeForDataLoad && selectedYearForDataLoad && (
                    <>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <FileUpload onFileUpload={(file) => setSedeDataFileEmployees(file)} label={`Dipendenti`} acceptedFileType=".csv"/>
                            <FileUpload onFileUpload={(file) => setSedeDataFileCourses(file)} label={`Corsi`} acceptedFileType=".csv"/>
                            <FileUpload onFileUpload={(file) => setSedeDataFileAssignments(file)} label={`Assegnazioni`} acceptedFileType=".csv"/>
                            <FileUpload onFileUpload={(file) => setSedeDataFilePlanStatus(file)} label={`Stato Piano`} acceptedFileType=".csv"/>
                        </div>
                        <button 
                            onClick={handleLoadSedeDataAll}
                            disabled={!sedeDataFileEmployees || !sedeDataFileCourses || !sedeDataFileAssignments || !sedeDataFilePlanStatus}
                            className="mt-4 btn-primary bg-success hover:bg-green-700 disabled:bg-gray-400"
                        >
                            <FaUpload className="mr-2"/> Carica Dati per {selectedSedeForDataLoad} / {selectedYearForDataLoad}
                        </button>
                    </>
                )}
                 {(!selectedSedeForDataLoad || !selectedYearForDataLoad) && <p className="text-xs text-red-500 mt-1">Seleziona sede e anno.</p>}
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
              {sedi.map(sedeName => (
                <li key={sedeName} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 rounded-md border">
                  <span className="text-gray-700 font-medium mb-2 sm:mb-0">{sedeName}</span>
                  <div className='space-y-2 sm:space-y-0 sm:space-x-2'>
                     <div className="flex flex-wrap gap-2">
                        {(['employees', 'courses', 'assignments', 'planStatus'] as CSVExportType[]).map(type => (
                            (type !== 'keyPersonnel' && type !== 'auditTrail' && type !== 'encryptionKeyConfig') && 
                            <button 
                                key={type}
                                onClick={() => handleDownloadTemplate(sedeName, currentYear || new Date().getFullYear(), type)}
                                className="text-xs btn-secondary py-1 px-2 flex items-center"
                                title={`Scarica template ${type}`}
                            > <FaDownload className="mr-1"/> Template {type} </button>
                        ))}
                    </div>
                    <button onClick={() => {setCurrentSede(sedeName); setSelectedSedeForDataLoad(sedeName); setActiveSection('dataManagement');}} className="text-sm text-primary hover:text-green-700">Gestisci CSV</button>
                    <button onClick={() => removeSede(sedeName)} className="text-danger hover:text-red-700 p-1"><FaTrash size={18}/></button>
                  </div>
                </li>
              ))}
            </ul>
          ) : ( <p className="text-gray-500 text-center py-4">Nessun nome sede definito.</p> )}
        </section>
      )}

      {activeSection === 'personale' && (
        <section className="bg-white p-6 rounded-lg shadow-md">
           <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Personale Chiave</h2>
            <button onClick={() => openPersonnelModal()} className="btn-primary"> <FaPlusCircle className="mr-2" /> Aggiungi </button>
          </div>
          {keyPersonnelList.length === 0 && <p className="text-sm text-gray-600 mb-3">Carica `utenti_chiave.csv` da "Gestione Dati CSV".</p>}
          {keyPersonnelList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr><th className="th-cell">Nome</th><th className="th-cell">Ruolo</th><th className="th-cell">Azioni</th></tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {keyPersonnelList.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="td-cell font-medium">{p.name}</td><td className="td-cell">{p.role}</td>
                            <td className="td-cell space-x-3">
                                <button onClick={() => openPersonnelModal(p)} className="text-primary hover:text-green-700" title="Modifica"><FaEdit/></button>
                                <button onClick={() => removeKeyPersonnel(p.id)} className="text-danger hover:text-red-700" title="Rimuovi"><FaTrash/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : ( <p className="text-gray-500 text-center py-4">Nessun personale chiave.</p> )}
        </section>
      )}

      {/* Modal for Sede */}
      <Modal isOpen={isSedeModalOpen} onClose={() => setIsSedeModalOpen(false)} title="Aggiungi Nome Nuova Sede">
        <form onSubmit={handleAddSede} className="space-y-4">
          <div>
            <label htmlFor="newSedeName" className="block text-sm font-medium text-gray-700">Nome Sede</label>
            <input type="text" id="newSedeName" value={newSedeName} onChange={(e) => setNewSedeName(e.target.value)} className="input-field" required />
          </div>
          <div className="flex justify-end pt-2"><button type="submit" className="btn-primary">Aggiungi</button></div>
        </form>
      </Modal>

      {/* Modal for Personnel */}
      <Modal isOpen={isPersonnelModalOpen} onClose={() => setIsPersonnelModalOpen(false)} title={editingPersonnel ? "Modifica Personale" : "Aggiungi Personale"}>
        <form onSubmit={handleSavePersonnel} className="space-y-4">
            <div><label htmlFor="personnelName">Nome</label><input type="text" name="name" id="personnelName" value={personnelFormData.name} onChange={handlePersonnelFormChange} required className="input-field" /></div>
            <div><label htmlFor="personnelRole">Ruolo</label>
                <select name="role" id="personnelRole" value={personnelFormData.role} onChange={handlePersonnelFormChange} required className="input-field bg-white">
                    {(['QP', 'QA', 'Responsabile', 'Admin'] as KeyPersonnelRole[]).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
             <div><label htmlFor="personnelPassword">Password {editingPersonnel ? "(lascia vuoto per non cambiare)" : ""}</label><input type="password" name="password" id="personnelPassword" value={personnelFormData.password} onChange={handlePersonnelFormChange} required={!editingPersonnel} className="input-field" /></div>
             <div><label htmlFor="personnelConfirmPassword">Conferma Password</label><input type="password" name="confirmPassword" id="personnelConfirmPassword" value={personnelFormData.confirmPassword || ''} onChange={handlePersonnelFormChange} required={!editingPersonnel || !!personnelFormData.password} className="input-field" /></div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsPersonnelModalOpen(false)} className="btn-secondary">Annulla</button>
                <button type="submit" className="btn-primary">{editingPersonnel ? "Salva" : "Aggiungi"}</button>
            </div>
        </form>
      </Modal>

      {/* Modal for Technical Guide Password */}
        <Modal isOpen={isTechPasswordModalOpen} onClose={() => setIsTechPasswordModalOpen(false)} title="Accesso Guida Tecnica">
            <form onSubmit={handleTechGuidePasswordSubmit} className="space-y-4">
                <div>
                    <label htmlFor="techGuidePasswordInput" className="block text-sm font-medium text-gray-700">Password Admin</label>
                    <input
                        type="password"
                        id="techGuidePasswordInput"
                        value={techGuidePasswordInput}
                        onChange={(e) => setTechGuidePasswordInput(e.target.value)}
                        className="input-field"
                        required
                    />
                </div>
                <button type="submit" className="w-full btn-primary">Accedi alla Guida Tecnica</button>
            </form>
        </Modal>

       <style>{`
        .th-cell { @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider; }
        .td-cell { @apply px-6 py-4 whitespace-nowrap text-sm; }
        .input-field { @apply mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-gray-900 bg-white; }
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