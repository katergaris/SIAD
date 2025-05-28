export interface RoleEntry {
  role: string;
  startDate: string; // ISO date string
  endDate: string | null; // ISO date string or null if current
}

export interface Employee {
  id: string;
  name: string;
  currentRole: string;
  roleHistory: RoleEntry[];
}

export enum TrainingCourseStatus {
  BOZZA = 'Bozza',
  APPROVATO_QP = 'Approvato QP',
  PIANIFICATO = 'Pianificato', // Stato precedente, potrebbe essere rimosso o ridefinito
  COMPLETATO = 'Completato',
  ANNULLATO = 'Annullato',
}

export interface CourseApproval {
  qpId: string;
  qpName: string;
  approvalDate: string; // ISO datetime string
}

export interface TrainingCourse {
  id: string;
  name: string;
  description: string;
  date: string; // ISO date string
  durationHours: number;
  category: string;
  status: TrainingCourseStatus;
  approvals?: CourseApproval[]; // Traccia delle approvazioni QP
}

export enum AssignmentStatus {
  NOT_STARTED = 'Non Iniziato',
  IN_PROGRESS = 'In Corso',
  COMPLETED = 'Completato',
  FAILED = 'Fallito',
}

export interface TrainingAssignment {
  id: string;
  employeeId: string;
  courseId: string;
  assignmentDate: string; // ISO date string
  completionStatus: AssignmentStatus;
  completionDate: string | null; // ISO date string
  score: number | null;
}

// For CSV parsing
export interface EmployeeCSVRow {
  id: string;
  name: string;
  initialRole: string;
  initialRoleStartDate: string; // Expects YYYY-MM-DD
}

export interface CourseCSVRow {
  id: string;
  name: string;
  description: string;
  date: string; // Expects YYYY-MM-DD
  durationHours: string; // Will be parsed to number
  category: string;
  status?: TrainingCourseStatus; // Optional: if status is in CSV
  approvals?: CourseApproval[]; // Optional: if approvals are in CSV (complex)
}

export interface PlanStatusCSVRow {
    planStatus: PlanStatus;
    responsabileId?: string;
    responsabileName?: string;
    approvalDate?: string;
}

// For CSV Export
export type CSVExportType = 'employees' | 'courses' | 'assignments' | 'keyPersonnel' | 'planStatus' | 'auditTrail' | 'encryptionKeyConfig';

// --- Nuove definizioni per Admin e Approvazioni ---
export type KeyPersonnelRole = 'QP' | 'QA' | 'Responsabile' | 'Admin';

export interface KeyPersonnel {
  id: string;
  name: string;
  role: KeyPersonnelRole;
  password: string; // Password in plain text for CSV storage (as per implicit requirement)
}

export enum PlanStatus {
  BOZZA = 'Bozza',
  IN_APPROVAZIONE_RESPONSABILE = 'In Approvazione Responsabile',
  APPROVATO = 'Approvato',
  OBSOLETO = 'Obsoleto'
}

export interface PlanApproval {
  responsabileId: string;
  responsabileName: string;
  approvalDate: string; // ISO datetime string
}

export interface SedeSpecificData {
  employees: Employee[];
  courses: TrainingCourse[];
  assignments: TrainingAssignment[];
  planStatus: PlanStatus; 
  planApprovals?: PlanApproval[];
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

// --- Audit Trail ---
export enum LogAction {
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  DATA_UPLOAD = "DATA_UPLOAD",
  DATA_DOWNLOAD = "DATA_DOWNLOAD",
  ENCRYPTION_KEY_SET = "ENCRYPTION_KEY_SET",
  ENCRYPTION_KEY_LOADED = "ENCRYPTION_KEY_LOADED",
  ADMIN_LOGIN = "ADMIN_LOGIN",
  ADMIN_LOGOUT = "ADMIN_LOGOUT",
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
  APPROVE_COURSE_QP = "APPROVE_COURSE_QP",
  ADD_ASSIGNMENT = "ADD_ASSIGNMENT",
  UPDATE_ASSIGNMENT = "UPDATE_ASSIGNMENT",
  DELETE_ASSIGNMENT = "DELETE_ASSIGNMENT",
  APPROVE_PLAN_RESP = "APPROVE_PLAN_RESP",
  CLEAR_SEDE_YEAR_DATA = "CLEAR_SEDE_YEAR_DATA",
  BATCH_ASSIGNMENTS = "BATCH_ASSIGNMENTS"
}

export interface AuditEntry {
  id: string;
  timestamp: string; // ISO datetime string
  userId?: string; // ID of KeyPersonnel or 'ADMIN'
  userName?: string; // Name of KeyPersonnel or 'ADMIN'
  userRole?: KeyPersonnelRole | 'ADMIN_ROLE';
  action: LogAction;
  details: string; // e.g., "Uploaded employees.csv for SedeMilano/2023" or "Course 'XYZ' approved"
  sede?: string | null;
  year?: number | null;
}

export interface AuditLogCSVRow {
  id: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  details: string;
  sede?: string;
  year?: string;
}


// --- Encryption Key Config ---
export interface EncryptedKeyConfig {
  iv: string; // Base64 encoded IV
  encryptedKeyData: string; // Base64 encoded encrypted key material
  salt: string; // Base64 encoded salt for PBKDF2
}


export interface DataContextType {
  sedi: string[];
  currentSede: string | null;
  setCurrentSede: (name: string | null) => void;
  addSede: (name: string) => boolean;
  removeSede: (name: string) => void;
  
