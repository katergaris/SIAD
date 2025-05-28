
import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { 
    Employee, TrainingCourse, TrainingAssignment, AssignmentStatus, TrainingCourseStatus, 
    EmployeeCSVRow, CourseCSVRow, PlanStatusCSVRow, YearlySedeData, SedeSpecificData, BatchAssignmentPayload,
    KeyPersonnel, PlanStatus, CourseApproval, PlanApproval, DataContextType, CSVExportType,
    AuditEntry, LogAction, EncryptedKeyConfig, AuditLogCSVRow, KeyPersonnelRole
} from '../types';
import { parseCSV } from '../services/csvParser';
import { exportDataToCSV } from '../services/csvExporter';
import { createUserEncryptionKeyConfig, getUserKeyFromConfig, encryptTextForCSV, decryptTextFromCSV } from '../services/cryptoService';
import { getFormattedTimestamp } from '../utils/timestamp';

const ADMIN_PASSWORD = "40sub3"; // Hardcoded Admin password for encrypting/decrypting the user key config

const DataContext = createContext<DataContextType | undefined>(undefined);

const getInitialSedeSpecificData = (): SedeSpecificData => ({
  employees: [],
  courses: [],
  assignments: [],
  planStatus: PlanStatus.BOZZA,
  planApprovals: [],
});

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sedi, setSedi] = useState<string[]>(() => {
    const savedSedi = sessionStorage.getItem('sedi');
    return savedSedi ? JSON.parse(savedSedi) : [];
  });
  const [yearlySedeData, setYearlySedeData] = useState<YearlySedeData>({});
  const [keyPersonnelList, setKeyPersonnelList] = useState<KeyPersonnel[]>([]);
  
  const [currentSede, setCurrentSedeState] = useState<string | null>(() => sessionStorage.getItem('currentSede') || null);
  const [currentYear, setCurrentYearState] = useState<number | null>(() => {
    const savedYear = sessionStorage.getItem('currentYear');
    return savedYear ? parseInt(savedYear) : new Date().getFullYear();
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [currentKeyPersonnel, setCurrentKeyPersonnel] = useState<KeyPersonnel | null>(() => {
    const saved = sessionStorage.getItem('currentKeyPersonnel');
    return saved ? JSON.parse(saved) : null;
  });

  const [userEncryptionKey, setUserEncryptionKeyState] = useState<CryptoKey | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  // Persist basic navigation and auth state
  useEffect(() => { sessionStorage.setItem('sedi', JSON.stringify(sedi)); }, [sedi]);
  useEffect(() => { if(currentSede) sessionStorage.setItem('currentSede', currentSede); else sessionStorage.removeItem('currentSede'); }, [currentSede]);
  useEffect(() => { if(currentYear) sessionStorage.setItem('currentYear', currentYear.toString()); else sessionStorage.removeItem('currentYear'); }, [currentYear]);
  useEffect(() => { if(currentKeyPersonnel) sessionStorage.setItem('currentKeyPersonnel', JSON.stringify(currentKeyPersonnel)); else sessionStorage.removeItem('currentKeyPersonnel'); }, [currentKeyPersonnel]);

  const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).substring(2);

  const addAuditLogEntry = useCallback((action: LogAction, details: string, overrideSede: string | null = null, overrideYear: number | null = null) => {
    const entry: AuditEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      userId: isAdminAuthenticated ? 'ADMIN' : currentKeyPersonnel?.id,
      userName: isAdminAuthenticated ? 'ADMIN' : currentKeyPersonnel?.name,
      userRole: isAdminAuthenticated ? 'ADMIN_ROLE' : currentKeyPersonnel?.role,
      action,
      details,
      sede: overrideSede !== null ? overrideSede : currentSede,
      year: overrideYear !== null ? overrideYear : currentYear,
    };
    setAuditLog(prevLog => [...prevLog, entry]);
    console.log(`Audit Log: ${action} - ${details}`);
  }, [currentSede, currentYear, isAdminAuthenticated, currentKeyPersonnel]);
  
  const downloadAuditLog = useCallback(() => {
    if (!isAdminAuthenticated && currentKeyPersonnel?.role !== 'Admin') {
      alert("Azione non autorizzata.");
      return;
    }
    exportDataToCSV(auditLog, 'auditTrail', { globalType: 'auditTrail' });
    addAuditLogEntry(LogAction.DATA_DOWNLOAD, "Audit trail scaricato");
  }, [auditLog, isAdminAuthenticated, currentKeyPersonnel, addAuditLogEntry]);

  const setUserEncryptionKey = useCallback(async (passwordForUserKey: string) => {
    if (!isAdminAuthenticated) {
      alert("Solo l'admin può impostare la chiave di criptazione.");
      return;
    }
    try {
      const config = await createUserEncryptionKeyConfig(passwordForUserKey, ADMIN_PASSWORD);
      const derivedUserKey = await getUserKeyFromConfig(config, ADMIN_PASSWORD); // Test derivation
      if (!derivedUserKey) throw new Error("Failed to derive user key for validation.");

      setUserEncryptionKeyState(derivedUserKey); // Set the derived key for current session use if needed
      exportDataToCSV([config], 'encryptionKeyConfig', { globalType: 'encryptionKeyConfig' });
      addAuditLogEntry(LogAction.ENCRYPTION_KEY_SET, "Nuova chiave di criptazione utente impostata e file di configurazione scaricato.");
      alert("Chiave di criptazione utente impostata. Il file 'database-encryption_key_config.csv' è stato scaricato. Conservalo in un luogo sicuro (es. cartella 'database').");
    } catch (error) {
      console.error("Errore durante l'impostazione della chiave di criptazione utente:", error);
      alert(`Errore: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [isAdminAuthenticated, addAuditLogEntry]);

  const loadUserEncryptionKeyFromFile = useCallback(async (file: File) => {
    if (!isAdminAuthenticated && !currentKeyPersonnel) { // Allow any logged-in user to trigger load, but only admin sets it
        alert("Devi essere loggato per caricare la configurazione della chiave.");
        return;
    }
    try {
      const parsed = await parseCSV<EncryptedKeyConfig>(file, (headers) => (rowValues) => {
        const row = headers.reduce((obj, header, index) => { (obj as any)[header] = rowValues[index]; return obj; }, {} as any);
        return row as EncryptedKeyConfig;
      });
      if (parsed.length === 0 || !parsed[0].iv || !parsed[0].encryptedKeyData || !parsed[0].salt) {
        throw new Error("File di configurazione chiave non valido o vuoto.");
      }
      const config = parsed[0];
      const derivedUserKey = await getUserKeyFromConfig(config, ADMIN_PASSWORD);
      if (!derivedUserKey) {
        throw new Error("Impossibile derivare la chiave utente dalla configurazione. Password admin errata o file corrotto?");
      }
      setUserEncryptionKeyState(derivedUserKey);
      addAuditLogEntry(LogAction.ENCRYPTION_KEY_LOADED, `Configurazione chiave di criptazione utente caricata da ${file.name}.`);
      alert("Configurazione chiave di criptazione utente caricata con successo.");
    } catch (error) {
      console.error("Errore durante il caricamento della configurazione della chiave:", error);
      setUserEncryptionKeyState(null); // Clear key on error
      alert(`Errore caricamento configurazione chiave: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [addAuditLogEntry, currentKeyPersonnel, isAdminAuthenticated]);
  
  const isUserKeySet = useCallback(() => !!userEncryptionKey, [userEncryptionKey]);

  const availableYears = useCallback(() => {
    const yearsFromData = Object.keys(yearlySedeData).map(y => parseInt(y));
    if (currentYear && !yearsFromData.includes(currentYear)) {
      yearsFromData.push(currentYear);
    }
    const uniqueYears = Array.from(new Set(yearsFromData));
    return uniqueYears.length > 0 ? uniqueYears.sort((a,b) => b - a) : [new Date().getFullYear()];
  }, [yearlySedeData, currentYear]);


  const loadKeyPersonnelFromMasterCSV = useCallback(async (file: File) => {
    try {
      const keyForParsing = !isAdminAuthenticated && userEncryptionKey ? userEncryptionKey : null;
      const parsedPersonnel = await parseCSV<KeyPersonnel>(file, (headers) => (rowValues) => {
        const row = headers.reduce((obj, header, index) => {
          (obj as any)[header] = rowValues[index];
          return obj;
        }, {} as any);
        if (!row.id || !row.name || !row.role || !row.password) { 
            console.warn(`Riga CSV utenti chiave malformata (o password mancante se in chiaro): ${rowValues.join(',')}`);
        }
        return row as KeyPersonnel;
      }, keyForParsing);
      setKeyPersonnelList(parsedPersonnel);
      addAuditLogEntry(LogAction.DATA_UPLOAD, `Caricato ${file.name} (${parsedPersonnel.length} utenti chiave).`, null, null);
      alert(`${parsedPersonnel.length} utenti chiave caricati.`);
    } catch (error) {
      console.error("Errore caricamento CSV utenti chiave:", error);
      alert(`Errore caricamento CSV utenti chiave: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [addAuditLogEntry, userEncryptionKey, isAdminAuthenticated]);

  const loadSedeDataFromCSV = useCallback(async (sedeName: string, year: string, type: 'employees' | 'courses' | 'assignments', file: File) => {
    if (!sedi.includes(sedeName)) { alert(`Sede "${sedeName}" non trovata.`); return; }
    if (!year) { alert("Anno non specificato."); return; }
    try {
        let alertMessage = "";
        const keyForParsing = !isAdminAuthenticated && userEncryptionKey ? userEncryptionKey : null;
        await new Promise<void>((resolve, reject) => { 
            setYearlySedeData(prevYSD => {
                const yearData = prevYSD[year] || {};
                const sedeSpecific = yearData[sedeName] || getInitialSedeSpecificData();
                let updatedSedeSpecific = { ...sedeSpecific };

                if (type === 'employees') {
                    parseCSV<EmployeeCSVRow>(file, (headers) => (rowValues) => {
                        const row = headers.reduce((obj, header, index) => { (obj as any)[header] = rowValues[index]; return obj; }, {} as any);
                         if (!row.id || !row.name || !row.initialRole || !row.initialRoleStartDate) {
                            throw new Error(`Riga CSV dipendente malformata: ${rowValues.join(',')}.`);
                         }
                        return row as EmployeeCSVRow;
                    }, keyForParsing).then(parsed => {
                        const newEmployees: Employee[] = parsed.map(empCsv => ({
                            id: empCsv.id, name: empCsv.name, currentRole: empCsv.initialRole,
                            roleHistory: [{ role: empCsv.initialRole, startDate: empCsv.initialRoleStartDate, endDate: null }],
                        }));
                        updatedSedeSpecific.employees = newEmployees;
                        alertMessage = `${newEmployees.length} dipendenti caricati.`;
                        resolve();
                    }).catch(reject);
                } else if (type === 'courses') {
                    parseCSV<CourseCSVRow>(file, (headers) => (rowValues) => {
                        const row = headers.reduce((obj, header, index) => { (obj as any)[header] = rowValues[index]; return obj; }, {} as any);
                        if (!row.id || !row.name || !row.date || !row.durationHours) { 
                             throw new Error(`Riga CSV corso malformata: ${rowValues.join(',')}.`);
                        }
                        // Handle approvals parsing if it's a JSON string
                        if (row.approvals && typeof row.approvals === 'string') {
                            try {
                                row.approvals = JSON.parse(row.approvals);
                            } catch (e) {
                                console.warn(`Could not parse approvals string for course ${row.id}: ${row.approvals}`);
                                row.approvals = [];
                            }
                        } else if (!row.approvals) {
                            row.approvals = [];
                        }
                        return row as CourseCSVRow;
                    }, keyForParsing).then(parsed => {
                        const newCourses: TrainingCourse[] = parsed.map(c => ({
                            id: c.id, name: c.name, description: c.description, date: c.date, 
                            durationHours: parseInt(c.durationHours), category: c.category, 
                            status: c.status || TrainingCourseStatus.BOZZA,
                            approvals: c.approvals || [] 
                        }));
                        updatedSedeSpecific.courses = newCourses;
                        alertMessage = `${newCourses.length} corsi caricati.`;
                        resolve();
                    }).catch(reject);
                } else if (type === 'assignments') {
                     parseCSV<TrainingAssignment>(file, (headers) => (rowValues) => {
                         const row = headers.reduce((obj, header, index) => { (obj as any)[header] = rowValues[index]; return obj; }, {} as any);
                         if (!row.id || !row.employeeId || !row.courseId || !row.assignmentDate || !row.completionStatus) {
                             throw new Error(`Riga CSV assegnazione malformata: ${rowValues.join(',')}.`);
                         }
                         row.score = row.score ? parseFloat(row.score) : null;
                         return row as TrainingAssignment;
                    }, keyForParsing).then(parsed => {
                        updatedSedeSpecific.assignments = parsed;
                        alertMessage = `${parsed.length} assegnazioni caricate.`;
                        resolve();
                    }).catch(reject);
                }
                return { ...prevYSD, [year]: { ...yearData, [sedeName]: updatedSedeSpecific }};
            });
        });
        
        if (alertMessage) {
            addAuditLogEntry(LogAction.DATA_UPLOAD, `Caricato ${file.name} (${alertMessage}) per ${sedeName}/${year}.`, sedeName, parseInt(year));
            alert(alertMessage + ` per ${sedeName}/${year}.`);
        }

    } catch (error) {
        console.error(`Errore caricamento CSV ${type} per ${sedeName}/${year}:`, error);
        alert(`Errore caricamento CSV ${type} per ${sedeName}/${year}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [sedi, addAuditLogEntry, userEncryptionKey, isAdminAuthenticated]);

  const loadSedePlanStatusFromCSV = useCallback(async (sedeName: string, year: string, file: File) => {
     if (!sedi.includes(sedeName) || !year) { alert(`Sede "${sedeName}" o anno "${year}" non validi.`); return; }
    try {
        const keyForParsing = !isAdminAuthenticated && userEncryptionKey ? userEncryptionKey : null;
        const parsedPlanStatus = await parseCSV<PlanStatusCSVRow>(file, (headers) => (rowValues) => {
            const row = headers.reduce((obj, header, index) => { (obj as any)[header] = rowValues[index]; return obj; }, {} as any);
            if (!row.planStatus) {
                throw new Error(`Riga CSV stato piano malformata: ${rowValues.join(',')}. Manca planStatus.`);
            }
            return row as PlanStatusCSVRow;
        }, keyForParsing);

        if (parsedPlanStatus.length === 0) {
            alert(`File CSV stato piano per ${sedeName}/${year} è vuoto o non contiene dati validi.`);
            setYearlySedeData(prevYSD => {
                const yearData = prevYSD[year] || {};
                const sedeSpecific = yearData[sedeName] || getInitialSedeSpecificData();
                return { ...prevYSD, [year]: { ...yearData, [sedeName]: {...sedeSpecific, planStatus: PlanStatus.BOZZA, planApprovals: []} }};
            });
            return;
        }
        
        const planData = parsedPlanStatus[0]; 
        const newApprovals: PlanApproval[] = [];
        if (planData.responsabileId && planData.responsabileName && planData.approvalDate) {
            newApprovals.push({
                responsabileId: planData.responsabileId,
                responsabileName: planData.responsabileName,
                approvalDate: planData.approvalDate
            });
        }

        setYearlySedeData(prevYSD => {
            const yearData = prevYSD[year] || {};
            const sedeSpecific = yearData[sedeName] || getInitialSedeSpecificData();
            return { ...prevYSD, [year]: { ...yearData, [sedeName]: {
                ...sedeSpecific,
                planStatus: planData.planStatus,
                planApprovals: newApprovals
            } }};
        });
        addAuditLogEntry(LogAction.DATA_UPLOAD, `Caricato ${file.name} (stato piano) per ${sedeName}/${year}.`, sedeName, parseInt(year));
        alert(`Stato piano per ${sedeName}/${year} caricato.`);

    } catch (error) {
        console.error(`Errore caricamento CSV stato piano per ${sedeName}/${year}:`, error);
        alert(`Errore caricamento CSV stato piano per ${sedeName}/${year}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [sedi, addAuditLogEntry, userEncryptionKey, isAdminAuthenticated]);


  const triggerDataExport = useCallback((
    dataToExport: any[],
    exportType: CSVExportType,
    filenameElements: { sede?: string, year?: string, type: CSVExportType } | { globalType: 'keyPersonnel' | 'auditTrail' | 'encryptionKeyConfig' },
    keyForEncryptionParam?: CryptoKey | null // Renamed to avoid conflict with component-level keyForEncryption
  ) => {
    const actualKeyForEncryption = !isAdminAuthenticated && userEncryptionKey ? userEncryptionKey : null;
    exportDataToCSV(dataToExport, exportType, filenameElements, keyForEncryptionParam !== undefined ? keyForEncryptionParam : actualKeyForEncryption);
    
    let sedeForLog: string | null | undefined = null;
    let yearForLog: number | null | undefined = null;
    if ('sede' in filenameElements && filenameElements.sede) sedeForLog = filenameElements.sede;
    if ('year' in filenameElements && filenameElements.year) yearForLog = parseInt(filenameElements.year);
    
    addAuditLogEntry(LogAction.DATA_DOWNLOAD, `Esportato ${exportType}.`, sedeForLog, yearForLog);
  }, [isAdminAuthenticated, userEncryptionKey, addAuditLogEntry]);


  const modifySedeYearDataAndExport = (
    sedeNameToModify: string,
    yearToModify: string,
    updateFn: (data: SedeSpecificData) => SedeSpecificData,
    exportType: 'employees' | 'courses' | 'assignments' | 'planStatus'
  ) => {
    if (!sedeNameToModify || !yearToModify) {
        console.warn("Tentativo di modificare dati per una sede o anno non specificati.");
        alert("Sede o anno non specificati. Impossibile salvare le modifiche.");
        return;
    }
    
    let dataToExport: any;
    let finalSedeSpecificData: SedeSpecificData | undefined;

    setYearlySedeData(prevYSD => {
        const currentYearData = prevYSD[yearToModify] || {};
        const currentSedeDataInYear = currentYearData[sedeNameToModify] || getInitialSedeSpecificData();
        const updatedSedeSpecificData = updateFn(currentSedeDataInYear);
        finalSedeSpecificData = updatedSedeSpecificData;
        
        if (exportType === 'employees') dataToExport = updatedSedeSpecificData.employees;
        else if (exportType === 'courses') dataToExport = updatedSedeSpecificData.courses;
        else if (exportType === 'assignments') dataToExport = updatedSedeSpecificData.assignments;
        else if (exportType === 'planStatus') {
             dataToExport = [{
                planStatus: updatedSedeSpecificData.planStatus,
                responsabileId: updatedSedeSpecificData.planApprovals?.[0]?.responsabileId,
                responsabileName: updatedSedeSpecificData.planApprovals?.[0]?.responsabileName,
                approvalDate: updatedSedeSpecificData.planApprovals?.[0]?.approvalDate,
            }];
        }

        return {
            ...prevYSD,
            [yearToModify]: {
                ...currentYearData,
                [sedeNameToModify]: updatedSedeSpecificData,
            }
        };
    });

    setTimeout(() => { 
        if (dataToExport && finalSedeSpecificData) {
           triggerDataExport(dataToExport, exportType, { sede: sedeNameToModify, year: yearToModify, type: exportType });
        } else {
            console.warn(`Nessun dato da esportare per tipo ${exportType} per ${sedeNameToModify}/${yearToModify}`);
        }
    }, 100); 
  };
  
  const setCurrentSede = (name: string | null) => {
    if (name && !sedi.includes(name)) {
        alert(`Sede "${name}" non presente. Aggiungila prima in Admin.`);
        setCurrentSedeState(null); 
        return;
    }
    setCurrentSedeState(name);
    if (name && currentYear) {
        const dataExists = yearlySedeData[currentYear] && yearlySedeData[currentYear][name];
        const isEffectivelyEmpty = dataExists && 
                                   yearlySedeData[currentYear][name].employees.length === 0 &&
                                   yearlySedeData[currentYear][name].courses.length === 0 &&
                                   yearlySedeData[currentYear][name].assignments.length === 0;
      if (!dataExists || isEffectivelyEmpty) {
         alert(`Sede "${name}" / Anno "${currentYear}" selezionati. Ricorda di caricare i file CSV dalla sezione Admin.`);
      }
    }
  };

  const setCurrentYear = (year: number | null) => {
    setCurrentYearState(year);
    if (currentSede && year) {
      const dataExists = yearlySedeData[year] && yearlySedeData[year][currentSede];
      const isEffectivelyEmpty = dataExists && 
                                 yearlySedeData[year][currentSede].employees.length === 0 &&
                                 yearlySedeData[year][currentSede].courses.length === 0 &&
                                 yearlySedeData[year][currentSede].assignments.length === 0;
      if (!dataExists || isEffectivelyEmpty) {
         alert(`Anno "${year}" / Sede "${currentSede}" selezionati. Ricorda di caricare i file CSV dalla sezione Admin.`);
      }
    }
  }


  const addSede = useCallback((name: string): boolean => {
    if (sedi.includes(name) || !name.trim()) {
      alert("Nome sede già esistente o non valido."); return false;
    }
    const trimmedName = name.trim();
    setSedi(prevSedi => [...prevSedi, trimmedName]);
    if (!currentSede) setCurrentSedeState(trimmedName);
    addAuditLogEntry(LogAction.ADD_SEDE, `Aggiunto nome sede: ${trimmedName}`);
    alert(`Nome sede "${trimmedName}" aggiunto. Ricorda di creare manualmente la cartella 'database/${trimmedName}'.`);
    return true;
  }, [sedi, currentSede, addAuditLogEntry]);

  const removeSede = useCallback((name: string) => {
    if (!window.confirm(`Rimuovere il nome sede "${name}"? Non cancellerà i file CSV.`)) return;
    setSedi(prevSedi => prevSedi.filter(s => s !== name));
    setYearlySedeData(prevYSD => {
        const newYSD = {...prevYSD};
        Object.keys(newYSD).forEach(year => { if (newYSD[year][name]) delete newYSD[year][name]; });
        return newYSD;
    });
    if (currentSede === name) setCurrentSedeState(sedi.length > 1 ? sedi.filter(s => s !== name)[0] : null);
    addAuditLogEntry(LogAction.REMOVE_SEDE, `Rimosso nome sede: ${name}`);
    alert(`Nome sede "${name}" rimosso dalla sessione.`);
  }, [sedi, currentSede, addAuditLogEntry]); 

  const loginAdmin = useCallback((password: string): boolean => {
    if (password === ADMIN_PASSWORD) { 
      setIsAdminAuthenticated(true); 
      addAuditLogEntry(LogAction.ADMIN_LOGIN, "Admin loggato.");
      return true; 
    }
    alert("Password admin errata."); return false;
  }, [addAuditLogEntry]);
  const logoutAdmin = useCallback(() => { 
    setIsAdminAuthenticated(false); 
    addAuditLogEntry(LogAction.ADMIN_LOGOUT, "Admin sloggato.");
  }, [addAuditLogEntry]);

  const loginKeyPersonnel = useCallback((name: string, passwordPlain: string): boolean => {
    const personnel = keyPersonnelList.find(p => p.name === name);
    if (personnel && personnel.password === passwordPlain) { // Password check in plaintext as per current setup
      setCurrentKeyPersonnel(personnel); 
      addAuditLogEntry(LogAction.LOGIN, `Utente ${name} (${personnel.role}) loggato.`);
      return true; 
    }
    alert("Nome utente o password errati."); return false;
  }, [keyPersonnelList, addAuditLogEntry]);

  const logoutKeyPersonnel = useCallback(() => { 
    if(currentKeyPersonnel) addAuditLogEntry(LogAction.LOGOUT, `Utente ${currentKeyPersonnel.name} sloggato.`);
    setCurrentKeyPersonnel(null); 
  }, [addAuditLogEntry, currentKeyPersonnel]);

  const addKeyPersonnel = useCallback((personnelData: Omit<KeyPersonnel, 'id'>): boolean => {
    if (keyPersonnelList.find(p => p.name === personnelData.name)) {
        alert("Un utente con questo nome esiste già."); return false;
    }
    const newPersonnel: KeyPersonnel = { id: generateId(), ...personnelData };
    const updatedList = [...keyPersonnelList, newPersonnel];
    setKeyPersonnelList(updatedList);
    triggerDataExport(updatedList, 'keyPersonnel', { globalType: 'keyPersonnel' });
    addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Aggiunto utente chiave: ${newPersonnel.name} (${newPersonnel.role})`);
    return true;
  }, [keyPersonnelList, triggerDataExport, addAuditLogEntry]);

  const updateKeyPersonnel = useCallback((personnelId: string, updates: Partial<Omit<KeyPersonnel, 'id' | 'password'>> & {newPassword?:string}): boolean => {
    let updatedList: KeyPersonnel[] = [];
    setKeyPersonnelList(prevList => {
        updatedList = prevList.map(p => {
            if (p.id === personnelId) {
                const { newPassword, ...otherUpdates } = updates;
                return { ...p, ...otherUpdates, password: newPassword || p.password };
            }
            return p;
        });
        return updatedList;
    });
    triggerDataExport(updatedList, 'keyPersonnel', { globalType: 'keyPersonnel' });
    if (currentKeyPersonnel?.id === personnelId) {
       const userInUpdatedList = updatedList.find(p=>p.id === personnelId);
       if(userInUpdatedList) setCurrentKeyPersonnel(userInUpdatedList);
    }
    const name = updatedList.find(p=>p.id === personnelId)?.name || personnelId;
    addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Aggiornato utente chiave: ${name}`);
    return true;
  }, [keyPersonnelList, currentKeyPersonnel, triggerDataExport, addAuditLogEntry]); // Removed keyPersonnelList from dependencies as setKeyPersonnelList handles it

  const removeKeyPersonnel = useCallback((personnelId: string) => {
    if (!window.confirm("Rimuovere questo utente chiave?")) return;
    const personnelToRemove = keyPersonnelList.find(p => p.id === personnelId);
    const updatedList = keyPersonnelList.filter(p => p.id !== personnelId);
    setKeyPersonnelList(updatedList);
    if (currentKeyPersonnel?.id === personnelId) logoutKeyPersonnel();
    triggerDataExport(updatedList, 'keyPersonnel', { globalType: 'keyPersonnel' });
    if (personnelToRemove) addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Rimosso utente chiave: ${personnelToRemove.name}`);
  }, [keyPersonnelList, currentKeyPersonnel, logoutKeyPersonnel, triggerDataExport, addAuditLogEntry]);
  
  const getKeyPersonnelById = useCallback((id: string) => keyPersonnelList.find(p => p.id === id), [keyPersonnelList]);

  const getSedeSpecificDataForCurrentYearAndSede = useCallback((): SedeSpecificData | undefined => {
    if (!currentSede || !currentYear || !yearlySedeData[currentYear] || !yearlySedeData[currentYear][currentSede]) {
        return undefined;
    }
    return yearlySedeData[currentYear][currentSede];
  }, [yearlySedeData, currentSede, currentYear]);


  const getSedeEmployees = useCallback(() => getSedeSpecificDataForCurrentYearAndSede()?.employees || [], [getSedeSpecificDataForCurrentYearAndSede]);
  const getSedeCourses = useCallback(() => getSedeSpecificDataForCurrentYearAndSede()?.courses || [], [getSedeSpecificDataForCurrentYearAndSede]);
  const getSedeAssignments = useCallback(() => getSedeSpecificDataForCurrentYearAndSede()?.assignments || [], [getSedeSpecificDataForCurrentYearAndSede]);
  const getSedePlanStatus = useCallback(() => getSedeSpecificDataForCurrentYearAndSede()?.planStatus, [getSedeSpecificDataForCurrentYearAndSede]);
  const getSedePlanApprovals = useCallback(() => getSedeSpecificDataForCurrentYearAndSede()?.planApprovals, [getSedeSpecificDataForCurrentYearAndSede]);


  const getEmployeeById = useCallback((id: string) => getSedeEmployees().find(emp => emp.id === id), [getSedeEmployees]);
  const getCourseById = useCallback((id: string) => getSedeCourses().find(course => course.id === id), [getSedeCourses]);

  const addEmployee = useCallback((empData: Omit<Employee, 'id' | 'roleHistory'> & { initialRole: string; initialRoleStartDate: string }) => {
    if (!currentSede || !currentYear) { alert("Seleziona una sede e un anno."); return; }
    const newEmployee: Employee = {
      id: generateId(), name: empData.name, currentRole: empData.initialRole,
      roleHistory: [{ role: empData.initialRole, startDate: empData.initialRoleStartDate, endDate: null }],
    };
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), 
        data => ({...data, employees: [...data.employees, newEmployee]}), 'employees');
    addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Aggiunto dipendente: ${newEmployee.name}`);
  }, [currentSede, currentYear, addAuditLogEntry]);

  const updateEmployeeRole = useCallback((employeeId: string, newRole: string, startDate: string) => {
    if (!currentSede || !currentYear) return;
    const empName = getEmployeeById(employeeId)?.name || employeeId;
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), data => ({
        ...data,
        employees: data.employees.map(emp => {
        if (emp.id === employeeId) {
          const updatedRoleHistory = emp.roleHistory.map(rh => rh.endDate === null ? { ...rh, endDate: startDate } : rh);
          updatedRoleHistory.push({ role: newRole, startDate, endDate: null });
          return { ...emp, currentRole: newRole, roleHistory: updatedRoleHistory };
        }
        return emp;
      })
    }), 'employees');
    addAuditLogEntry(LogAction.UPDATE_EMPLOYEE_ROLE, `Aggiornato ruolo per ${empName} a ${newRole}.`);
  }, [currentSede, currentYear, getEmployeeById, addAuditLogEntry]);

  const deleteEmployee = useCallback((employeeId: string) => {
    if (!currentSede || !currentYear) return;
    if (!isAdminAuthenticated && currentKeyPersonnel?.role !== 'Admin') { alert("Azione non autorizzata."); return; }
    if (!window.confirm("Eliminare questo dipendente e le sue assegnazioni?")) return;
    
    const empName = getEmployeeById(employeeId)?.name || employeeId;
    let assignmentsModified = false;
    const sedeName = currentSede;
    const yearStr = currentYear.toString();

    modifySedeYearDataAndExport(sedeName, yearStr, data => {
      const newAssignments = data.assignments.filter(assign => assign.employeeId !== employeeId);
      if (newAssignments.length !== data.assignments.length) assignmentsModified = true;
      return {
        ...data,
        employees: data.employees.filter(emp => emp.id !== employeeId),
        assignments: newAssignments
      };
    }, 'employees');
    
    if(assignmentsModified) {
      setTimeout(() => {
        const latestAssignments = yearlySedeData[yearStr]?.[sedeName]?.assignments || [];
        triggerDataExport(latestAssignments, 'assignments', { sede: sedeName, year: yearStr, type: 'assignments' });
      }, 200);
    }
    addAuditLogEntry(LogAction.DELETE_EMPLOYEE, `Eliminato dipendente: ${empName}. Assegnazioni associate rimosse: ${assignmentsModified ? 'Sì' : 'No'}`);
    alert("Dipendente eliminato. Scarica e sovrascrivi i file CSV.");
  }, [currentSede, currentYear, isAdminAuthenticated, currentKeyPersonnel, yearlySedeData, getEmployeeById, triggerDataExport, addAuditLogEntry]);

  const addCourse = useCallback((courseData: Omit<TrainingCourse, 'id' | 'status' | 'approvals'>) => {
    if (!currentSede || !currentYear) { alert("Seleziona sede e anno."); return; }
    const newCourse: TrainingCourse = {
      id: generateId(), ...courseData, status: TrainingCourseStatus.BOZZA, approvals: [],
    };
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), 
        data => ({...data, courses: [...data.courses, newCourse]}), 'courses');
    addAuditLogEntry(LogAction.ADD_COURSE, `Aggiunto corso: ${newCourse.name}`);
  }, [currentSede, currentYear, addAuditLogEntry]);

  const updateCourse = useCallback((courseId: string, updates: Partial<Omit<TrainingCourse, 'id'>>) => {
    if (!currentSede || !currentYear) return;
    if (!isAdminAuthenticated && currentKeyPersonnel?.role !== 'Admin') { alert("Azione non autorizzata."); return; }
    const courseName = getCourseById(courseId)?.name || courseId;
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), data => ({
        ...data,
        courses: data.courses.map(c => c.id === courseId ? { ...c, ...updates } : c)
    }), 'courses');
    addAuditLogEntry(LogAction.UPDATE_COURSE, `Aggiornato corso: ${courseName}. Dettagli: ${JSON.stringify(updates)}`);
  }, [currentSede, currentYear, isAdminAuthenticated, currentKeyPersonnel, getCourseById, addAuditLogEntry]);

  const deleteCourse = useCallback((courseId: string) => {
    if (!currentSede || !currentYear) return;
    if (!isAdminAuthenticated && currentKeyPersonnel?.role !== 'Admin') { alert("Azione non autorizzata."); return; }
    if (!window.confirm("Eliminare questo corso e le sue assegnazioni?")) return;
    
    const courseName = getCourseById(courseId)?.name || courseId;
    let assignmentsModified = false;
    const sedeName = currentSede;
    const yearStr = currentYear.toString();

    modifySedeYearDataAndExport(sedeName, yearStr, data => {
      const newAssignments = data.assignments.filter(assign => assign.courseId !== courseId);
      if (newAssignments.length !== data.assignments.length) assignmentsModified = true;
      return { ...data, courses: data.courses.filter(c => c.id !== courseId), assignments: newAssignments };
    }, 'courses');
    
    if(assignmentsModified) {
      setTimeout(() => {
        const latestAssignments = yearlySedeData[yearStr]?.[sedeName]?.assignments || [];
        triggerDataExport(latestAssignments, 'assignments', { sede: sedeName, year: yearStr, type: 'assignments' });
      }, 200);
    }
    addAuditLogEntry(LogAction.DELETE_COURSE, `Eliminato corso: ${courseName}. Assegnazioni associate rimosse: ${assignmentsModified ? 'Sì' : 'No'}`);
    alert("Corso eliminato. Scarica e sovrascrivi i file CSV.");
  }, [currentSede, currentYear, isAdminAuthenticated, currentKeyPersonnel, yearlySedeData, getCourseById, triggerDataExport, addAuditLogEntry]);

  const approveCourseByQP = useCallback((courseId: string, qpId: string, qpPasswordPlain: string): boolean => {
    if (!currentSede || !currentYear) { alert("Nessuna sede o anno selezionato."); return false; }
    const qpUser = keyPersonnelList.find(p => p.id === qpId && p.role === 'QP');
    if (!qpUser || qpUser.password !== qpPasswordPlain) {
        alert("Credenziali QP non valide o ruolo non corretto."); return false;
    }
    const courseName = getCourseById(courseId)?.name || courseId;
    let success = false;
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), data => {
        const courseIndex = data.courses.findIndex(c => c.id === courseId);
        if (courseIndex > -1) {
            const updatedCourses = [...data.courses];
            const courseToApprove = { ...updatedCourses[courseIndex] }; 
            const newApproval: CourseApproval = { qpId: qpUser.id, qpName: qpUser.name, approvalDate: new Date().toISOString() };
            courseToApprove.approvals = [...(courseToApprove.approvals || []), newApproval];
            courseToApprove.status = TrainingCourseStatus.APPROVATO_QP;
            updatedCourses[courseIndex] = courseToApprove;
            success = true;
            return {...data, courses: updatedCourses};
        }
        return data;
    }, 'courses');

    if(success) {
      addAuditLogEntry(LogAction.APPROVE_COURSE_QP, `Corso '${courseName}' approvato da QP ${qpUser.name}.`);
      alert(`Corso approvato da ${qpUser.name}.`);
    } else alert("Corso non trovato per l'approvazione.");
    return success;
  }, [currentSede, currentYear, keyPersonnelList, getCourseById, addAuditLogEntry]);

  const addAssignment = useCallback((assignmentData: Omit<TrainingAssignment, 'id'>) => {
    if (!currentSede || !currentYear) { alert("Seleziona sede e anno."); return; }
    const course = getCourseById(assignmentData.courseId);
    if (course?.status !== TrainingCourseStatus.APPROVATO_QP && course?.status !== TrainingCourseStatus.PIANIFICATO && course?.status !== TrainingCourseStatus.COMPLETATO) {
        alert("Non è possibile assegnare un corso che non è approvato QP / pianificato / completato."); return;
    }
    const newAssignment: TrainingAssignment = { id: generateId(), ...assignmentData };
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), 
        data => ({...data, assignments: [...data.assignments, newAssignment]}), 'assignments');
    const empName = getEmployeeById(newAssignment.employeeId)?.name || newAssignment.employeeId;
    const courseNameValue = course?.name || newAssignment.courseId;
    addAuditLogEntry(LogAction.ADD_ASSIGNMENT, `Aggiunta assegnazione: ${empName} - ${courseNameValue}.`);
  }, [currentSede, currentYear, getCourseById, getEmployeeById, addAuditLogEntry]);

  const addBatchAssignments = useCallback((payload: BatchAssignmentPayload) => {
    if (!currentSede || !currentYear) { alert("Seleziona sede e anno."); return; }
    // Validation logic as before...
    const newAssignments: TrainingAssignment[] = [];
    // Batch creation logic... (ensure to check course status for each in courseIds case)
     if (payload.commonCourseId && payload.employeeIds) {
        const course = getCourseById(payload.commonCourseId);
        if (course?.status !== TrainingCourseStatus.APPROVATO_QP && course?.status !== TrainingCourseStatus.PIANIFICATO && course?.status !== TrainingCourseStatus.COMPLETATO) {
            alert(`Il corso "${course?.name}" non è approvato/pianificato/completato.`); return;
        }
        payload.employeeIds.forEach(empId => newAssignments.push({
            id: generateId(), employeeId: empId, courseId: payload.commonCourseId!,
            assignmentDate: payload.assignmentDate, completionStatus: payload.completionStatus,
            completionDate: null, score: null,
        }));
    } else if (payload.commonEmployeeId && payload.courseIds) {
        payload.courseIds.forEach(courseId => {
             const course = getCourseById(courseId);
             if (course?.status !== TrainingCourseStatus.APPROVATO_QP && course?.status !== TrainingCourseStatus.PIANIFICATO && course?.status !== TrainingCourseStatus.COMPLETATO) {
                 console.warn(`Corso "${course?.name}" non approvato. Assegnazione saltata.`); return;
             }
            newAssignments.push({
                id: generateId(), employeeId: payload.commonEmployeeId!, courseId: courseId,
                assignmentDate: payload.assignmentDate, completionStatus: payload.completionStatus,
                completionDate: null, score: null,
            });
        });
    } else { alert("Payload per assegnazione multipla non valido."); return; }


    if (newAssignments.length > 0) {
      modifySedeYearDataAndExport(currentSede, currentYear.toString(), 
        data => ({...data, assignments: [...data.assignments, ...newAssignments]}), 'assignments');
      addAuditLogEntry(LogAction.BATCH_ASSIGNMENTS, `Aggiunte ${newAssignments.length} assegnazioni.`);
      alert(`${newAssignments.length} nuove assegnazioni create.`);
    } else if (payload.commonEmployeeId && payload.courseIds && newAssignments.length === 0) {
        alert("Nessuna assegnazione creata. Verifica stato approvazione corsi.");
    }
  }, [currentSede, currentYear, getCourseById, addAuditLogEntry]);

  const updateAssignmentStatus = useCallback((assignmentId: string, status: AssignmentStatus, completionDate?: string, score?: number) => {
    if (!currentSede || !currentYear) return;
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), data => ({
        ...data,
        assignments: data.assignments.map(assign =>
        assign.id === assignmentId ? { ...assign, completionStatus: status, completionDate: completionDate ?? assign.completionDate, score: score ?? assign.score } : assign
      )
    }), 'assignments');
    addAuditLogEntry(LogAction.UPDATE_ASSIGNMENT, `Aggiornato stato assegnazione ID ${assignmentId} a ${status}.`);
  }, [currentSede, currentYear, addAuditLogEntry]);

  const deleteAssignment = useCallback((assignmentId: string) => {
    if (!currentSede || !currentYear) return;
    if (!isAdminAuthenticated && currentKeyPersonnel?.role !== 'Admin') { alert("Azione non autorizzata."); return; }
    if (!window.confirm("Eliminare questa assegnazione?")) return;
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), data => ({
      ...data,
      assignments: data.assignments.filter(a => a.id !== assignmentId)
    }), 'assignments');
    addAuditLogEntry(LogAction.DELETE_ASSIGNMENT, `Eliminata assegnazione ID ${assignmentId}.`);
    alert("Assegnazione eliminata.");
  }, [currentSede, currentYear, isAdminAuthenticated, currentKeyPersonnel, addAuditLogEntry]);

  const approveCurrentSedePlanByResponsabile = useCallback((responsabileId: string, responsabilePasswordPlain: string): boolean => {
    if (!currentSede || !currentYear || !yearlySedeData[currentYear] || !yearlySedeData[currentYear][currentSede]) { 
        alert("Nessuna sede/anno selezionato o dati non caricati."); return false; 
    }
    const responsabileUser = keyPersonnelList.find(p => p.id === responsabileId && p.role === 'Responsabile');
    if (!responsabileUser || responsabileUser.password !== responsabilePasswordPlain) {
        alert("Credenziali Responsabile non valide o ruolo non corretto."); return false;
    }
    
    const coursesInSede = yearlySedeData[currentYear][currentSede].courses || [];
    const allCoursesReady = coursesInSede.every(c => c.status === TrainingCourseStatus.APPROVATO_QP || c.status === TrainingCourseStatus.PIANIFICATO || c.status === TrainingCourseStatus.COMPLETATO);
    if (!allCoursesReady && coursesInSede.length > 0) {
        alert("Non tutti i corsi nel piano sono approvati QP o in stato valido."); return false;
    }
    
    let success = false;
    const newPlanApproval: PlanApproval = { responsabileId: responsabileUser.id, responsabileName: responsabileUser.name, approvalDate: new Date().toISOString() };
    
    modifySedeYearDataAndExport(currentSede, currentYear.toString(), data => {
        success = true; 
        return { ...data, planStatus: PlanStatus.APPROVATO, planApprovals: [newPlanApproval] };
    }, 'planStatus');

    if(success) {
      addAuditLogEntry(LogAction.APPROVE_PLAN_RESP, `Piano per ${currentSede}/${currentYear} approvato da ${responsabileUser.name}.`);
      alert(`Piano per ${currentSede}/${currentYear} approvato da ${responsabileUser.name}.`);
    } else alert("Approvazione piano fallita.");
    return success;
  }, [currentSede, currentYear, keyPersonnelList, yearlySedeData, addAuditLogEntry]);
  
  const clearCurrentSedeYearData = useCallback(() => {
    if (!currentSede || !currentYear) { alert("Nessuna sede o anno selezionato."); return; }
    if (!isAdminAuthenticated && currentKeyPersonnel?.role !== 'Admin') { alert("Azione non autorizzata."); return; }
    if (window.confirm(`Cancellare tutti i dati in memoria per ${currentSede}/${currentYear}? Non modificherà i file CSV.`)) {
      setYearlySedeData(prev => {
        const newYSD = {...prev};
        if (newYSD[currentYear!] && newYSD[currentYear!][currentSede!]) {
            newYSD[currentYear!][currentSede!] = getInitialSedeSpecificData();
        }
        return newYSD;
      });
      addAuditLogEntry(LogAction.CLEAR_SEDE_YEAR_DATA, `Cancellati dati in memoria per ${currentSede}/${currentYear}.`);
      alert(`Dati in memoria per ${currentSede}/${currentYear} cancellati.`);
    }
  }, [currentSede, currentYear, isAdminAuthenticated, currentKeyPersonnel, addAuditLogEntry]);
  
  return (
    <DataContext.Provider value={{ 
      sedi, currentSede, setCurrentSede, addSede, removeSede,
      currentYear, setCurrentYear, availableYears,
      yearlySedeData, getSedeEmployees, getSedeCourses, getSedeAssignments, 
      getSedePlanStatus, getSedePlanApprovals,
      
      loadKeyPersonnelFromMasterCSV, loadSedeDataFromCSV, loadSedePlanStatusFromCSV,
      
      addEmployee, updateEmployeeRole, deleteEmployee,
      addCourse, updateCourse, deleteCourse, approveCourseByQP,
      addAssignment, updateAssignmentStatus, addBatchAssignments, deleteAssignment,
      
      getEmployeeById, getCourseById,
      clearCurrentSedeYearData,
      isAdminAuthenticated, loginAdmin, logoutAdmin,
      keyPersonnelList, currentKeyPersonnel, loginKeyPersonnel, logoutKeyPersonnel,
      addKeyPersonnel, updateKeyPersonnel, removeKeyPersonnel, getKeyPersonnelById,
      approveCurrentSedePlanByResponsabile, 
      setUserEncryptionKey, loadUserEncryptionKeyFromFile, addAuditLogEntry, downloadAuditLog, isUserKeySet
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Ensure these declarations match the context actual value type.
declare module '../types' {
    interface DataContextType {
        loadKeyPersonnelFromMasterCSV: (file: File) => Promise<void>;
        loadSedeDataFromCSV: (sedeName: string, year: string, type: 'employees' | 'courses' | 'assignments', file: File) => Promise<void>;
        loadSedePlanStatusFromCSV: (sedeName: string, year: string, file: File) => Promise<void>;
        availableYears: () => number[];
        getSedePlanApprovals: () => PlanApproval[] | undefined;
        setUserEncryptionKey: (password: string) => Promise<void>;
        loadUserEncryptionKeyFromFile: (file: File) => Promise<void>;
        addAuditLogEntry: (action: LogAction, details: string, overrideSede?: string | null, overrideYear?: number | null) => void;
        downloadAuditLog: () => void;
        isUserKeySet: () => boolean;
    }
}
