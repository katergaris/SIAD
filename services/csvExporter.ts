
import { Employee, TrainingCourse, TrainingAssignment, KeyPersonnel, CSVExportType, PlanStatus, EncryptedKeyConfig, AuditLogCSVRow, LogAction, AuditEntry } from '../types';
import { getFormattedTimestamp } from '../utils/timestamp';
import { encryptTextForCSV } from './cryptoService';

const escapeCSVValue = (value: any): string => {
    const stringValue = String(value === null || value === undefined ? '' : value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

function convertToCSV(data: any[], type: CSVExportType): string {
    if (!data) { // Allow data to be null for template downloads with only headers
        data = [];
    }

    let headers: string[] = [];
    const csvRows: string[] = [];

    switch (type) {
        case 'employees': headers = ['id', 'name', 'currentRole', 'currentRoleStartDate']; break;
        case 'courses': headers = ['id', 'name', 'description', 'date', 'durationHours', 'category', 'status', 'approvals']; break; // Added approvals
        case 'assignments': headers = ['id', 'employeeId', 'courseId', 'assignmentDate', 'completionStatus', 'completionDate', 'score']; break;
        case 'keyPersonnel': headers = ['id', 'name', 'role']; break; // Password not exported
        case 'planStatus': headers = ['planStatus', 'responsabileId', 'responsabileName', 'approvalDate']; break;
        case 'auditTrail': headers = ['id', 'timestamp', 'userId', 'userName', 'userRole', 'action', 'details', 'sede', 'year']; break;
        case 'encryptionKeyConfig': headers = ['iv', 'encryptedKeyData', 'salt']; break;
        default: console.warn("Unknown CSV type for headers:", type); return "";
    }
    
    csvRows.push(headers.map(escapeCSVValue).join(','));

    if (data.length === 0) { // Template download with only headers
        return csvRows[0];
    }

    switch (type) {
        case 'employees':
            (data as Employee[]).forEach(item => {
                const currentRoleEntry = item.roleHistory.find(rh => rh.endDate === null);
                const values = [item.id, item.name, item.currentRole, currentRoleEntry ? currentRoleEntry.startDate : ''];
                csvRows.push(values.map(escapeCSVValue).join(','));
            });
            break;
        case 'courses':
            (data as TrainingCourse[]).forEach(item => {
                 const approvalsString = item.approvals ? JSON.stringify(item.approvals) : ""; // Simple JSON stringify for approvals
                const values = [item.id, item.name, item.description, item.date, item.durationHours, item.category, item.status, approvalsString];
                csvRows.push(values.map(escapeCSVValue).join(','));
            });
            break;
        case 'assignments':
            (data as TrainingAssignment[]).forEach(item => {
                const values = headers.map(header => (item as any)[header]);
                csvRows.push(values.map(escapeCSVValue).join(','));
            });
            break;
        case 'keyPersonnel':
            (data as KeyPersonnel[]).forEach(item => {
                const values = [item.id, item.name, item.role]; // Ensure only these are exported
                csvRows.push(values.map(escapeCSVValue).join(','));
            });
            break;
        case 'planStatus':
            const planInfo = data[0] as {planStatus: PlanStatus, responsabileId?: string, responsabileName?: string, approvalDate?: string};
            if (planInfo) {
                const values = [planInfo.planStatus, planInfo.responsabileId || '', planInfo.responsabileName || '', planInfo.approvalDate || ''];
                csvRows.push(values.map(escapeCSVValue).join(','));
            }
            break;
        case 'auditTrail':
            (data as AuditEntry[]).forEach(item => { // Assuming data is AuditEntry[]
                const values = [item.id, item.timestamp, item.userId || '', item.userName || '', item.userRole || '', item.action, item.details, item.sede || '', item.year?.toString() || ''];
                csvRows.push(values.map(escapeCSVValue).join(','));
            });
            break;
        case 'encryptionKeyConfig':
            const keyConfig = data[0] as EncryptedKeyConfig;
             if (keyConfig) {
                const values = [keyConfig.iv, keyConfig.encryptedKeyData, keyConfig.salt];
                csvRows.push(values.map(escapeCSVValue).join(','));
            }
            break;
        default:
            console.error("Invalid type for CSV export data processing:", type);
            return "";
    }
    
    return csvRows.join('\n');
}

export const exportDataToCSV = async (
    data: any[], 
    dataType: CSVExportType, 
    baseFileNameElements: { sede?: string, year?: string, type: CSVExportType } | { globalType: 'keyPersonnel' | 'auditTrail' | 'encryptionKeyConfig' },
    userKeyForEncryption?: CryptoKey | null, // Key for encrypting content for non-admins
): Promise<void> => {
    const actualExportType: CSVExportType = 'globalType' in baseFileNameElements 
                                            ? baseFileNameElements.globalType 
                                            : baseFileNameElements.type;

    let csvString = convertToCSV(data, dataType);
    if (!csvString && data.length > 0) { 
        console.warn(`CSV string is empty for type "${actualExportType}" despite data present.`);
        return;
    }
    if (!csvString && data.length === 0 && dataType !== 'encryptionKeyConfig') { // Allow empty template for most types
         console.info(`Generating template CSV for type "${actualExportType}".`);
         // csvString is already just headers if data is empty
    }


    let finalFileName = "database-export.csv";
    const timestamp = getFormattedTimestamp();

    if ('globalType' in baseFileNameElements) {
        if (baseFileNameElements.globalType === 'keyPersonnel') {
            finalFileName = `database-utenti_chiave-${timestamp}.csv`;
        } else if (baseFileNameElements.globalType === 'auditTrail') {
            finalFileName = `database-audit_trail-${timestamp}.csv`;
        } else if (baseFileNameElements.globalType === 'encryptionKeyConfig') {
            finalFileName = `database-encryption_key_config.csv`; // No timestamp for this specific config file
        }
    } else if ('sede' in baseFileNameElements && 'year' in baseFileNameElements && baseFileNameElements.sede && baseFileNameElements.year) {
        finalFileName = `database-${baseFileNameElements.sede}-${baseFileNameElements.year}-${baseFileNameElements.type}-${timestamp}.csv`;
    } else if ('type' in baseFileNameElements) { 
         finalFileName = `database-TEMPLATE-${baseFileNameElements.type}-${timestamp}.csv`;
    }
    
    let blobType = 'text/csv;charset=utf-8;';
    // let fileExtension = '.csv'; // Not used directly, filename construction handles it

    if (userKeyForEncryption && dataType !== 'encryptionKeyConfig') { // Don't encrypt the encryption key config itself with the user key
        try {
            console.info(`Encrypting CSV data for ${finalFileName}`);
            csvString = await encryptTextForCSV(csvString, userKeyForEncryption);
            // For encrypted files, we might want a different extension or to indicate encryption in the name
            // For simplicity, keeping .csv but the content is an encrypted string.
            // blobType = 'application/octet-stream'; // Or a custom MIME type
            // fileExtension = '.enc.csv'; // Example
            // finalFileName = finalFileName.replace('.csv', fileExtension);
        } catch (error) {
            console.error("Failed to encrypt CSV data:", error);
            alert("Errore durante la criptazione dei dati CSV. Il download è stato annullato.");
            return;
        }
    }


    const blob = new Blob([csvString], { type: blobType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', finalFileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (data.length > 0 || dataType === 'encryptionKeyConfig') {
         alert(`Dati "${actualExportType}" esportati come ${finalFileName}. Salva il file manualmente nella cartella corretta.`);
    } else {
        alert(`Template CSV per "${actualExportType}" esportato come ${finalFileName}. Salva il file manualmente nella cartella corretta.`);
    }
};
