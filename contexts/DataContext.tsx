import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { createClient, SupabaseClient, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { 
    Employee, TrainingCourse, TrainingAssignment, AssignmentStatus, TrainingCourseStatus, 
    YearlySedeData, SedeSpecificData, BatchAssignmentPayload,
    KeyPersonnel, PlanStatus, CourseApproval, PlanApproval, PlanRecord, DataContextType, CSVExportType,
    AuditEntry, LogAction, KeyPersonnelRole, NewKeyPersonnelPayload, UpdateKeyPersonnelPayload,
    EmployeeCSVRow, CourseCSVRow, TrainingType // Mantenere per import CSV
} from '../types';
import { parseCSV } from '../services/csvParser'; 
import { exportDataToCSV as exportCSVUtil } from '../services/csvExporter'; 

// Utilizza variabili d'ambiente per URL e chiave Anon di Supabase
// L'utente deve configurarle nel file .env.local
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let initialIsSupabaseConfigured = false;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key are required. Check your .env.local file and restart the development server.");
} else {
  initialIsSupabaseConfigured = true;
}

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null as SupabaseClient | null;

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


  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    const { data: authSubscriptionContainer, error: authSubscriptionError } = (supabase.auth as any).onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      const supabaseUser = session?.user || null;
      setCurrentAuthUser(supabaseUser);

      if (supabaseUser) {
        const { data: profile, error } = await supabase
          .from('key_personnel')
          .select('*')
          .eq('auth_user_id', supabaseUser.id)
          .single();
        
        if (error && error.code !== 'PGRST116') { 
             console.error('Error fetching key personnel profile:', error.message || JSON.stringify(error));
             setCurrentKeyPersonnel(null);
             setIsAdminAuthenticated(false);
             addAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, `Errore caricamento profilo per ${supabaseUser.email}: ${error.message || JSON.stringify(error)}`);
        } else if (profile) {
            const kpProfile: KeyPersonnel = {
                id: profile.id, 
                auth_user_id: profile.auth_user_id,
                name: profile.name,
                email: supabaseUser.email,
                role: profile.role as KeyPersonnelRole, 
            };
            setCurrentKeyPersonnel(kpProfile);
            setIsAdminAuthenticated(kpProfile.role === KeyPersonnelRole.ADMIN);
            addAuditLogEntry(LogAction.LOGIN, `Login riuscito per ${kpProfile.name} (${kpProfile.role})`);
        } else {
            setCurrentKeyPersonnel(null);
            setIsAdminAuthenticated(false);
            const noProfileMsg = `Utente ${supabaseUser.email} autenticato ma senza profilo KeyPersonnel.`;
            console.warn(noProfileMsg);
            addAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, noProfileMsg);
        }

      } else {
        setCurrentKeyPersonnel(null);
        setIsAdminAuthenticated(false);
      }
    });
    
    if(authSubscriptionError){
        console.error("Error setting up onAuthStateChange listener:", authSubscriptionError);
    }
    const subscription = authSubscriptionContainer?.subscription;


    fetchSedi();
    fetchKeyPersonnelList(); 

    return () => {
      subscription?.unsubscribe();
    };
  }, [isSupabaseConfigured]); // Aggiunto isSupabaseConfigured alle dipendenze

 useEffect(() => {
    if (currentSedeId && currentYear && supabase && isSupabaseConfigured) {
      fetchDataForSedeAndYear(currentSedeId, currentYear);
    }
  }, [currentSedeId, currentYear, isSupabaseConfigured]); // Aggiunto isSupabaseConfigured


  const addAuditLogEntry = useCallback(async (action: LogAction, details: string, sedeIdParam?: string | null, yearParam?: number | null) => {
    if (!supabase || !isSupabaseConfigured) { console.error("Supabase client not available for audit log."); return; }
    
    const entry: Omit<AuditEntry, 'id'|'timestamp'> = {
      user_id: currentAuthUser?.id,
      user_name: currentKeyPersonnel?.name || currentAuthUser?.email,
      user_role: currentKeyPersonnel?.role || (currentAuthUser ? 'AuthenticatedUser' : 'System/Unknown'),
      action,
      details,
      sede_id: sedeIdParam !== undefined ? sedeIdParam : currentSedeId,
      year: yearParam !== undefined ? yearParam : currentYear,
    };

    const { error } = await supabase.from('audit_log').insert(entry);
    if (error) console.error('Error adding audit log entry:', error.message || JSON.stringify(error));
    else console.log(`Audit Log (DB): ${action} - ${details}`);
  }, [currentSedeId, currentYear, currentAuthUser, currentKeyPersonnel, isSupabaseConfigured]);

  const fetchSedi = async () => {
    if (!supabase || !isSupabaseConfigured) return;
    const { data, error } = await supabase.from('sedi').select('id, name').order('name');
    if (error) console.error('Error fetching sedi:', error.message || JSON.stringify(error));
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
      console.error('Error adding sede:', error.message || JSON.stringify(error));
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
      console.error('Error removing sede:', error.message || JSON.stringify(error));
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
        console.error('Error fetching key personnel list:', error.message || JSON.stringify(error));
    } else {
        const mappedData = data?.map(p => ({
            id: p.id,
            auth_user_id: p.auth_user_id,
            name: p.name,
            role: p.role as KeyPersonnelRole,
            email: (p.auth_users as any)?.email || '' 
        })) || [];
        setKeyPersonnelList(mappedData);
    }
  };

  const loginUser = async (email: string, passwordPlain: string): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    const { data, error } = await (supabase.auth as any).signInWithPassword({ email, password: passwordPlain });
    if (error) {
      console.error('Login error:', error.message || JSON.stringify(error));
      addAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, `Login fallito per ${email}: ${error.message}`);
      return { success: false, message: error.message };
    }
    return { success: true };
  };

  const logoutUser = async (): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    const userName = currentKeyPersonnel?.name || currentAuthUser?.email;
    addAuditLogEntry(LogAction.LOGOUT, `Tentativo logout utente: ${userName}`);
    const { error } = await (supabase.auth as any).signOut();
    if (error) {
      console.error('Logout error:', error.message || JSON.stringify(error));
      return { success: false, message: error.message };
    }
    return { success: true };
  };

  const addKeyPersonnel = async (payload: NewKeyPersonnelPayload): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
        return { success: false, message: "Azione non autorizzata." };
    }

    const { data: authData, error: authError } = await (supabase.auth as any).signUp({
      email: payload.email,
      password: payload.passwordPlain,
    });

    if (authError) {
      console.error('Error signing up new key personnel in Supabase Auth:', authError.message || JSON.stringify(authError));
      return { success: false, message: `Auth Error: ${authError.message}` };
    }
    if (!authData.user) {
      return { success: false, message: "Registrazione utente Auth fallita, nessun utente restituito." };
    }

    const { error: profileError } = await supabase.from('key_personnel').insert({
      auth_user_id: authData.user.id,
      name: payload.name,
      role: payload.role,
    });

    if (profileError) {
      console.error('Error creating key personnel profile:', profileError.message || JSON.stringify(profileError));
      // Consider deleting the auth user if profile creation fails to avoid orphaned auth users
      // await supabase.auth.admin.deleteUser(authData.user.id) // Requires service_role key, so must be a backend function
      return { success: false, message: `Profile Error: ${profileError.message}. Utente Auth creato ma profilo fallito.` };
    }
    
    addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Aggiunto utente chiave: ${payload.name} (${payload.role}), Email: ${payload.email}`);
    fetchKeyPersonnelList(); 
    return { success: true };
  };

  const updateKeyPersonnel = async (personnelAuthUserIdToUpdate: string, updates: UpdateKeyPersonnelPayload): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
     if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) { 
        return { success: false, message: "Azione non autorizzata." };
    }

    if (updates.name || updates.role) {
        const profileUpdates: Partial<Omit<KeyPersonnel, 'id' | 'auth_user_id' | 'email'>> = {};
        if(updates.name) profileUpdates.name = updates.name;
        if(updates.role) profileUpdates.role = updates.role;

        const { error: profileError } = await supabase
            .from('key_personnel')
            .update(profileUpdates)
            .eq('auth_user_id', personnelAuthUserIdToUpdate);
        if (profileError) {
            console.error('Error updating key personnel profile:', profileError.message || JSON.stringify(profileError));
            return { success: false, message: `Profile Update Error: ${profileError.message}` };
        }
    }

    if (updates.newPasswordPlain) {
        // Changing other users' passwords requires admin privileges on Supabase, usually via a backend function.
        // Updating the current user's password can be done client-side.
        if (currentAuthUser?.id === personnelAuthUserIdToUpdate) { 
             const { error: passwordError } = await (supabase.auth as any).updateUser({ password: updates.newPasswordPlain });
             if (passwordError) {
                console.error('Error updating user password (self):', passwordError.message || JSON.stringify(passwordError));
                return { success: false, message: `Password Update Error: ${passwordError.message}` };
            }
        } else if (currentKeyPersonnel?.role === KeyPersonnelRole.ADMIN) { 
            // This is a client-side operation. Supabase typically restricts this.
            // For admin to change other user's password, this should be a call to a trusted server-side (Edge) function
            // that uses the service_role key.
            console.warn("L'admin non può cambiare la password di altri utenti direttamente dal client in questo modo. Richiede una funzione backend con privilegi admin.");
            // return { success: false, message: "Admin password changes for other users require a backend function." };
        }
    }
    
    addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Aggiornato utente chiave (AuthID: ${personnelAuthUserIdToUpdate}). Dati: ${JSON.stringify(updates)}`);
    fetchKeyPersonnelList();
    // If the updated user is the current user, refresh their profile data
    if (currentAuthUser?.id === personnelAuthUserIdToUpdate) {
        const { data: updatedProfile } = await supabase.from('key_personnel').select('*').eq('auth_user_id', personnelAuthUserIdToUpdate).single();
        if (updatedProfile) {
             setCurrentKeyPersonnel({
                id: updatedProfile.id,
                auth_user_id: updatedProfile.auth_user_id,
                name: updatedProfile.name,
                email: currentAuthUser.email, // Email from auth user, not profile table
                role: updatedProfile.role as KeyPersonnelRole,
            });
            setIsAdminAuthenticated(updatedProfile.role === KeyPersonnelRole.ADMIN);
        }
    }
    return { success: true };
  };

  const removeKeyPersonnel = async (personnelAuthUserIdToRemove: string): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
     if (!currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
        return { success: false, message: "Azione non autorizzata." };
    }
    // Prevent admin from deleting themselves via this UI flow
    if (currentAuthUser?.id === personnelAuthUserIdToRemove) {
        return { success: false, message: "Non puoi rimuovere te stesso." };
    }

    // Deleting the profile from 'key_personnel' table
    const kpToRemove = keyPersonnelList.find(kp => kp.auth_user_id === personnelAuthUserIdToRemove);
    const { error: profileError } = await supabase.from('key_personnel').delete().eq('auth_user_id', personnelAuthUserIdToRemove);
    if (profileError) {
      console.error('Error deleting key personnel profile:', profileError.message || JSON.stringify(profileError));
      return { success: false, message: `Profile Deletion Error: ${profileError.message}` };
    }
    // Deleting from auth.users requires admin privileges (service_role key) and should be done via a backend function.
    // Inform the admin about this limitation.
    console.warn(`User profile for ${kpToRemove?.name || personnelAuthUserIdToRemove} deleted. Actual Supabase Auth user deletion requires a backend function using the service_role key.`);
    
    addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Rimosso profilo utente chiave: ${kpToRemove?.name || personnelAuthUserIdToRemove}. L'utente Supabase Auth potrebbe richiedere rimozione manuale o via backend.`);
    fetchKeyPersonnelList();
    return { success: true };
  };
  
  const getKeyPersonnelByAuthId = useCallback((authUserId: string) => keyPersonnelList.find(p => p.auth_user_id === authUserId), [keyPersonnelList]);
  
  const availableYears = useCallback(() => {
    const yearsFromData = Object.keys(yearlySedeData).map(y => parseInt(y));
    if (currentYear && !yearsFromData.includes(currentYear)) {
      yearsFromData.push(currentYear);
    }
    const uniqueYears = Array.from(new Set(yearsFromData)).filter(y => !isNaN(y));
    return uniqueYears.length > 0 ? uniqueYears.sort((a,b) => b - a) : [new Date().getFullYear()];
  }, [yearlySedeData, currentYear]);


  const fetchDataForSedeAndYear = useCallback(async (sedeId: string, year: number) => {
    if (!supabase || !isSupabaseConfigured || !sedeId || !year) {
      const sedeNameForCache = sedi.find(s=>s.id === sedeId)?.name || sedeId || "unknown_sede";
      if (year && sedeNameForCache) { // Ensure year and sedeName are valid before setting empty data
        setYearlySedeData(prevYSD => ({
          ...prevYSD,
          [year]: { ...(prevYSD[year] || {}), [sedeNameForCache]: getInitialSedeSpecificData() }
        }));
      }
      return;
    }
    
    const sedeName = sedi.find(s => s.id === sedeId)?.name || sedeId;
    console.log(`Fetching data for Sede ID: ${sedeId} (${sedeName}), Year: ${year}`);
    try {
      const [employeesRes, coursesRes, assignmentsRes, planRecordRes] = await Promise.all([
        supabase.from('employees').select('*, role_history(*)').eq('sede_id', sedeId).eq('year', year),
        supabase.from('courses').select('*, course_approvals(*)').eq('sede_id', sedeId).eq('year', year),
        supabase.from('assignments').select('*').eq('sede_id', sedeId).eq('year', year),
        supabase.from('plan_records').select('*, plan_approvals(*), created_by:key_personnel!created_by_user_id(name), last_modified_by:key_personnel!last_modified_by_user_id(name)')
        .eq('sede_id', sedeId).eq('year', year).maybeSingle() // maybeSingle() handles 0 or 1 row
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (planRecordRes.error && planRecordRes.error.code !== 'PGRST116') throw planRecordRes.error; // PGRST116 means 0 rows, which is fine for maybeSingle

      const fetchedData: SedeSpecificData = {
        employees: (employeesRes.data || []).map(e => ({...e, roleHistory: e.role_history || [] })), // Ensure roleHistory is always an array
        courses: (coursesRes.data || []).map(c => ({...c, approvals: c.course_approvals || []})),      // Ensure approvals is always an array
        assignments: assignmentsRes.data || [],
        planRecord: planRecordRes.data ? { 
            ...planRecordRes.data, 
            approvals: planRecordRes.data.plan_approvals || [], // Ensure approvals is always an array
            created_by_user_id: planRecordRes.data.created_by_user_id || undefined,
            created_by_name: (planRecordRes.data.created_by as any)?.name || undefined, 
            last_modified_by_user_id: planRecordRes.data.last_modified_by_user_id || undefined,
            last_modified_by_name: (planRecordRes.data.last_modified_by as any)?.name || undefined,
            last_modified_at: planRecordRes.data.last_modified_at || undefined
        } : undefined,
      };
      
      setYearlySedeData(prevYSD => ({
        ...prevYSD,
        [year]: { ...(prevYSD[year] || {}), [sedeName]: fetchedData }
      }));
    } catch (error: any) {
      console.error(`Error fetching data for ${sedeName}/${year}:`, error.message || JSON.stringify(error));
      addAuditLogEntry(LogAction.DATA_DOWNLOAD, `Errore caricamento dati per Sede ${sedeName}/${year}: ${error.message}`, sedeId, year);
       setYearlySedeData(prevYSD => ({
        ...prevYSD,
        [year]: { ...(prevYSD[year] || {}), [sedeName]: getInitialSedeSpecificData() }
      }));
    }
  }, [sedi, supabase, addAuditLogEntry, isSupabaseConfigured]); // Added isSupabaseConfigured

  const getSedeDataFromCache = useCallback((): SedeSpecificData | undefined => {
    if (!currentSedeId || !currentYear) return undefined;
    const sedeName = sedi.find(s => s.id === currentSedeId)?.name;
    if (!sedeName) return undefined;
    return yearlySedeData[currentYear]?.[sedeName];
  }, [currentSedeId, currentYear, yearlySedeData, sedi]);

  const getSedeEmployees = useCallback(() => getSedeDataFromCache()?.employees || [], [getSedeDataFromCache]);
  const getSedeCourses = useCallback(() => getSedeDataFromCache()?.courses || [], [getSedeDataFromCache]);
  const getSedeAssignments = useCallback(() => getSedeDataFromCache()?.assignments || [], [getSedeDataFromCache]);
  const getSedePlanRecord = useCallback(() => getSedeDataFromCache()?.planRecord, [getSedeDataFromCache]);

  const addEmployee = async (empData: Omit<Employee, 'id' | 'sede_id' | 'year' | 'roleHistory'> & { initialRole: string; initialRoleStartDate: string }): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured || !currentSedeId || !currentYear) return { success: false, message: "Sede o anno non selezionati." };
    if(!currentKeyPersonnel || (currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN && currentKeyPersonnel.role !== KeyPersonnelRole.QA_SITO)) {
        addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Tentativo fallito (non Admin/QA_SITO) da ${currentKeyPersonnel?.name}: ${empData.name}`);
        return { success: false, message: "Azione non autorizzata." };
    }
    const { error } = await supabase.from('employees').insert({ 
        sede_id: currentSedeId, 
        year: currentYear, 
        name: empData.name, 
        current_role: empData.initialRole 
        // role_history for initial role should be handled by a trigger or subsequent insert
    });
    if (error) {
        addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Errore aggiunta dipendente ${empData.name}: ${error.message}`);
        return { success: false, message: error.message };
    }
    // TODO: Add initial role to role_history table via a separate call or Supabase function/trigger
    fetchDataForSedeAndYear(currentSedeId, currentYear); 
    addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Aggiunto dipendente: ${empData.name}`);
    return { success: true };
  };
  
  const addCourse = async (courseData: Omit<TrainingCourse, 'id' | 'sede_id' | 'year' | 'status' | 'approvals'>): Promise<{ success: boolean, message?: string, newCourse?: TrainingCourse }> => {
    if (!supabase || !isSupabaseConfigured || !currentSedeId || !currentYear) return { success: false, message: "Sede o anno non selezionati." };
    if(!currentKeyPersonnel || (currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN && currentKeyPersonnel.role !== KeyPersonnelRole.QA_SITO)) {
        addAuditLogEntry(LogAction.ADD_COURSE, `Tentativo fallito (non Admin/QA_SITO) da ${currentKeyPersonnel?.name}: ${courseData.name}`);
        return { success: false, message: "Azione non autorizzata." };
    }
    const dataToInsert = {
        ...courseData,
        sede_id: currentSedeId,
        year: currentYear,
        status: TrainingCourseStatus.BOZZA // Default status for new course
    };
    const { data, error } = await supabase.from('courses').insert(dataToInsert).select().single();
    if (error) {
        addAuditLogEntry(LogAction.ADD_COURSE, `Errore aggiunta corso ${courseData.name}: ${error.message}`);
        return { success: false, message: error.message };
    }
    fetchDataForSedeAndYear(currentSedeId, currentYear);
    addAuditLogEntry(LogAction.ADD_COURSE, `Aggiunto corso: ${courseData.name}`);
    return { success: true, newCourse: data as TrainingCourse };
  };

  const updateCourse = async (courseId: string, updates: Partial<Omit<TrainingCourse, 'id' | 'sede_id' | 'year'>>): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured || !currentSedeId || !currentYear) return { success: false, message: "Sede o anno non selezionati." };
    if(!currentKeyPersonnel || (currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN && currentKeyPersonnel.role !== KeyPersonnelRole.QA_SITO)) {
        addAuditLogEntry(LogAction.UPDATE_COURSE, `Tentativo fallito (non Admin/QA_SITO) da ${currentKeyPersonnel?.name} per corso ID: ${courseId}`);
        return { success: false, message: "Azione non autorizzata." };
    }
    const { error } = await supabase.from('courses').update(updates).eq('id', courseId);
    if (error) {
        addAuditLogEntry(LogAction.UPDATE_COURSE, `Errore aggiornamento corso ID ${courseId}: ${error.message}`);
        return { success: false, message: error.message };
    }
    fetchDataForSedeAndYear(currentSedeId, currentYear);
    addAuditLogEntry(LogAction.UPDATE_COURSE, `Aggiornato corso ID ${courseId}. Dati: ${JSON.stringify(updates)}`);
    return { success: true };
  };

    const approveCourseByQP = async (courseId: string): Promise<{ success: boolean, message?: string }> => {
        if (!supabase || !isSupabaseConfigured || !currentSedeId || !currentYear || !currentKeyPersonnel || currentKeyPersonnel.role !== KeyPersonnelRole.QP) {
            addAuditLogEntry(LogAction.APPROVE_COURSE_QP, `Tentativo fallito (non QP o dati mancanti) per corso ID: ${courseId}`);
            return { success: false, message: "Azione non autorizzata o dati mancanti." };
        }
        const course = getSedeCourses().find(c => c.id === courseId);
        if (!course) return { success: false, message: "Corso non trovato."};

        // 1. Update course status
        const { error: updateError } = await supabase.from('courses')
            .update({ status: TrainingCourseStatus.APPROVATO_QP })
            .eq('id', courseId);
        if (updateError) {
            addAuditLogEntry(LogAction.APPROVE_COURSE_QP, `Errore aggiornamento stato corso ID ${courseId}: ${updateError.message}`);
            return { success: false, message: `Errore aggiornamento stato corso: ${updateError.message}`};
        }

        // 2. Add entry to course_approvals
        const { error: approvalError } = await supabase.from('course_approvals').insert({
            course_id: courseId,
            qp_auth_user_id: currentKeyPersonnel.auth_user_id,
            qp_name: currentKeyPersonnel.name
            // approval_date is defaulted to now() by Postgres
        });
        if (approvalError) { 
            // Potentially rollback course status update or log inconsistency
            addAuditLogEntry(LogAction.APPROVE_COURSE_QP, `Corso ID ${courseId} stato aggiornato ma errore registrazione approvazione: ${approvalError.message}`);
            return { success: false, message: `Errore registrazione approvazione: ${approvalError.message}. Stato corso modificato.`};
        }
        
        fetchDataForSedeAndYear(currentSedeId, currentYear);
        addAuditLogEntry(LogAction.APPROVE_COURSE_QP, `Corso '${course.name}' (ID: ${courseId}) approvato da QP ${currentKeyPersonnel.name}.`);
        return { success: true };
    };

  // GxP Plan Approval Logic
  const approveOrRejectPlanStep = async (
    planRecordId: string, 
    approvingRole: KeyPersonnelRole.QP | KeyPersonnelRole.QA_CENTRALE,
    decision: 'Approvato' | 'Rigettato',
    comment?: string
  ): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured || !currentSedeId || !currentYear || !currentKeyPersonnel) {
        return { success: false, message: "Azione non autorizzata o dati mancanti." };
    }
    // Ensure the current user has the role they are claiming to approve/reject as, or is Admin
    if (currentKeyPersonnel.role !== approvingRole && currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) { 
        addAuditLogEntry(LogAction.PLAN_APPROVE_REJECT, `Tentativo fallito (ruolo non ${approvingRole}) da ${currentKeyPersonnel.name} per piano ID: ${planRecordId}`);
        return { success: false, message: `Azione non autorizzata. Richiesto ruolo ${approvingRole}.` };
    }

    const planRecord = getSedePlanRecord();
    if (!planRecord || planRecord.id !== planRecordId) {
         return { success: false, message: "Piano non trovato o non valido." };
    }

    let nextStatus: PlanStatus | null = null;

    // Determine the next status based on the current status, approving role, and decision
    if (approvingRole === KeyPersonnelRole.QP) {
        if (decision === 'Approvato') {
            // QP can approve if it's IN_APPROVAZIONE_QP or if it was rejected by QA_CENTRALE and needs re-approval by QP
            if (planRecord.status === PlanStatus.IN_APPROVAZIONE_QP || planRecord.status === PlanStatus.RIGETTATO_QA_CENTRALE) {
                 nextStatus = PlanStatus.APPROVATO_QP; // Next step could be IN_APPROVAZIONE_QA_CENTRALE if QA_CENTRALE is also required
            } else { return { success: false, message: `Stato piano (${planRecord.status}) non valido per approvazione QP.`};}
        } else { // Rigettato
            nextStatus = PlanStatus.RIGETTATO_QP;
        }
    } else if (approvingRole === KeyPersonnelRole.QA_CENTRALE) {
        if (decision === 'Approvato') {
            // QA_CENTRALE can approve if it's IN_APPROVAZIONE_QA_CENTRALE (meaning QP already approved)
            if (planRecord.status === PlanStatus.IN_APPROVAZIONE_QA_CENTRALE || planRecord.status === PlanStatus.APPROVATO_QP) {
                nextStatus = PlanStatus.APPROVATO; // Final approval state
            } else { return { success: false, message: `Stato piano (${planRecord.status}) non valido per approvazione QA Centrale.`};}
        } else { // Rigettato
            nextStatus = PlanStatus.RIGETTATO_QA_CENTRALE;
        }
    }

    if (!nextStatus) return { success: false, message: "Logica di stato non determinata."};

    // 1. Update plan_records status
    const { error: updateError } = await supabase.from('plan_records')
        .update({ status: nextStatus, last_modified_by_user_id: currentAuthUser?.id }) // last_modified_at updates via trigger
        .eq('id', planRecordId);
    if (updateError) {
        addAuditLogEntry(LogAction.PLAN_APPROVE_REJECT, `Errore aggiornamento stato piano ID ${planRecordId}: ${updateError.message}`);
        return { success: false, message: `Errore aggiornamento stato piano: ${updateError.message}`};
    }
    
    // 2. Add entry to plan_approvals
    const { error: approvalError } = await supabase.from('plan_approvals').insert({
        plan_record_id: planRecordId,
        approver_auth_user_id: currentKeyPersonnel.auth_user_id,
        approver_name: currentKeyPersonnel.name,
        approver_role: currentKeyPersonnel.role, // Log the actual role of the user performing action
        approval_status: decision,
        approval_comment: comment,
        approval_step: `${approvingRole}_APPROVAL` // Log which step this approval pertains to
    });
    if (approvalError) {
        // Consider rolling back the status update or logging the inconsistency
        addAuditLogEntry(LogAction.PLAN_APPROVE_REJECT, `Piano ID ${planRecordId} stato aggiornato a ${nextStatus} ma errore registrazione approvazione: ${approvalError.message}`);
        return { success: false, message: `Errore registrazione approvazione piano: ${approvalError.message}. Stato piano modificato.`};
    }

    fetchDataForSedeAndYear(currentSedeId, currentYear);
    addAuditLogEntry(LogAction.PLAN_APPROVE_REJECT, `Piano per Sede ID ${currentSedeId}/${currentYear} (ID: ${planRecordId}) ${decision.toLowerCase()} da ${currentKeyPersonnel.name} (${approvingRole}). Nuovo stato: ${nextStatus}. Commento: ${comment || 'N/A'}`);
    return { success: true };
  };

  const submitPlanForApproval = async (
    planRecordId: string, 
    targetRole: KeyPersonnelRole.QP | KeyPersonnelRole.QA_CENTRALE
  ): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured || !currentSedeId || !currentYear || !currentKeyPersonnel) {
      return { success: false, message: "Dati mancanti o utente non loggato." };
    }
    // Typically QA_SITO or ADMIN submits the plan
    if (currentKeyPersonnel.role !== KeyPersonnelRole.QA_SITO && currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN) {
        addAuditLogEntry(LogAction.PLAN_SUBMIT_FOR_APPROVAL, `Tentativo invio piano ID ${planRecordId} fallito: utente ${currentKeyPersonnel.name} non autorizzato (QA_SITO o Admin richiesto).`);
        return { success: false, message: "Azione non autorizzata (solo QA_SITO o Admin possono inviare il piano)." };
    }
    
    const planRecord = getSedePlanRecord();
    if (!planRecord || planRecord.id !== planRecordId) {
      return { success: false, message: "Piano non trovato." };
    }

    let nextStatus: PlanStatus | null = null;
    let requiredCurrentStatus: PlanStatus[] = [];

    if (targetRole === KeyPersonnelRole.QP) {
        nextStatus = PlanStatus.IN_APPROVAZIONE_QP;
        // QA_SITO can submit a BOZZA, or a plan rejected by QP or QA_CENTRALE (after fixes), or one in IN_REVISIONE_QA_SITO
        requiredCurrentStatus = [PlanStatus.BOZZA, PlanStatus.RIGETTATO_QP, PlanStatus.RIGETTATO_QA_CENTRALE, PlanStatus.IN_REVISIONE_QA_SITO];
    } else if (targetRole === KeyPersonnelRole.QA_CENTRALE) {
        nextStatus = PlanStatus.IN_APPROVAZIONE_QA_CENTRALE;
        // Plan can be submitted to QA_CENTRALE only if QP has approved it.
        requiredCurrentStatus = [PlanStatus.APPROVATO_QP]; 
    }

    if (!nextStatus || !requiredCurrentStatus.includes(planRecord.status)) {
        addAuditLogEntry(LogAction.PLAN_SUBMIT_FOR_APPROVAL, `Tentativo invio piano ID ${planRecordId} a ${targetRole} fallito: stato piano attuale (${planRecord.status}) non valido.`);
        return { success: false, message: `Stato piano attuale (${planRecord.status}) non valido per invio a ${targetRole}. Richiesto uno tra: ${requiredCurrentStatus.join(', ')}` };
    }

    // Check if all courses are approved by QP before submitting to QA_CENTRALE
    if (targetRole === KeyPersonnelRole.QA_CENTRALE) {
        const courses = getSedeCourses();
        const nonQPCourses = courses.filter(c => 
            c.status !== TrainingCourseStatus.APPROVATO_QP && 
            c.status !== TrainingCourseStatus.PIANIFICATO && // Pianificato implica approvato
            c.status !== TrainingCourseStatus.COMPLETATO   // Completato implica approvato
        );
        if (nonQPCourses.length > 0) {
            addAuditLogEntry(LogAction.PLAN_SUBMIT_FOR_APPROVAL, `Tentativo invio piano ID ${planRecordId} a QA_CENTRALE fallito: non tutti i corsi sono approvati QP.`);
            return { success: false, message: `Non tutti i corsi sono approvati dal QP. Corsi in sospeso: ${nonQPCourses.map(c=>c.name).join(', ')}`};
        }
    }


    const { error } = await supabase.from('plan_records')
        .update({ status: nextStatus, last_modified_by_user_id: currentAuthUser?.id })
        .eq('id', planRecordId);

    if (error) {
        addAuditLogEntry(LogAction.PLAN_SUBMIT_FOR_APPROVAL, `Errore invio piano ID ${planRecordId} a ${targetRole}: ${error.message}`);
        return { success: false, message: `Errore invio piano: ${error.message}` };
    }

    fetchDataForSedeAndYear(currentSedeId, currentYear);
    addAuditLogEntry(LogAction.PLAN_SUBMIT_FOR_APPROVAL, `Piano ID ${planRecordId} inviato per approvazione a ${targetRole} da ${currentKeyPersonnel.name}. Nuovo stato: ${nextStatus}`);
    return { success: true };
  };


  // Placeholder implementations for functions not fully migrated to Supabase yet
  const notImplPromise = async () => { alert("Funzione non ancora implementata con Supabase."); return { success: false, message: "Non implementato" }; };
  const notImplVoid = () => alert("Funzione non ancora implementata con Supabase.");
  const notImplGetter = () => { return undefined as any; };
  
  // CSV Import/Export - Keeping these fairly high-level for now
  const loadKeyPersonnelFromMasterCSV: DataContextType['loadKeyPersonnelFromMasterCSV'] = async (file) => {
      if (!supabase || !isSupabaseConfigured || !isAdminAuthenticated) return { success: false, message: "Non autorizzato o Supabase non pronto." };
      try {
        // Assumes CSV has headers: name, role, email, passwordPlain
        const parsed = await parseCSV<{name: string, role: KeyPersonnelRole, email: string, passwordPlain: string}>(file, (headers) => (row) => ({
            name: row[headers.indexOf('name')],
            role: row[headers.indexOf('role')] as KeyPersonnelRole, // Ensure role values match KeyPersonnelRole enum
            email: row[headers.indexOf('email')],
            passwordPlain: row[headers.indexOf('passwordplain')] // CSV header should be 'passwordplain'
        }));

        let successCount = 0;
        for (const p of parsed) {
            // Validate role from CSV against KeyPersonnelRole enum
            if (!Object.values(KeyPersonnelRole).includes(p.role)) {
                console.warn(`Ruolo '${p.role}' per utente '${p.name}' (email: ${p.email}) non valido. Riga saltata.`);
                continue;
            }
            const {success} = await addKeyPersonnel(p); // addKeyPersonnel handles both Auth and profile
            if (success) successCount++;
        }
        addAuditLogEntry(LogAction.DATA_UPLOAD, `Importati ${successCount}/${parsed.length} utenti chiave da CSV.`);
        return { success: true, count: successCount, message: `Importati ${successCount}/${parsed.length} utenti.` };
      } catch (e: any) { return { success: false, message: e.message }; }
  };
  
  const loadDataForSedeYearFromCSV: DataContextType['loadDataForSedeYearFromCSV'] = async (sedeId, year, dataType, file) => {
    if (!supabase || !isSupabaseConfigured || !currentSedeId || !currentYear) return { success: false, message: "Sede/Anno non selezionati o Supabase non pronto."};
    // Basic authorization check (Admin or QA_SITO for data loading)
    if (!currentKeyPersonnel || (currentKeyPersonnel.role !== KeyPersonnelRole.ADMIN && currentKeyPersonnel.role !== KeyPersonnelRole.QA_SITO)) {
        return {success: false, message: "Azione non autorizzata."};
    }

    if (dataType === 'employees') {
        try {
            // Assumes CSV headers: name, initialRole, initialRoleStartDate
            const parsed = await parseCSV<EmployeeCSVRow>(file, (headers) => (row) => ({
                name: row[headers.indexOf('name')],
                initialRole: row[headers.indexOf('initialrole')],
                initialRoleStartDate: row[headers.indexOf('initialrolestartdate')],
            }));
            let successCount = 0;
            for (const empCsv of parsed) {
                // Using addEmployee function which already handles inserts and role history (if implemented there)
                const { success: addSuccess } = await addEmployee({
                    name: empCsv.name,
                    currentRole: empCsv.initialRole, // Set by addEmployee
                    initialRole: empCsv.initialRole,
                    initialRoleStartDate: empCsv.initialRoleStartDate,
                });
                if (addSuccess) successCount++;
            }
            // fetchDataForSedeAndYear is called inside addEmployee if successful
            addAuditLogEntry(LogAction.DATA_UPLOAD, `Importati ${successCount}/${parsed.length} dipendenti da CSV per SedeID ${currentSedeId}/${currentYear}.`);
            return { success: true, count: successCount, message: `Importati ${successCount}/${parsed.length} dipendenti.` };
        } catch (e: any) { return { success: false, message: e.message }; }
    }
    // TODO: Implement CSV import for 'courses', 'assignments', 'planStatus' (planRecords)
    // For courses, ensure all new GxP fields are handled in CourseCSVRow and parsing logic.
    return { success: false, message: `Import CSV per ${dataType} non ancora implementato.` };
  };

  const exportDataToCSV: DataContextType['exportDataToCSV'] = async (exportType, sedeIdParam, yearParam) => {
    if (!supabase || !isSupabaseConfigured) { alert("Supabase non pronto."); return; }
    const targetSedeId = sedeIdParam || currentSedeId;
    const targetYear = yearParam || currentYear;

    let dataToExport: any[] = [];
    let filenameElements: any = { type: exportType };

    if (!targetSedeId || !targetYear) {
        if (exportType === 'keyPersonnel' || exportType === 'auditTrail') {
            // These are global, no sede/year needed for query
        } else {
            alert("Sede e Anno devono essere selezionati per questo export."); return;
        }
    } else {
        filenameElements.sede = sedi.find(s => s.id === targetSedeId)?.name || targetSedeId;
        filenameElements.year = targetYear.toString();
    }

    try {
        switch(exportType) {
            case 'employees':
                const { data: empData, error: empErr } = await supabase.from('employees').select('id, name, current_role, sede_id, year').eq('sede_id', targetSedeId!).eq('year', targetYear!);
                if(empErr) throw empErr; dataToExport = empData || []; break;
            case 'courses': 
                // Select all relevant fields for CSV export
                const { data: crsData, error: crsErr } = await supabase.from('courses')
                    .select('id, name, description, date, duration_hours, category, status, training_type, trainer_info, planned_period, gxp_area, sede_id, year')
                    .eq('sede_id', targetSedeId!).eq('year', targetYear!);
                if(crsErr) throw crsErr; dataToExport = crsData || []; break;
            case 'assignments':
                 const { data: assData, error: assErr } = await supabase.from('assignments').select('*').eq('sede_id', targetSedeId!).eq('year', targetYear!);
                if(assErr) throw assErr; dataToExport = assData || []; break;
            case 'planRecords':
                 const { data: planData, error: planErr } = await supabase.from('plan_records').select('id, sede_id, year, status').eq('sede_id', targetSedeId!).eq('year', targetYear!);
                if(planErr) throw planErr; dataToExport = planData || []; break;
            case 'keyPersonnel':
                // For keyPersonnel, email is in auth_users, so a join or separate query might be needed if email is essential for export.
                // For simplicity, exporting from key_personnel table directly.
                const { data: kpData, error: kpErr } = await supabase.from('key_personnel').select('auth_user_id, name, role'); 
                if(kpErr) throw kpErr; dataToExport = kpData || []; filenameElements = { globalType: 'keyPersonnel'}; break;
            case 'auditTrail':
                 const { data: auditData, error: auditErr } = await supabase.from('audit_log').select('*').order('timestamp', {ascending: false}).limit(1000); // Limit export size for performance
                if(auditErr) throw auditErr; dataToExport = auditData || []; filenameElements = { globalType: 'auditTrail'}; break;
            case 'allData':
                // Exporting 'allData' would involve multiple calls and zipping files, or a server-side function.
                // For client-side, it's better to export them individually.
                alert("L'export 'allData' richiede l'esportazione separata dei singoli tipi di dato."); return;
            default: alert(`Export CSV per ${exportType} non ancora implementato.`); return;
        }
        if (dataToExport.length === 0 && exportType !== 'keyPersonnel' && exportType !== 'auditTrail' ) {
            alert(`Nessun dato da esportare per ${exportType} per la selezione corrente. Verrà scaricato un template vuoto (solo headers).`);
        }
        await exportCSVUtil(dataToExport, exportType, filenameElements); 
        addAuditLogEntry(LogAction.DATA_DOWNLOAD, `Esportato ${exportType} per SedeID ${targetSedeId || 'Globale'}/${targetYear || 'N/A'}.`);
    } catch (e: any) {
        alert(`Errore durante l'export CSV: ${e.message}`);
        addAuditLogEntry(LogAction.DATA_DOWNLOAD, `Errore export ${exportType}: ${e.message}`);
    }
  };
  
  const downloadAuditLog = async () => {
    await exportDataToCSV('auditTrail');
  };

  const setCurrentSedeId = (id: string | null) => {
    setCurrentSedeIdState(id);
    if (!id) { // Clear data if sede is deselected
        // setYearlySedeData(prev => ({ ...prev, [currentYear!]: { ...prev[currentYear!], [sedi.find(s => s.id === currentSedeId)?.name!]: getInitialSedeSpecificData() }}));
    }
  };
  
  return (
    <DataContext.Provider value={{ 
      sedi, currentSedeId, setCurrentSedeId, addSede, removeSede,
      currentYear, setCurrentYear: setCurrentYearState, availableYears,
      yearlySedeData, fetchDataForSedeAndYear,
      getSedeEmployees, getSedeCourses, getSedeAssignments, getSedePlanRecord,
      
      addEmployee, 
      updateEmployeeRole: notImplPromise, // TODO: Implement updateEmployeeRole with Supabase
      deleteEmployee: notImplPromise,  // TODO: Implement deleteEmployee with Supabase
      addCourse, updateCourse,
      deleteCourse: notImplPromise, // TODO: Implement deleteCourse with Supabase     
      approveCourseByQP,
      addAssignment: notImplPromise, // TODO: Implement addAssignment with Supabase    
      updateAssignmentStatus: notImplPromise, // TODO: Implement updateAssignmentStatus with Supabase
      addBatchAssignments: notImplPromise, // TODO: Implement addBatchAssignments with Supabase
      deleteAssignment: notImplPromise, // TODO: Implement deleteAssignment with Supabase
      
      getEmployeeById: notImplGetter,   // TODO: Implement getEmployeeById (can be client-side from cache or DB call)
      getCourseById: notImplGetter,     // TODO: Implement getCourseById (can be client-side from cache or DB call)
      clearCurrentSedeYearData: notImplVoid, // TODO: Implement clearCurrentSedeYearData (client-side cache clear)
      
      isAdminAuthenticated, currentKeyPersonnel,
      loginUser, logoutUser,
      keyPersonnelList, fetchKeyPersonnel: fetchKeyPersonnelList,
      addKeyPersonnel, updateKeyPersonnel, removeKeyPersonnel, getKeyPersonnelByAuthId,
      
      submitPlanForApproval, approveOrRejectPlanStep,
      
      addAuditLogEntry, downloadAuditLog,
      loadKeyPersonnelFromMasterCSV, loadDataForSedeYearFromCSV, exportDataToCSV,
      isSupabaseConfigured
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
  // The warning for Supabase not being initialized is now handled by the isSupabaseConfigured flag and UI message.
  // if (!supabase) { 
  //   console.warn("Supabase client not initialized. Check Supabase URL/Anon Key in .env.local and console for errors.");
  // }
  return context;
};