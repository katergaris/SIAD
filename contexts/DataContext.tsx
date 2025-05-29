import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { createClient, SupabaseClient, Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';
import {
    Employee, TrainingCourse, TrainingAssignment, AssignmentStatus, TrainingCourseStatus,
    YearlySedeData, SedeSpecificData, BatchAssignmentPayload,
    KeyPersonnel, PlanStatus, CourseApproval, PlanApproval, PlanRecord, DataContextType, CSVExportType,
    AuditEntry, LogAction, KeyPersonnelRole, NewKeyPersonnelPayload, UpdateKeyPersonnelPayload,
    TrainingType
} from '../types';
import { parseCSV } from '../services/csvParser';
import { exportDataToCSV as exportCSVUtil } from '../services/csvExporter';

// Utilizza variabili d'ambiente per URL e chiave Anon di Supabase
// L'utente deve configurarle nel file .env.local
console.log("[DataContext] Initial process.env.SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("[DataContext] Initial process.env.SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let initialIsSupabaseConfigured = false;

const isValidSupabaseString = (str: string | undefined): str is string => {
    return str && typeof str === 'string' && str.trim() !== '' && str.toLowerCase() !== 'undefined' && str.toLowerCase() !== 'null';
};

if (!isValidSupabaseString(supabaseUrl) || !isValidSupabaseString(supabaseAnonKey)) {
  console.error("Supabase URL and Anon Key are required, valid strings, and non-empty (and not 'undefined'/'null' literal strings). Check your .env.local file and restart the development server.");
} else {
  console.log("[DataContext] Supabase URL and Anon Key seem to be present and valid.");
  initialIsSupabaseConfigured = true;
}

export const supabase = initialIsSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null as SupabaseClient | null;

if (initialIsSupabaseConfigured && supabase) {
    console.log("[DataContext] Supabase client created successfully.");
} else if (initialIsSupabaseConfigured && !supabase) {
    console.error("[DataContext] Supabase client creation FAILED despite URL/Key being present and seemingly valid. This might indicate an issue with the Supabase client library or network, or the provided URL/Key are incorrect despite passing basic checks.");
}


type InferredAuthUser = Session['user'];

const DataContext = createContext<DataContextType | undefined>(undefined);

const getInitialSedeSpecificData = (): SedeSpecificData => ({
  employees: [],
  courses: [],
  assignments: [],
  planRecord: undefined,
});

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sedi, setSedi] = useState<{ id: string, name: string }[]>([]);
  const [currentSedeId, setCurrentSedeIdState] = useState<string | null>(null);
  const [currentYear, setCurrentYearState] = useState<number | null>(new Date().getFullYear());

  const [yearlySedeData, setYearlySedeData] = useState<YearlySedeData>({});

  const [currentAuthUser, setCurrentAuthUser] = useState<InferredAuthUser | null>(null);
  const [currentKeyPersonnel, setCurrentKeyPersonnel] = useState<KeyPersonnel | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [keyPersonnelList, setKeyPersonnelList] = useState<KeyPersonnel[]>([]);
  const [isSupabaseConfigured] = useState<boolean>(initialIsSupabaseConfigured);

  const stableAddAuditLogEntry = useCallback(async (action: LogAction, details: string, sedeIdParam?: string | null, yearParam?: number | null, userForAudit?: KeyPersonnel | null, authUserForAudit?: InferredAuthUser | null) => {
    if (!supabase || !isSupabaseConfigured) { console.error("Supabase client not available for audit log."); return; }

    const entry: Omit<AuditEntry, 'id'|'timestamp'> = {
      user_id: authUserForAudit?.id,
      user_name: userForAudit?.name || authUserForAudit?.email,
      user_role: userForAudit?.role || (authUserForAudit ? 'AuthenticatedUser' : 'System/Unknown'),
      action,
      details,
      sede_id: sedeIdParam,
      year: yearParam,
    };

    const { error } = await supabase.from('audit_log').insert(entry);
    if (error) console.error('Error adding audit log entry:', error.message || JSON.stringify(error));
    else console.log(`[DataContext] Audit Log (DB): ${action} - ${details}`);
  }, [isSupabaseConfigured]);


  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
        console.log("[DataContext] Supabase not configured, skipping auth listener and initial fetches.");
        return;
    }
    console.log("[DataContext] Setting up onAuthStateChange listener and initial fetches.");

    const { data: authSubscriptionContainer } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      const supabaseUser = session?.user || null;
      setCurrentAuthUser(supabaseUser);

      if (supabaseUser) {
        console.log(`[DataContext] onAuthStateChange: User session found for ${supabaseUser.email}. Fetching profile.`);
        const { data: profile, error } = await supabase
          .from('key_personnel')
          .select('*')
          .eq('auth_user_id', supabaseUser.id)
          .single();

        if (error && error.code !== 'PGRST116') {
             console.error('[DataContext] Error fetching key personnel profile:', error.message || JSON.stringify(error), 'Details:', error);
             setCurrentKeyPersonnel(null);
             setIsAdminAuthenticated(false);
             stableAddAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, `Errore caricamento profilo per ${supabaseUser.email}: ${error.message || JSON.stringify(error)}`, currentSedeId, currentYear, null, supabaseUser);
        } else if (profile) {
            console.log(`[DataContext] Profile fetched for ${supabaseUser.email}:`, profile);
            const isValidRole = Object.values(KeyPersonnelRole).includes(profile.role as KeyPersonnelRole);
            if (!isValidRole) {
                console.warn(`[DataContext] Fetched profile for ${supabaseUser.email} has an INVALID or UNRECOGNIZED role: '${profile.role}'. Expected one of [${Object.values(KeyPersonnelRole).join(', ')}]. Treating as no valid profile. This could be due to a schema mismatch after SQL script execution if the 'role' column or its ENUM values are not as expected.`);
                setCurrentKeyPersonnel(null);
                setIsAdminAuthenticated(false);
                stableAddAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, `Profilo ${supabaseUser.email} con ruolo non valido: ${profile.role}`, currentSedeId, currentYear, null, supabaseUser);
            } else {
                const kpProfile: KeyPersonnel = {
                    id: profile.id,
                    auth_user_id: profile.auth_user_id,
                    name: profile.name,
                    email: supabaseUser.email,
                    role: profile.role as KeyPersonnelRole,
                };
                setCurrentKeyPersonnel(kpProfile);
                const isAdmin = kpProfile.role === KeyPersonnelRole.ADMIN;
                setIsAdminAuthenticated(isAdmin);
                console.log(`[DataContext] User ${kpProfile.name} logged in. Role: ${kpProfile.role}. isAdmin: ${isAdmin}`);
                stableAddAuditLogEntry(LogAction.LOGIN, `Login riuscito per ${kpProfile.name} (${kpProfile.role})`, currentSedeId, currentYear, kpProfile, supabaseUser);
            }
        } else {
            setCurrentKeyPersonnel(null);
            setIsAdminAuthenticated(false);
            const noProfileMsg = `Utente ${supabaseUser.email} autenticato ma senza profilo KeyPersonnel associato.`;
            console.warn(`[DataContext] ${noProfileMsg} isAdmin set to false.`);
            stableAddAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, noProfileMsg, currentSedeId, currentYear, null, supabaseUser);
        }

      } else {
        if (currentKeyPersonnel) {
            console.log(`[DataContext] onAuthStateChange: User logged out or session ended for ${currentKeyPersonnel.name}.`);
            stableAddAuditLogEntry(LogAction.LOGOUT, `Logout per ${currentKeyPersonnel.name} (${currentKeyPersonnel.role})`, currentSedeId, currentYear, currentKeyPersonnel, currentAuthUser);
        }
        setCurrentKeyPersonnel(null);
        setIsAdminAuthenticated(false);
      }
    });

    const subscription = authSubscriptionContainer?.subscription;
    if (!subscription) {
        console.warn("[DataContext] Failed to set up onAuthStateChange listener: No subscription object returned. Auth state changes might not be monitored.");
    }

    fetchSedi();
    fetchKeyPersonnelList();

    return () => {
      subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabaseConfigured, stableAddAuditLogEntry]);


 const addAuditLogEntry = useCallback(async (action: LogAction, details: string, sedeIdParam?: string | null, yearParam?: number | null) => {
    await stableAddAuditLogEntry(action, details, sedeIdParam !== undefined ? sedeIdParam : currentSedeId, yearParam !== undefined ? yearParam : currentYear, currentKeyPersonnel, currentAuthUser);
}, [stableAddAuditLogEntry, currentSedeId, currentYear, currentKeyPersonnel, currentAuthUser]);


  const fetchDataForSedeAndYear = useCallback(async (sedeId: string, year: number) => {
    if (!supabase || !isSupabaseConfigured || !sedeId || !year) {
      const sedeNameForCache = sedi.find(s=>s.id === sedeId)?.name || sedeId || "unknown_sede";
      if (year && sedeNameForCache) {
        console.warn(`[DataContext] Supabase not configured or sedeId/year missing. Initializing empty data for ${sedeNameForCache}/${year}.`);
        setYearlySedeData(prevYSD => ({
          ...prevYSD,
          [year]: { ...(prevYSD[year] || {}), [sedeNameForCache]: getInitialSedeSpecificData() }
        }));
      }
      return;
    }

    const sedeName = sedi.find(s => s.id === sedeId)?.name || sedeId;
    console.log(`[DataContext] Fetching data for Sede ID: ${sedeId} ('${sedeName}'), Year: ${year}. Supabase configured: ${isSupabaseConfigured}`);
    try {
      const [employeesRes, coursesRes, assignmentsRes, planRecordRes] = await Promise.all([
        supabase.from('employees').select('*, role_history(*)').eq('sede_id', sedeId).eq('year', year),
        supabase.from('courses').select('*, course_approvals(*)').eq('sede_id', sedeId).eq('year', year),
        supabase.from('assignments').select('*').eq('sede_id', sedeId).eq('year', year),
        supabase.from('plan_records').select('*, plan_approvals(*), created_by:key_personnel!created_by_user_id(name), last_modified_by:key_personnel!last_modified_by_user_id(name)')
        .eq('sede_id', sedeId).eq('year', year).maybeSingle()
      ]);

      console.log('[DataContext] Employees Response from Supabase:', JSON.stringify(employeesRes, null, 2));
      console.log('[DataContext] Courses Response from Supabase:', JSON.stringify(coursesRes, null, 2));
      console.log('[DataContext] Assignments Response from Supabase:', JSON.stringify(assignmentsRes, null, 2));
      console.log('[DataContext] PlanRecord Response from Supabase:', JSON.stringify(planRecordRes, null, 2));

      if (employeesRes.error) throw new Error(`Employees fetch error: ${employeesRes.error.message} (Code: ${employeesRes.error.code}) Details: ${employeesRes.error.details} Hint: ${employeesRes.error.hint}`);
      if (coursesRes.error) throw new Error(`Courses fetch error: ${coursesRes.error.message} (Code: ${coursesRes.error.code}) Details: ${coursesRes.error.details} Hint: ${coursesRes.error.hint}`);
      if (assignmentsRes.error) throw new Error(`Assignments fetch error: ${assignmentsRes.error.message} (Code: ${assignmentsRes.error.code}) Details: ${assignmentsRes.error.details} Hint: ${assignmentsRes.error.hint}`);
      if (planRecordRes.error && planRecordRes.error.code !== 'PGRST116') throw new Error(`PlanRecord fetch error: ${planRecordRes.error.message} (Code: ${planRecordRes.error.code}) Details: ${planRecordRes.error.details} Hint: ${planRecordRes.error.hint}`);

      const fetchedData: SedeSpecificData = {
        employees: (employeesRes.data || []).map(e => ({...e, roleHistory: e.role_history || [] })),
        courses: (coursesRes.data || []).map(c => ({...c, approvals: c.course_approvals || []})),
        assignments: assignmentsRes.data || [],
        planRecord: planRecordRes.data ? {
            ...planRecordRes.data,
            approvals: planRecordRes.data.plan_approvals || [],
            created_by_user_id: planRecordRes.data.created_by_user_id || undefined,
            created_by_name: (planRecordRes.data.created_by as any)?.name || undefined,
            last_modified_by_user_id: planRecordRes.data.last_modified_by_user_id || undefined,
            last_modified_by_name: (planRecordRes.data.last_modified_by as any)?.name || undefined,
            last_modified_at: planRecordRes.data.last_modified_at || undefined
        } : undefined,
      };

      console.log(`[DataContext] Successfully fetched and processed data for ${sedeName}/${year}. Employees: ${fetchedData.employees.length}, Courses: ${fetchedData.courses.length}, Assignments: ${fetchedData.assignments.length}, Plan: ${!!fetchedData.planRecord}`);
      setYearlySedeData(prevYSD => ({
        ...prevYSD,
        [year]: { ...(prevYSD[year] || {}), [sedeName]: fetchedData }
      }));
    } catch (error: any) {
      console.error(`[DataContext] Error in fetchDataForSedeAndYear for ${sedeName}/${year}:`, error.message, error.stack ? error.stack : JSON.stringify(error));
      addAuditLogEntry(LogAction.DATA_DOWNLOAD, `Errore caricamento dati per Sede ${sedeName}/${year}: ${error.message}`, sedeId, year);
       setYearlySedeData(prevYSD => ({
        ...prevYSD,
        [year]: { ...(prevYSD[year] || {}), [sedeName]: getInitialSedeSpecificData() }
      }));
    }
  }, [sedi, isSupabaseConfigured, addAuditLogEntry]);

 useEffect(() => {
    if (currentSedeId && currentYear && supabase && isSupabaseConfigured) {
      fetchDataForSedeAndYear(currentSedeId, currentYear);
    }
  }, [currentSedeId, currentYear, isSupabaseConfigured, fetchDataForSedeAndYear]);


  const fetchSedi = async () => {
    if (!supabase || !isSupabaseConfigured) return;
    const { data, error } = await supabase.from('sedi').select('id, name').order('name');
    if (error) console.error('[DataContext] Error fetching sedi:', error.message || JSON.stringify(error));
    else setSedi(data || []);
  };

  const addSede = async (name: string): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    if (!name.trim()) return { success: false, message: "Nome sede non valido."};
    if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
        addAuditLogEntry(LogAction.ADD_SEDE, `Tentativo fallito (non Admin): ${name}`);
        return { success: false, message: "Azione non autorizzata." };
    }

    const trimmedName = name.trim();
    const { data, error } = await supabase.from('sedi').insert({ name: trimmedName }).select().single();

    if (error) {
      console.error('[DataContext] Error adding sede:', error.message || JSON.stringify(error));
      addAuditLogEntry(LogAction.ADD_SEDE, `Errore: ${trimmedName} - ${error.message}`);
      return { success: false, message: error.message };
    }
    if (data) {
      setSedi(prevSedi => [...prevSedi, {id: data.id, name: data.name}].sort((a,b) => a.name.localeCompare(b.name)));
      if (!currentSedeId) setCurrentSedeIdState(data.id);
      addAuditLogEntry(LogAction.ADD_SEDE, `Aggiunta sede: ${trimmedName} (ID: ${data.id})`);
      return { success: true };
    }
    return { success: false, message: "Errore sconosciuto nell'aggiunta sede."};
  };

  const removeSede = async (id: string): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
        addAuditLogEntry(LogAction.REMOVE_SEDE, `Tentativo fallito (non Admin) ID: ${id}`);
        return { success: false, message: "Azione non autorizzata." };
    }
    const sedeToRemove = sedi.find(s => s.id === id);
    const { error } = await supabase.from('sedi').delete().eq('id', id);
    if (error) {
      console.error('[DataContext] Error removing sede:', error.message || JSON.stringify(error));
      addAuditLogEntry(LogAction.REMOVE_SEDE, `Errore: ${sedeToRemove?.name || id} - ${error.message}`);
      return { success: false, message: error.message };
    }
    setSedi(prevSedi => prevSedi.filter(s => s.id !== id));
    if (currentSedeId === id) setCurrentSedeIdState(sedi.length > 1 ? sedi.filter(s => s.id !== id)[0]?.id || null : null);
    addAuditLogEntry(LogAction.REMOVE_SEDE, `Rimossa sede: ${sedeToRemove?.name || id}`);
    return { success: true };
  };

  const fetchKeyPersonnelList = async () => {
    if (!supabase || !isSupabaseConfigured) return;
    const { data, error } = await supabase
        .from('key_personnel')
        .select(`
            id,
            auth_user_id,
            name,
            role,
            auth_users (email)
        `);

    if (error) {
        console.error('[DataContext] Error fetching key personnel list:', error.message || JSON.stringify(error));
    } else {
        const mappedData = data?.map(p => ({
            id: p.id,
            auth_user_id: p.auth_user_id,
            name: p.name,
            role: p.role as KeyPersonnelRole,
            email: (p.auth_users as { email: string }[] | null)?.[0]?.email || ''
        })) || [];
        setKeyPersonnelList(mappedData);
    }
  };

  const loginUser = async (email: string, passwordPlain: string): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    console.log(`[DataContext] Attempting login for ${email}.`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: passwordPlain });
    if (error) {
      console.error('[DataContext] Login error:', error.message || JSON.stringify(error));
      return { success: false, message: error.message };
    }
    console.log(`[DataContext] Supabase auth.signInWithPassword successful for ${email}. Session:`, data?.session);
    return { success: true };
  };

  const logoutUser = async (): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    console.log(`[DataContext] Attempting logout.`);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[DataContext] Logout error:', error.message || JSON.stringify(error));
      return { success: false, message: error.message };
    }
    console.log(`[DataContext] Logout successful.`);
    return { success: true };
  };

  const addKeyPersonnel = async (payload: NewKeyPersonnelPayload): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
        addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Tentativo fallito (non Admin) da ${currentKeyPersonnel?.name || 'utente sconosciuto'} per ${payload.name}`);
        return { success: false, message: "Azione non autorizzata." };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.passwordPlain,
    });

    if (authError) {
      console.error('[DataContext] Error signing up new key personnel in Supabase Auth:', authError.message || JSON.stringify(authError));
      addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Errore Auth creazione utente chiave ${payload.name}: ${authError.message}`);
      return { success: false, message: `Auth Error: ${authError.message}` };
    }
    if (!authData.user) {
      addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Fallimento creazione utente chiave ${payload.name}: nessun utente Auth restituito.`);
      return { success: false, message: "Registrazione utente Auth fallita, nessun utente restituito." };
    }

    const { error: profileError } = await supabase.from('key_personnel').insert({
      auth_user_id: authData.user.id,
      name: payload.name,
      role: payload.role,
    });

    if (profileError) {
      console.error('[DataContext] Error creating key personnel profile:', profileError.message || JSON.stringify(profileError));
      addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Errore profilo utente chiave ${payload.name} (AuthID: ${authData.user.id}): ${profileError.message}. Utente Auth creato.`);
      return { success: false, message: `Profile Error: ${profileError.message}. Utente Auth creato ma profilo fallito.` };
    }

    addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Aggiunto utente chiave: ${payload.name} (${payload.role}), Email: ${payload.email}`);
    fetchKeyPersonnelList();
    return { success: true };
  };

  const updateKeyPersonnel = async (personnelAuthUserIdToUpdate: string, updates: UpdateKeyPersonnelPayload): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
     if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
        addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Tentativo fallito (non Admin) da ${currentKeyPersonnel?.name || 'utente sconosciuto'} per utente AuthID ${personnelAuthUserIdToUpdate}`);
        return { success: false, message: "Azione non autorizzata." };
    }

    let profileUpdated = false;
    let passwordUpdatedSuccessfully = false;

    if (updates.name || updates.role) {
        const profileUpdates: Partial<Omit<KeyPersonnel, 'id' | 'auth_user_id' | 'email'>> = {};
        if(updates.name) profileUpdates.name = updates.name;
        if(updates.role) profileUpdates.role = updates.role;

        const { error: profileError } = await supabase
            .from('key_personnel')
            .update(profileUpdates)
            .eq('auth_user_id', personnelAuthUserIdToUpdate);
        if (profileError) {
            console.error('[DataContext] Error updating key personnel profile:', profileError.message || JSON.stringify(profileError));
            addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Errore aggiornamento profilo per utente AuthID ${personnelAuthUserIdToUpdate}: ${profileError.message}`);
            return { success: false, message: `Profile Update Error: ${profileError.message}` };
        }
        profileUpdated = true;
    }

    if (updates.newPasswordPlain) {
        if (currentAuthUser?.id === personnelAuthUserIdToUpdate) {
             const { error: passwordError } = await supabase.auth.updateUser({ password: updates.newPasswordPlain });
             if (passwordError) {
                console.error('[DataContext] Error updating user password (self):', passwordError.message || JSON.stringify(passwordError));
                addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Errore aggiornamento password (self) per utente AuthID ${personnelAuthUserIdToUpdate}: ${passwordError.message}`);
                return { success: false, message: `Password Update Error: ${passwordError.message}` };
            }
            passwordUpdatedSuccessfully = true;
        } else if (currentKeyPersonnel?.role === KeyPersonnelRole.ADMIN) {
           console.warn("[DataContext] Password change for another user by admin is typically a server-side operation with service_role key. This client-side attempt might fail or is not supported directly for other users via supabase.auth.updateUser().");
           addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Tentativo di Admin di cambiare password per utente AuthID ${personnelAuthUserIdToUpdate} non supportato client-side.`);
           return { success: false, message: "La modifica della password di altri utenti da parte dell'admin non è supportata direttamente lato client con la chiave anon." };
        } else {
            addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Tentativo non autorizzato di cambio password per utente AuthID ${personnelAuthUserIdToUpdate}.`);
            return { success: false, message: "Non autorizzato a cambiare password per questo utente."};
        }
    }

    if (profileUpdated || passwordUpdatedSuccessfully) {
        addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Personale chiave aggiornato (AuthID: ${personnelAuthUserIdToUpdate}): Profilo: ${profileUpdated}, Password: ${passwordUpdatedSuccessfully}`);
        fetchKeyPersonnelList();
        return { success: true, message: "Personale chiave aggiornato con successo." };
    }

    return { success: false, message: "Nessun aggiornamento valido specificato o azione non permessa." };
  };

    const getSedeEmployees = (): Employee[] => {
        const sedeName = sedi.find(s => s.id === currentSedeId)?.name;
        if (currentYear && sedeName && yearlySedeData[currentYear] && yearlySedeData[currentYear][sedeName]) {
            return yearlySedeData[currentYear][sedeName].employees;
        }
        return [];
    };
    const getSedeCourses = (): TrainingCourse[] => {
        const sedeName = sedi.find(s => s.id === currentSedeId)?.name;
        if (currentYear && sedeName && yearlySedeData[currentYear] && yearlySedeData[currentYear][sedeName]) {
            return yearlySedeData[currentYear][sedeName].courses;
        }
        return [];
    };
    const getSedeAssignments = (): TrainingAssignment[] => {
        const sedeName = sedi.find(s => s.id === currentSedeId)?.name;
        if (currentYear && sedeName && yearlySedeData[currentYear] && yearlySedeData[currentYear][sedeName]) {
            return yearlySedeData[currentYear][sedeName].assignments;
        }
        return [];
    };
    const getSedePlanRecord = (): PlanRecord | undefined => {
        const sedeName = sedi.find(s => s.id === currentSedeId)?.name;
        if (currentYear && sedeName && yearlySedeData[currentYear] && yearlySedeData[currentYear][sedeName]) {
            return yearlySedeData[currentYear][sedeName].planRecord;
        }
        return undefined;
    };
    const addEmployee = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const updateEmployeeRole = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const deleteEmployee = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const addCourse = async (): Promise<{ success: boolean, message?: string, newCourse?: TrainingCourse }> => { /* Stub from prompt */ return { success: false }; };
    const updateCourse = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const deleteCourse = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const approveCourseByQP = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const addAssignment = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const updateAssignmentStatus = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const addBatchAssignments = async (): Promise<{ success: boolean, message?: string, count?:number }> => { /* Stub from prompt */ return { success: false }; };
    const deleteAssignment = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const getEmployeeById = (id: string): Employee | undefined => {
        const employees = getSedeEmployees();
        return employees.find(emp => emp.id === id);
    };
    const getCourseById = (id: string): TrainingCourse | undefined => {
        const courses = getSedeCourses();
        return courses.find(course => course.id === id);
    };
    const clearCurrentSedeYearData = (): void => {
        const sedeName = sedi.find(s => s.id === currentSedeId)?.name;
        if (currentYear && sedeName && yearlySedeData[currentYear] && yearlySedeData[currentYear][sedeName]) {
            setYearlySedeData(prevYSD => {
                const newYSD = { ...prevYSD };
                if (newYSD[currentYear]) {
                    newYSD[currentYear] = {
                        ...newYSD[currentYear],
                        [sedeName]: getInitialSedeSpecificData()
                    };
                }
                return newYSD;
            });
            addAuditLogEntry(LogAction.CLEAR_SEDE_YEAR_DATA, `Cache dati pulita per ${sedeName}/${currentYear}`);
        }
    };
    const getKeyPersonnelByAuthId = (authUserId: string): KeyPersonnel | undefined => {
        return keyPersonnelList.find(kp => kp.auth_user_id === authUserId);
    };
    
    const createPlanRecord = async (sedeId: string, year: number): Promise<{ success: boolean, message?: string, newPlan?: PlanRecord }> => {
        if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
        if (!currentKeyPersonnel || !(currentKeyPersonnel.role === KeyPersonnelRole.ADMIN || currentKeyPersonnel.role === KeyPersonnelRole.QA_SITO)) {
            addAuditLogEntry(LogAction.CREATE_PLAN_RECORD, `Tentativo fallito (non autorizzato) per ${sedeId}/${year}`);
            return { success: false, message: "Azione non autorizzata." };
        }
        if (!currentAuthUser) {
             return { success: false, message: "Utente non autenticato." };
        }

        const sedeName = sedi.find(s => s.id === sedeId)?.name || sedeId;

        // Check if a plan already exists (though UI should prevent this, good to double check)
        const existingPlan = getSedePlanRecord(); // This checks the local cache
        if (existingPlan && existingPlan.sede_id === sedeId && existingPlan.year === year) {
             addAuditLogEntry(LogAction.CREATE_PLAN_RECORD, `Tentativo fallito (piano già esistente) per ${sedeName}/${year}`);
             return { success: false, message: `Un piano per ${sedeName}/${year} esiste già.` };
        }


        const { data, error } = await supabase
            .from('plan_records')
            .insert({
                sede_id: sedeId,
                year: year,
                status: PlanStatus.BOZZA,
                created_by_user_id: currentAuthUser.id 
            })
            .select('*, created_by:key_personnel!created_by_user_id(name)')
            .single();

        if (error) {
            console.error('[DataContext] Error creating plan record:', error.message);
            addAuditLogEntry(LogAction.CREATE_PLAN_RECORD, `Errore creazione piano per ${sedeName}/${year}: ${error.message}`);
            return { success: false, message: `Errore database: ${error.message}` };
        }

        if (data) {
            addAuditLogEntry(LogAction.CREATE_PLAN_RECORD, `Creato piano per ${sedeName}/${year} con ID: ${data.id}`);
            // Manually update the local cache structure for the new plan
            const newPlanRecord: PlanRecord = {
                ...data,
                approvals: [], // New plan has no approvals yet
                created_by_name: (data.created_by as any)?.name || currentKeyPersonnel.name, // Use current user's name as fallback
            };
            setYearlySedeData(prevYSD => {
                const updatedYearData = { ...(prevYSD[year] || {}) };
                const updatedSedeData = { ...(updatedYearData[sedeName] || getInitialSedeSpecificData()) };
                updatedSedeData.planRecord = newPlanRecord;
                updatedYearData[sedeName] = updatedSedeData;
                return { ...prevYSD, [year]: updatedYearData };
            });
            // Optionally, call fetchDataForSedeAndYear to ensure full consistency if other related data might change
            // await fetchDataForSedeAndYear(sedeId, year); 
            return { success: true, newPlan: newPlanRecord };
        }
        return { success: false, message: "Errore sconosciuto nella creazione del piano." };
    };

    const submitPlanForApproval = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const approveOrRejectPlanStep = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const downloadAuditLog = async (): Promise<void> => { /* Stub from prompt */ };
    const loadKeyPersonnelFromMasterCSV = async (): Promise<{ success: boolean, message?: string, count?: number }> => { /* Stub from prompt */ return { success: false }; };
    const exportDataToCSV = async (): Promise<void> => { /* Stub from prompt */ };
    
    const availableYears = (): number[] => {
        const years = new Set<number>();
        const systemYear = new Date().getFullYear();

        // Add years from existing data in yearlySedeData
        Object.keys(yearlySedeData).forEach(yearStr => {
            if (!isNaN(parseInt(yearStr))) {
                years.add(parseInt(yearStr));
            }
        });

        // Add a range of years around the system year (e.g., 3 years past, current, 3 years future)
        for (let i = -3; i <= 3; i++) {
            years.add(systemYear + i);
        }

        // Ensure currentYear from context is included if set
        if (currentYear !== null && !isNaN(currentYear)) {
            years.add(currentYear);
        }
        
        // Fallback if the set is somehow still empty
        if (years.size === 0) {
            years.add(systemYear);
        }
        
        return Array.from(years).sort((a, b) => b - a); // Sort descending
    };

  const removeKeyPersonnel = async (personnelAuthUserId: string): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
      addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Tentativo fallito (non Admin) per AuthID ${personnelAuthUserId}`);
      return { success: false, message: "Azione non autorizzata." };
    }

    const { error: profileError } = await supabase
      .from('key_personnel')
      .delete()
      .eq('auth_user_id', personnelAuthUserId);

    if (profileError) {
      console.error('[DataContext] Error deleting key personnel profile:', profileError.message);
      addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Errore eliminazione profilo AuthID ${personnelAuthUserId}: ${profileError.message}`);
      return { success: false, message: `Errore profilo: ${profileError.message}` };
    }
    console.warn(`[DataContext] Profile for AuthID ${personnelAuthUserId} deleted. Associated auth user might need manual deletion or a backend function call if not handled by triggers/policies.`);
    addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Rimosso profilo utente chiave AuthID ${personnelAuthUserId}. L'utente Auth potrebbe richiedere rimozione separata.`);
    fetchKeyPersonnelList(); // Refresh list
    return { success: true, message: "Profilo personale chiave rimosso. L'utente Auth potrebbe necessitare di rimozione separata." };
  };


  return (
    <DataContext.Provider value={{
        sedi, currentSedeId, setCurrentSedeId: setCurrentSedeIdState, addSede, removeSede,
        currentYear, setCurrentYear: setCurrentYearState, availableYears,
        yearlySedeData, fetchDataForSedeAndYear,
        getSedeEmployees, getSedeCourses, getSedeAssignments, getSedePlanRecord,
        addEmployee, updateEmployeeRole, deleteEmployee,
        addCourse, updateCourse, deleteCourse, approveCourseByQP,
        addAssignment, updateAssignmentStatus, addBatchAssignments, deleteAssignment,
        getEmployeeById, getCourseById,
        clearCurrentSedeYearData,
        isAdminAuthenticated, currentKeyPersonnel,
        loginUser, logoutUser,
        keyPersonnelList, fetchKeyPersonnel: fetchKeyPersonnelList, addKeyPersonnel, updateKeyPersonnel, removeKeyPersonnel, getKeyPersonnelByAuthId,
        createPlanRecord, // Added new function
        submitPlanForApproval, approveOrRejectPlanStep,
        addAuditLogEntry, downloadAuditLog,
        loadKeyPersonnelFromMasterCSV, exportDataToCSV,
        isSupabaseConfigured
     }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
