export interface RoleEntry {
  role: string;
  startDate: string; // ISO date string
  endDate: string | null; // ISO date string or null if current
}

export interface Employee {
  id: string; // UUID from Supabase
  sede_id: string; // Foreign key to sedi
  year: number;
  name: string;
  currentRole: string;
  roleHistory?: RoleEntry[]; 
}

export enum TrainingCourseStatus {
  BOZZA = 'Bozza',
  APPROVATO_QP = 'Approvato QP', // Questo stato indica l'approvazione del singolo corso da parte del QP
  PIANIFICATO = 'Pianificato', // Corso confermato e schedulato
  COMPLETATO = 'Completato',
  ANNULLATO = 'Annullato',
}

export interface CourseApproval {
  id?: string; // UUID from Supabase
  course_id: string;
  qp_auth_user_id: string; 
  qp_name: string;
  approval_date: string; // ISO datetime string
}

export enum TrainingType {
  INIZIALE = 'Iniziale',
  CONTINUA = 'Continua',
  SPECIALE = 'Speciale',
  OTJ = 'OTJ', // On The Job
}

export interface TrainingCourse {
  id: string; 
  sede_id: string; 
  year: number;
  name: string;
  description: string;
  date: string; // Data prevista/effettiva del corso
  durationHours: number;
  category: string; // Potrebbe essere reso più specifico o un enum
  status: TrainingCourseStatus;
  approvals?: CourseApproval[]; // Approvazioni specifiche del corso (es. da QP)

  // Nuovi campi GxP
  training_type?: TrainingType; // Es: Iniziale, Continua, Speciale, OTJ
  trainer_info?: string; // Nome/i del/i formatore/i
  planned_period?: string; // Es: 'Q1', 'Q2', 'Q3', 'Q4', o data specifica YYYY-MM-DD
  gxp_area?: string; // Ambito GxP di pertinenza per gli argomenti
  // `personale_coinvolto` è meglio gestirlo tramite la tabella `assignments`
  // `argomenti da trattare` può essere parte della `description` o un campo a parte se strutturato
}

export enum AssignmentStatus {
  NOT_STARTED = 'Non Iniziato',
  IN_PROGRESS = 'In Corso',
  COMPLETED = 'Completato',
  FAILED = 'Fallito',
}

export interface TrainingAssignment {
  id: string; 
  sede_id: string;
  year: number;
  employee_id: string;
  course_id: string;
  assignmentDate: string; 
  completionStatus: AssignmentStatus;
  completionDate: string | null; 
  score: number | null;
}

// EmployeeCSVRow e CourseCSVRow sono rimosse perché loadDataForSedeYearFromCSV è stato rimosso.
// Mantieni solo se c'è una specifica altra funzionalità di import CSV per singole entità che le usa.

export type CSVExportType = 'employees' | 'courses' | 'assignments' | 'keyPersonnel' | 'planRecords' | 'auditTrail' | 'allData';

// Ruoli GxP definiti
export enum KeyPersonnelRole {
  ADMIN = 'Admin', // Poteri assoluti sulla piattaforma
  QA_SITO = 'QA_SITO', // Definisce fabbisogni, predispone piano, aggiorna schede, report esterni, integra piano
  QP = 'QP', // Approva piano formativo di sito, approva modifiche piano
  QA_CENTRALE = 'QA_CENTRALE' // Approva piano formativo di sito
}

export interface KeyPersonnel {
  id: string; // UUID da tabella key_personnel
  auth_user_id: string; // UUID da auth.users.id
  name: string;
  email?: string; 
  role: KeyPersonnelRole;
}

// Stati del Piano Formativo Annuale GxP
export enum PlanStatus {
  BOZZA = 'BOZZA', // Piano in preparazione da QA_SITO
  IN_REVISIONE_QA_SITO = 'IN_REVISIONE_QA_SITO', // (Opzionale) QA_SITO lo marca per revisione interna
  IN_APPROVAZIONE_QP = 'IN_APPROVAZIONE_QP', // Inviato a QP per approvazione
  APPROVATO_QP = 'APPROVATO_QP', // Approvato da QP, in attesa di QA_CENTRALE
  RIGETTATO_QP = 'RIGETTATO_QP', // Rigettato da QP
  IN_APPROVAZIONE_QA_CENTRALE = 'IN_APPROVAZIONE_QA_CENTRALE', // Inviato a QA_CENTRALE
  APPROVATO_QA_CENTRALE = 'APPROVATO_QA_CENTRALE', // Approvato da QA_CENTRALE (potrebbe essere stato finale se unico)
  RIGETTATO_QA_CENTRALE = 'RIGETTATO_QA_CENTRALE', // Rigettato da QA_CENTRALE
  APPROVATO = 'APPROVATO', // Piano approvato da tutti gli enti necessari (stato finale consolidato)
  OBSOLETO = 'OBSOLETO' // Piano superato o non più valido
}

