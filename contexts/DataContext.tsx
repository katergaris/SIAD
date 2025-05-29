
import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { createClient, SupabaseClient, Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';
import {
    Employee, TrainingCourse, TrainingAssignment, AssignmentStatus, TrainingCourseStatus,
    YearlySedeData, SedeSpecificData, BatchAssignmentPayload,
    KeyPersonnel, PlanStatus, CourseApproval, PlanApproval, PlanRecord, DataContextType, CSVExportType,
    AuditEntry, LogAction, KeyPersonnelRole, NewKeyPersonnelPayload, UpdateKeyPersonnelPayload,
    TrainingType, RoleEntry
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
      user_role: userForAudit?.roles?.join(', ') || (authUserForAudit ? 'AuthenticatedUser' : 'System/Unknown'),
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
        // Ensure you are selecting the 'roles' column (plural)
        const { data: profile, error } = await supabase
          .from('key_personnel')
          .select('id, auth_user_id, name, roles') // Select 'roles'
          .eq('auth_user_id', supabaseUser.id)
          .single();

        if (error && error.code !== 'PGRST116') {
             console.error('[DataContext] Error fetching key personnel profile:', error.message || JSON.stringify(error), 'Details:', error);
             setCurrentKeyPersonnel(null);
             setIsAdminAuthenticated(false);
             stableAddAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, `Errore caricamento profilo per ${supabaseUser.email}: ${error.message || JSON.stringify(error)}`, currentSedeId, currentYear, null, supabaseUser);
        } else if (profile) {
            console.log(`[DataContext] Profile fetched for ${supabaseUser.email}:`, profile);
            
            // Ensure profile.roles is an array and validate its contents
            const rolesArray = Array.isArray(profile.roles) ? profile.roles : [];
            const validRoles = rolesArray.filter(r => Object.values(KeyPersonnelRole).includes(r as KeyPersonnelRole));

            if (validRoles.length === 0) {
                console.warn(`[DataContext] Fetched profile for ${supabaseUser.email} has no valid roles or 'roles' is not a valid array: '${JSON.stringify(profile.roles)}'. Expected array of [${Object.values(KeyPersonnelRole).join(', ')}]. Treating as no valid profile.`);
                setCurrentKeyPersonnel(null);
                setIsAdminAuthenticated(false);
                stableAddAuditLogEntry(LogAction.USER_LOGIN_ATTEMPT, `Profilo ${supabaseUser.email} con ruoli non validi o mancanti: ${JSON.stringify(profile.roles)}`, currentSedeId, currentYear, null, supabaseUser);
            } else {
                const kpProfile: KeyPersonnel = {
                    id: profile.id,
                    auth_user_id: profile.auth_user_id,
                    name: profile.name,
                    email: supabaseUser.email,
                    roles: validRoles as KeyPersonnelRole[],
                };
                setCurrentKeyPersonnel(kpProfile);
                const isAdmin = kpProfile.roles.includes(KeyPersonnelRole.ADMIN);
                setIsAdminAuthenticated(isAdmin);
                console.log(`[DataContext] User ${kpProfile.name} logged in. Roles: ${kpProfile.roles.join(', ')}. isAdmin: ${isAdmin}`);
                stableAddAuditLogEntry(LogAction.LOGIN, `Login riuscito per ${kpProfile.name} (${kpProfile.roles.join(', ')})`, currentSedeId, currentYear, kpProfile, supabaseUser);
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
            stableAddAuditLogEntry(LogAction.LOGOUT, `Logout per ${currentKeyPersonnel.name} (${currentKeyPersonnel.roles.join(', ')})`, currentSedeId, currentYear, currentKeyPersonnel, currentAuthUser);
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
    if (!currentKeyPersonnel || !currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN)) {
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
    if (!currentKeyPersonnel || !currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN)) {
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
            roles, 
            auth_users (email)
        `);

    if (error) {
        console.error('[DataContext] Error fetching key personnel list:', error.message || JSON.stringify(error));
    } else {
        const mappedData = data?.map(p => ({
            id: p.id,
            auth_user_id: p.auth_user_id,
            name: p.name,
            roles: Array.isArray(p.roles) ? p.roles as KeyPersonnelRole[] : [], // Ensure roles is an array
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
    // onAuthStateChange will handle setting currentKeyPersonnel
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
    // onAuthStateChange will clear currentKeyPersonnel
    console.log(`[DataContext] Logout successful.`);
    return { success: true };
  };

  const addKeyPersonnel = async (payload: NewKeyPersonnelPayload): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    if (!currentKeyPersonnel || !currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN)) {
        addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Tentativo fallito (non Admin) da ${currentKeyPersonnel?.name || 'utente sconosciuto'} per ${payload.name}`);
        return { success: false, message: "Azione non autorizzata." };
    }
    if (!payload.roles || payload.roles.length === 0) {
        return { success: false, message: "È necessario specificare almeno un ruolo." };
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
      roles: payload.roles, // Insert roles array
    });

    if (profileError) {
      console.error('[DataContext] Error creating key personnel profile:', profileError.message || JSON.stringify(profileError));
      addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Errore profilo utente chiave ${payload.name} (AuthID: ${authData.user.id}): ${profileError.message}. Utente Auth creato.`);
      // Consider deleting the auth user if profile creation fails to avoid orphaned auth users
      // await supabase.auth.admin.deleteUser(authData.user.id) // Requires admin privileges for Supabase client
      return { success: false, message: `Profile Error: ${profileError.message}. Utente Auth creato ma profilo fallito.` };
    }

    addAuditLogEntry(LogAction.ADD_KEY_PERSONNEL, `Aggiunto utente chiave: ${payload.name} (${payload.roles.join(', ')}), Email: ${payload.email}`);
    fetchKeyPersonnelList();
    return { success: true };
  };

  const updateKeyPersonnel = async (personnelAuthUserIdToUpdate: string, updates: UpdateKeyPersonnelPayload): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
     if (!currentKeyPersonnel || !currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN)) {
        addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Tentativo fallito (non Admin) da ${currentKeyPersonnel?.name || 'utente sconosciuto'} per utente AuthID ${personnelAuthUserIdToUpdate}`);
        return { success: false, message: "Azione non autorizzata." };
    }

    let profileUpdated = false;
    let passwordUpdatedSuccessfully = false;

    if (updates.name || updates.roles) {
        const profileUpdates: Partial<Omit<KeyPersonnel, 'id' | 'auth_user_id' | 'email'>> = {};
        if(updates.name) profileUpdates.name = updates.name;
        if(updates.roles) {
            if (updates.roles.length === 0) {
                return { success: false, message: "L'utente deve avere almeno un ruolo." };
            }
            profileUpdates.roles = updates.roles;
        }

        if (Object.keys(profileUpdates).length > 0) {
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
    }

    if (updates.newPasswordPlain) {
        // Password update for self or by admin (admin case needs special handling, often server-side)
        if (currentAuthUser?.id === personnelAuthUserIdToUpdate) { // User updates their own password
             const { error: passwordError } = await supabase.auth.updateUser({ password: updates.newPasswordPlain });
             if (passwordError) {
                console.error('[DataContext] Error updating user password (self):', passwordError.message || JSON.stringify(passwordError));
                addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Errore aggiornamento password (self) per utente AuthID ${personnelAuthUserIdToUpdate}: ${passwordError.message}`);
                return { success: false, message: `Password Update Error: ${passwordError.message}` };
            }
            passwordUpdatedSuccessfully = true;
        } else if (currentKeyPersonnel?.roles.includes(KeyPersonnelRole.ADMIN)) { // Admin attempts to update another user's password
           // IMPORTANT: supabase.auth.admin.updateUserById() is required for this and needs service_role key.
           // This client-side attempt with anon key will fail for other users.
           console.warn(`[DataContext] Admin password change for another user (AuthID: ${personnelAuthUserIdToUpdate}) initiated. This typically requires server-side logic with a service_role key. Client-side updateUser is for the current session user.`);
           // For now, let's prevent this on client, or inform it might not work as expected.
           addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Tentativo di Admin di cambiare password per utente AuthID ${personnelAuthUserIdToUpdate} - operazione da effettuare con privilegi elevati (service_role) non disponibili client-side.`);
           // To make this work, you'd call a Supabase Edge Function.
           return { success: false, message: "La modifica della password di altri utenti da parte dell'admin richiede un'operazione server-side con privilegi elevati." };
        } else {
            addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Tentativo non autorizzato di cambio password per utente AuthID ${personnelAuthUserIdToUpdate}.`);
            return { success: false, message: "Non autorizzato a cambiare password per questo utente."};
        }
    }

    if (profileUpdated || passwordUpdatedSuccessfully) {
        addAuditLogEntry(LogAction.UPDATE_KEY_PERSONNEL, `Personale chiave aggiornato (AuthID: ${personnelAuthUserIdToUpdate}): Profilo: ${profileUpdated}, Password: ${passwordUpdatedSuccessfully}`);
        fetchKeyPersonnelList(); // Refresh the list in UI
        // If the updated user is the current user, refresh their profile
        if (currentKeyPersonnel?.auth_user_id === personnelAuthUserIdToUpdate) {
            const { data: updatedProfile, error: fetchError } = await supabase
                .from('key_personnel')
                .select('id, auth_user_id, name, roles')
                .eq('auth_user_id', personnelAuthUserIdToUpdate)
                .single();
            if (updatedProfile && !fetchError) {
                 const kpProfile: KeyPersonnel = {
                    id: updatedProfile.id,
                    auth_user_id: updatedProfile.auth_user_id,
                    name: updatedProfile.name,
                    email: currentKeyPersonnel.email, // email doesn't change here
                    roles: Array.isArray(updatedProfile.roles) ? updatedProfile.roles as KeyPersonnelRole[] : [],
                };
                setCurrentKeyPersonnel(kpProfile);
                setIsAdminAuthenticated(kpProfile.roles.includes(KeyPersonnelRole.ADMIN));
            }
        }
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
    
    const addEmployee = async (employeeData: Omit<Employee, 'id' | 'sede_id' | 'year' | 'roleHistory'> & { initialRole: string; initialRoleStartDate: string }): Promise<{ success: boolean, message?: string }> => {
        if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
        if (!currentSedeId || !currentYear) return { success: false, message: "Sede o Anno non selezionati." };
        if (!currentKeyPersonnel || !(currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN) || currentKeyPersonnel.roles.includes(KeyPersonnelRole.QA_SITO))) {
            addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Tentativo fallito (non autorizzato) da ${currentKeyPersonnel?.name || 'utente sconosciuto'} per ${employeeData.name}`);
            return { success: false, message: "Azione non autorizzata." };
        }

        const sedeName = sedi.find(s => s.id === currentSedeId)?.name || currentSedeId;
        const newEmployeePayload = {
            name: employeeData.name,
            currentRole: employeeData.initialRole,
            sede_id: currentSedeId,
            year: currentYear,
        };

        const { data: newEmployee, error } = await supabase
            .from('employees')
            .insert(newEmployeePayload)
            .select()
            .single();

        if (error || !newEmployee) {
            console.error('[DataContext] Error adding employee:', error?.message);
            addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Errore aggiunta dipendente ${employeeData.name} per ${sedeName}/${currentYear}: ${error?.message}`);
            return { success: false, message: error?.message || "Errore sconosciuto nell'aggiunta dipendente." };
        }
        
        // Add initial role to role_history
        const initialRoleEntry: Omit<RoleEntry, 'id'> & { employee_id: string } = {
            employee_id: newEmployee.id,
            role: employeeData.initialRole,
            startDate: employeeData.initialRoleStartDate,
            endDate: null,
        };
        const { error: roleHistoryError } = await supabase.from('role_history').insert(initialRoleEntry);
        if (roleHistoryError) {
             console.error('[DataContext] Error adding initial role history:', roleHistoryError?.message);
             addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Dipendente ${employeeData.name} aggiunto, ma errore storico ruolo: ${roleHistoryError?.message}`);
             // Consider if employee should be deleted if role history fails
        }

        const completeNewEmployee: Employee = {
            ...newEmployee,
            roleHistory: roleHistoryError ? [] : [{...initialRoleEntry}] // Simplified, might need to re-fetch
        };

        setYearlySedeData(prevYSD => {
            const updatedYearData = { ...(prevYSD[currentYear!] || {}) };
            const updatedSedeData = { ...(updatedYearData[sedeName] || getInitialSedeSpecificData()) };
            updatedSedeData.employees = [...updatedSedeData.employees, completeNewEmployee];
            updatedYearData[sedeName] = updatedSedeData;
            return { ...prevYSD, [currentYear!]: updatedYearData };
        });

        addAuditLogEntry(LogAction.ADD_EMPLOYEE, `Aggiunto dipendente: ${employeeData.name} (Ruolo: ${employeeData.initialRole}) per ${sedeName}/${currentYear}`);
        return { success: true };
    };

    const updateEmployeeRole = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const deleteEmployee = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    
    const addCourse = async (courseData: Omit<TrainingCourse, 'id' | 'sede_id' | 'year' | 'status' | 'approvals'>): Promise<{ success: boolean, message?: string, newCourse?: TrainingCourse }> => {
        if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
        if (!currentSedeId || !currentYear) return { success: false, message: "Sede o Anno non selezionati." };
        if (!currentKeyPersonnel || !(currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN) || currentKeyPersonnel.roles.includes(KeyPersonnelRole.QA_SITO))) {
            addAuditLogEntry(LogAction.ADD_COURSE, `Tentativo fallito (non autorizzato) da ${currentKeyPersonnel?.name || 'utente sconosciuto'} per ${courseData.name}`);
            return { success: false, message: "Azione non autorizzata." };
        }
        const planRecord = getSedePlanRecord();
        if (!planRecord) {
            addAuditLogEntry(LogAction.ADD_COURSE, `Tentativo fallito: Piano Formativo non esistente per ${currentSedeId}/${currentYear} per corso ${courseData.name}`);
            return { success: false, message: "Piano Formativo Annuale non trovato. Creane uno prima di aggiungere corsi." };
        }

        const sedeName = sedi.find(s => s.id === currentSedeId)?.name || currentSedeId;
        const newCoursePayload = {
            ...courseData,
            sede_id: currentSedeId,
            year: currentYear,
            status: TrainingCourseStatus.BOZZA,
            created_by_user_id: currentAuthUser?.id || null // Assuming your table has this
        };

        const { data: newCourse, error } = await supabase
            .from('courses')
            .insert(newCoursePayload)
            .select('*, course_approvals(*)') // Ensure approvals (even if empty) are part of the select for consistency
            .single();

        if (error || !newCourse) {
            console.error('[DataContext] Error adding course:', error?.message);
            addAuditLogEntry(LogAction.ADD_COURSE, `Errore aggiunta corso ${courseData.name} per ${sedeName}/${currentYear}: ${error?.message}`);
            return { success: false, message: error?.message || "Errore sconosciuto nell'aggiunta corso." };
        }
        
        const completeNewCourse: TrainingCourse = {
            ...newCourse,
            approvals: newCourse.course_approvals || []
        };

        setYearlySedeData(prevYSD => {
            const updatedYearData = { ...(prevYSD[currentYear!] || {}) };
            const updatedSedeData = { ...(updatedYearData[sedeName] || getInitialSedeSpecificData()) };
            updatedSedeData.courses = [...updatedSedeData.courses, completeNewCourse];
            updatedYearData[sedeName] = updatedSedeData;
            return { ...prevYSD, [currentYear!]: updatedYearData };
        });

        addAuditLogEntry(LogAction.ADD_COURSE, `Aggiunto corso: ${courseData.name} per ${sedeName}/${currentYear}`);
        return { success: true, newCourse: completeNewCourse };
    };

    const updateCourse = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const deleteCourse = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    const approveCourseByQP = async (): Promise<{ success: boolean, message?: string }> => { /* Stub from prompt */ return { success: false }; };
    
    const addAssignment = async (assignmentData: Omit<TrainingAssignment, 'id' | 'sede_id' | 'year'>): Promise<{ success: boolean, message?: string }> => {
        if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
        if (!currentSedeId || !currentYear) return { success: false, message: "Sede o Anno non selezionati." };
        if (!currentKeyPersonnel || !(currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN) || currentKeyPersonnel.roles.includes(KeyPersonnelRole.QA_SITO))) {
            addAuditLogEntry(LogAction.ADD_ASSIGNMENT, `Tentativo fallito (non autorizzato) da ${currentKeyPersonnel?.name || 'utente sconosciuto'}`);
            return { success: false, message: "Azione non autorizzata." };
        }
        
        const employee = getEmployeeById(assignmentData.employee_id);
        const course = getCourseById(assignmentData.course_id);
        const sedeName = sedi.find(s => s.id === currentSedeId)?.name || currentSedeId;

        const newAssignmentPayload = {
            ...assignmentData,
            sede_id: currentSedeId,
            year: currentYear,
        };

        const { data: newAssignment, error } = await supabase
            .from('assignments')
            .insert(newAssignmentPayload)
            .select()
            .single();

        if (error || !newAssignment) {
            console.error('[DataContext] Error adding assignment:', error?.message);
            addAuditLogEntry(LogAction.ADD_ASSIGNMENT, `Errore aggiunta assegnazione per Dip. ${employee?.name || assignmentData.employee_id} / Corso ${course?.name || assignmentData.course_id} per ${sedeName}/${currentYear}: ${error?.message}`);
            return { success: false, message: error?.message || "Errore sconosciuto nell'aggiunta assegnazione." };
        }

        setYearlySedeData(prevYSD => {
            const updatedYearData = { ...(prevYSD[currentYear!] || {}) };
            const updatedSedeData = { ...(updatedYearData[sedeName] || getInitialSedeSpecificData()) };
            updatedSedeData.assignments = [...updatedSedeData.assignments, newAssignment as TrainingAssignment];
            updatedYearData[sedeName] = updatedSedeData;
            return { ...prevYSD, [currentYear!]: updatedYearData };
        });
        
        addAuditLogEntry(LogAction.ADD_ASSIGNMENT, `Aggiunta assegnazione per Dip. ${employee?.name || assignmentData.employee_id} / Corso ${course?.name || assignmentData.course_id} per ${sedeName}/${currentYear}`);
        return { success: true };
    };

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
        if (!currentKeyPersonnel || !(currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN) || currentKeyPersonnel.roles.includes(KeyPersonnelRole.QA_SITO))) {
            addAuditLogEntry(LogAction.CREATE_PLAN_RECORD, `Tentativo fallito (non autorizzato) per ${sedeId}/${year}`);
            return { success: false, message: "Azione non autorizzata." };
        }
        if (!currentAuthUser) {
             return { success: false, message: "Utente non autenticato." };
        }

        const sedeName = sedi.find(s => s.id === sedeId)?.name || sedeId;

        const existingPlan = getSedePlanRecord(); 
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
            const newPlanRecord: PlanRecord = {
                ...data,
                approvals: [], 
                created_by_name: (data.created_by as any)?.name || currentKeyPersonnel.name, 
            };
            setYearlySedeData(prevYSD => {
                const updatedYearData = { ...(prevYSD[year] || {}) };
                const updatedSedeData = { ...(updatedYearData[sedeName] || getInitialSedeSpecificData()) };
                updatedSedeData.planRecord = newPlanRecord;
                updatedYearData[sedeName] = updatedSedeData;
                return { ...prevYSD, [year]: updatedYearData };
            });
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
        Object.keys(yearlySedeData).forEach(yearStr => {
            if (!isNaN(parseInt(yearStr))) {
                years.add(parseInt(yearStr));
            }
        });
        for (let i = -3; i <= 3; i++) {
            years.add(systemYear + i);
        }
        if (currentYear !== null && !isNaN(currentYear)) {
            years.add(currentYear);
        }
        if (years.size === 0) {
            years.add(systemYear);
        }
        return Array.from(years).sort((a, b) => b - a);
    };

  const removeKeyPersonnel = async (personnelAuthUserId: string): Promise<{ success: boolean, message?: string }> => {
    if (!supabase || !isSupabaseConfigured) return { success: false, message: "Supabase client non disponibile." };
    if (!currentKeyPersonnel || !currentKeyPersonnel.roles.includes(KeyPersonnelRole.ADMIN)) {
      addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Tentativo fallito (non Admin) per AuthID ${personnelAuthUserId}`);
      return { success: false, message: "Azione non autorizzata." };
    }

    // First, delete from key_personnel table
    const { error: profileError } = await supabase
      .from('key_personnel')
      .delete()
      .eq('auth_user_id', personnelAuthUserId);

    if (profileError) {
      console.error('[DataContext] Error deleting key personnel profile:', profileError.message);
      addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Errore eliminazione profilo AuthID ${personnelAuthUserId}: ${profileError.message}`);
      return { success: false, message: `Errore profilo: ${profileError.message}` };
    }
    
    // Then, delete from auth.users (requires admin privileges for Supabase client, typically service_role)
    // This operation might fail if the Supabase client is initialized with anon key.
    // Consider using a Supabase Edge Function for this kind of admin operation.
    // For now, we'll log a warning.
    console.warn(`[DataContext] Profile for AuthID ${personnelAuthUserId} deleted. Attempting to delete auth user. This requires elevated Supabase client privileges (service_role) not typically available on the client-side.`);
    // const { error: authUserError } = await supabase.auth.admin.deleteUser(personnelAuthUserId); // This line requires service_role
    // if (authUserError) {
    //   console.error('[DataContext] Error deleting auth user:', authUserError.message);
    //   addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Profilo AuthID ${personnelAuthUserId} rimosso, ma errore eliminazione utente Auth: ${authUserError.message}. Azione manuale richiesta.`);
    //   fetchKeyPersonnelList(); // Refresh list anyway
    //   return { success: true, message: `Profilo personale chiave rimosso, ma l'utente Auth (${personnelAuthUserId}) potrebbe non essere stato eliminato. Controllare i log e Supabase.` };
    // }

    addAuditLogEntry(LogAction.REMOVE_KEY_PERSONNEL, `Rimosso profilo utente chiave AuthID ${personnelAuthUserId}. L'utente Auth potrebbe richiedere rimozione separata se l'operazione non è automatizzata o fallisce.`);
    fetchKeyPersonnelList(); // Refresh list
    return { success: true, message: "Profilo personale chiave rimosso. La rimozione dell'utente di autenticazione associato potrebbe richiedere un'azione manuale o una funzione server-side con privilegi elevati." };
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
        createPlanRecord, 
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