  currentYear: number | null;
  setCurrentYear: (year: number | null) => void;
  availableYears: () => number[];

  yearlySedeData: YearlySedeData;
  getSedeEmployees: () => Employee[];
  getSedeCourses: () => TrainingCourse[];
  getSedeAssignments: () => TrainingAssignment[];
  getSedePlanStatus: () => PlanStatus | undefined;
  getSedePlanApprovals: () => PlanApproval[] | undefined;

  loadKeyPersonnelFromMasterCSV: (file: File) => Promise<void>;
  loadSedeDataFromCSV: (sedeName: string, year: string, type: 'employees' | 'courses' | 'assignments', file: File) => Promise<void>;
  loadSedePlanStatusFromCSV: (sedeName: string, year: string, file: File) => Promise<void>;

  addEmployee: (employee: Omit<Employee, 'id' | 'roleHistory'> & { initialRole: string; initialRoleStartDate: string }) => void;
  updateEmployeeRole: (employeeId: string, newRole: string, startDate: string) => void;
  deleteEmployee: (employeeId: string) => void;

  addCourse: (course: Omit<TrainingCourse, 'id' | 'status' | 'approvals'>) => void;
  updateCourse: (courseId: string, updates: Partial<Omit<TrainingCourse, 'id'>>) => void;
  deleteCourse: (courseId: string) => void;
  approveCourseByQP: (courseId: string, qpId: string, qpPasswordPlain: string) => boolean;

  addAssignment: (assignment: Omit<TrainingAssignment, 'id'>) => void;
  updateAssignmentStatus: (assignmentId: string, status: AssignmentStatus, completionDate?: string, score?: number) => void;
  addBatchAssignments: (payload: BatchAssignmentPayload) => void;
  deleteAssignment: (assignmentId: string) => void;

  getEmployeeById: (id: string) => Employee | undefined;
  getCourseById: (id: string) => TrainingCourse | undefined;
  
  clearCurrentSedeYearData: () => void;

  isAdminAuthenticated: boolean;
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;

  keyPersonnelList: KeyPersonnel[];
  currentKeyPersonnel: KeyPersonnel | null;
  loginKeyPersonnel: (name: string, passwordPlain: string) => boolean;
  logoutKeyPersonnel: () => void;
  addKeyPersonnel: (personnel: Omit<KeyPersonnel, 'id'>) => boolean;
  updateKeyPersonnel: (personnelId: string, updates: Partial<Omit<KeyPersonnel, 'id' | 'password'>> & {newPassword?:string}) => boolean;
  removeKeyPersonnel: (personnelId: string) => void;
  getKeyPersonnelById: (id: string) => KeyPersonnel | undefined;

  approveCurrentSedePlanByResponsabile: (responsabileId: string, responsabilePasswordPlain: string) => boolean;

  // Encryption and Audit
  setUserEncryptionKey: (password: string) => Promise<void>;
  loadUserEncryptionKeyFromFile: (file: File) => Promise<void>;
  addAuditLogEntry: (action: LogAction, details: string, overrideSede?: string | null, overrideYear?: number | null) => void;
  downloadAuditLog: () => void;
  isUserKeySet: () => boolean;
}