export interface PlanApproval {
  id?: string; 
  plan_record_id: string;
  approver_auth_user_id: string; 
  approver_name: string;
  approver_role: KeyPersonnelRole; // Ruolo GxP di chi approva/rigetta
  approval_date: string; 
  approval_status: 'Approvato' | 'Rigettato'; // Decisione
  approval_comment?: string; // Commento opzionale, specialmente per rigetto
  approval_step?: string; // Es. 'QP_APPROVAL', 'QA_CENTRALE_APPROVAL' per tracciare la fase
}

export interface PlanRecord { 
  id: string; 
  sede_id: string;
  year: number;
  status: PlanStatus;
  approvals?: PlanApproval[];
  created_by_user_id?: string;
  created_by_name?: string; // Added
  last_modified_by_user_id?: string;
  last_modified_by_name?: string; // Added
  last_modified_at?: string;
}


export interface SedeSpecificData {
  employees: Employee[];
  courses: TrainingCourse[];
  assignments: TrainingAssignment[];
  planRecord?: PlanRecord; 
}

export interface SedeDataForYear {
  [sedeName: string]: SedeSpecificData; 
}

export interface YearlySedeData {
  [year: string]: SedeDataForYear;
}


export interface BatchAssignmentPayload {
  employeeIds?: string[];
  courseIds?: string[];
  commonCourseId?: string;
  commonEmployeeId?: string;
  assignmentDate: string;
  completionStatus: AssignmentStatus;
}

export enum LogAction {
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  DATA_UPLOAD = "DATA_UPLOAD",
  DATA_DOWNLOAD = "DATA_DOWNLOAD",
  ADMIN_LOGIN_ATTEMPT = "ADMIN_LOGIN_ATTEMPT", 
  USER_LOGIN_ATTEMPT = "USER_LOGIN_ATTEMPT",
  ADD_SEDE = "ADD_SEDE",
  REMOVE_SEDE = "REMOVE_SEDE",
  ADD_KEY_PERSONNEL = "ADD_KEY_PERSONNEL",
  UPDATE_KEY_PERSONNEL = "UPDATE_KEY_PERSONNEL",
  REMOVE_KEY_PERSONNEL = "REMOVE_KEY_PERSONNEL",
  ADD_EMPLOYEE = "ADD_EMPLOYEE",
  UPDATE_EMPLOYEE_ROLE = "UPDATE_EMPLOYEE_ROLE",
  DELETE_EMPLOYEE = "DELETE_EMPLOYEE",
  ADD_COURSE = "ADD_COURSE",
  UPDATE_COURSE = "UPDATE_COURSE",
  DELETE_COURSE = "DELETE_COURSE",
  APPROVE_COURSE_QP = "APPROVE_COURSE_QP", // Approvazione del singolo corso da QP
  ADD_ASSIGNMENT = "ADD_ASSIGNMENT",
  UPDATE_ASSIGNMENT = "UPDATE_ASSIGNMENT",
  DELETE_ASSIGNMENT = "DELETE_ASSIGNMENT",
  PLAN_SUBMIT_FOR_APPROVAL = "PLAN_SUBMIT_FOR_APPROVAL", // QA_SITO invia piano per approvazione
  PLAN_APPROVE_REJECT = "PLAN_APPROVE_REJECT", // QP o QA_CENTRALE approva/rigetta il piano
  CLEAR_SEDE_YEAR_DATA = "CLEAR_SEDE_YEAR_DATA", 
  BATCH_ASSIGNMENTS = "BATCH_ASSIGNMENTS"
}

export interface AuditEntry {
  id?: string; 
  timestamp?: string; 
  user_id?: string | null; 
  user_name?: string | null;
  user_role?: string | null; 
  action: LogAction;
  details: string;
  sede_id?: string | null; 
  sede_name?: string | null; 
  year?: number | null;
}

export interface NewKeyPersonnelPayload extends Omit<KeyPersonnel, 'id' | 'auth_user_id'> {
  email: string;
  passwordPlain: string;
}
export interface UpdateKeyPersonnelPayload {
    name?: string;
    role?: KeyPersonnelRole;
    newPasswordPlain?: string;
}


export interface DataContextType {
  sedi: { id: string, name: string }[]; 
  currentSedeId: string | null; 
  setCurrentSedeId: (id: string | null) => void;
  addSede: (name: string) => Promise<{ success: boolean, message?: string }>;
  removeSede: (id: string) => Promise<{ success: boolean, message?: string }>;
  
  currentYear: number | null;
  setCurrentYear: (year: number | null) => void;
  availableYears: () => number[]; 

  yearlySedeData: YearlySedeData; 
  fetchDataForSedeAndYear: (sedeId: string, year: number) => Promise<void>; 

  getSedeEmployees: () => Employee[];
  getSedeCourses: () => TrainingCourse[];
  getSedeAssignments: () => TrainingAssignment[];
  getSedePlanRecord: () => PlanRecord | undefined; 

  addEmployee: (employeeData: Omit<Employee, 'id' | 'sede_id' | 'year' | 'roleHistory'> & { initialRole: string; initialRoleStartDate: string }) => Promise<{ success: boolean, message?: string }>;
  updateEmployeeRole: (employeeId: string, newRole: string, startDate: string) => Promise<{ success: boolean, message?: string }>;
  deleteEmployee: (employeeId: string) => Promise<{ success: boolean, message?: string }>;

  addCourse: (courseData: Omit<TrainingCourse, 'id' | 'sede_id' | 'year' | 'status' | 'approvals'>) => Promise<{ success: boolean, message?: string, newCourse?: TrainingCourse }>;
  updateCourse: (courseId: string, updates: Partial<Omit<TrainingCourse, 'id' | 'sede_id' | 'year'>>) => Promise<{ success: boolean, message?: string }>;
  deleteCourse: (courseId: string) => Promise<{ success: boolean, message?: string }>;
  approveCourseByQP: (courseId: string) => Promise<{ success: boolean, message?: string }>; 

  addAssignment: (assignmentData: Omit<TrainingAssignment, 'id' | 'sede_id' | 'year'>) => Promise<{ success: boolean, message?: string }>;
  updateAssignmentStatus: (assignmentId: string, status: AssignmentStatus, completionDate?: string, score?: number) => Promise<{ success: boolean, message?: string }>;
  addBatchAssignments: (payload: BatchAssignmentPayload) => Promise<{ success: boolean, message?: string, count?: number }>;
  deleteAssignment: (assignmentId: string) => Promise<{ success: boolean, message?: string }>;

  getEmployeeById: (id: string) => Employee | undefined; 
  getCourseById: (id: string) => TrainingCourse | undefined; 
  
  clearCurrentSedeYearData: () => void; 

  isAdminAuthenticated: boolean; 
  currentKeyPersonnel: KeyPersonnel | null; 
  
  loginUser: (email: string, passwordPlain: string) => Promise<{ success: boolean, message?: string }>;
  logoutUser: () => Promise<{ success: boolean, message?: string }>;
  
  keyPersonnelList: KeyPersonnel[]; 
  fetchKeyPersonnel: () => Promise<void>;
  addKeyPersonnel: (personnelPayload: NewKeyPersonnelPayload) => Promise<{ success: boolean, message?: string }>;
  updateKeyPersonnel: (personnelAuthUserId: string, updates: UpdateKeyPersonnelPayload) => Promise<{ success: boolean, message?: string }>;
  removeKeyPersonnel: (personnelAuthUserId: string) => Promise<{ success: boolean, message?: string }>;
  getKeyPersonnelByAuthId: (authUserId: string) => KeyPersonnel | undefined;

  // Funzione per la gestione approvazioni piano GxP
  submitPlanForApproval: (planRecordId: string, targetRole: KeyPersonnelRole.QP | KeyPersonnelRole.QA_CENTRALE) => Promise<{ success: boolean, message?: string }>;
  approveOrRejectPlanStep: (
    planRecordId: string, 
    approvingRole: KeyPersonnelRole.QP | KeyPersonnelRole.QA_CENTRALE, // Chi sta approvando
    decision: 'Approvato' | 'Rigettato',
    comment?: string
  ) => Promise<{ success: boolean, message?: string }>;
  
  addAuditLogEntry: (action: LogAction, details: string, sedeId?: string | null, year?: number | null) => Promise<void>;
  downloadAuditLog: () => Promise<void>; 

  loadKeyPersonnelFromMasterCSV: (file: File) => Promise<{ success: boolean, message?: string, count?: number }>;
  // loadDataForSedeYearFromCSV è stato rimosso
  exportDataToCSV: (exportType: CSVExportType, sedeId?: string, year?: number) => Promise<void>;

  isSupabaseConfigured: boolean; // Nuovo stato
}