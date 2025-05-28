
import { Employee, TrainingCourse, TrainingAssignment, KeyPersonnel, CSVExportType, PlanStatus, AuditEntry, PlanRecord } from '../types';
import { getFormattedTimestamp } from '../utils/timestamp';

const escapeCSVValue = (value: any): string => {
    const stringValue = String(value === null || value === undefined ? '' : value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

function convertToCSV(data: any[], type: CSVExportType): string {
    if (!data) data = [];

    let headers: string[] = [];
    const csvRows: string[] = [];

    switch (type) {
        case 'employees': headers = ['id', 'name', 'current_role', 'sede_id', 'year']; break; // Aggiunto sede_id, year. Role history non qui.
        case 'courses': headers = ['id', 'name', 'description', 'date', 'duration_hours', 'category', 'status', 'sede_id', 'year']; break; // Aggiunto sede_id, year. Approvals non qui.
        case 'assignments': headers = ['id', 'employee_id', 'course_id', 'assignment_date', 'completion_status', 'completion_date', 'score', 'sede_id', 'year']; break; // Aggiunto sede_id, year
        case 'keyPersonnel': headers = ['auth_user_id', 'name', 'role', 'email']; break; // password non esportata, aggiunto email
        case 'planRecords': headers = ['id', 'sede_id', 'year', 'status']; break; // plan_approvals non qui
        case 'auditTrail': headers = ['id', 'timestamp', 'user_id', 'user_name', 'user_role', 'action', 'details', 'sede_id', 'year']; break;
        // case 'encryptionKeyConfig': rimosso
        default: console.warn("Unknown CSV type for headers:", type); return "";
    }
    
    csvRows.push(headers.map(escapeCSVValue).join(','));

    if (data.length === 0 && type !== 'auditTrail' && type !== 'keyPersonnel') { // Template download
        return csvRows[0];
    }

    data.forEach(item => {
        const values = headers.map(header => (item as any)[header]);
        csvRows.push(values.map(escapeCSVValue).join(','));
    });
    
    return csvRows.join('\n');
}

export const exportDataToCSV = async (
    data: any[], 
    dataType: CSVExportType, 
    baseFileNameElements: { sede?: string, year?: string, type: CSVExportType } | { globalType: 'keyPersonnel' | 'auditTrail' }
    // userKeyForEncryption rimosso
): Promise<void> => {
    const actualExportType: CSVExportType = 'globalType' in baseFileNameElements 
                                            ? baseFileNameElements.globalType 
                                            : baseFileNameElements.type;

    let csvString = convertToCSV(data, dataType); // dataType qui, non actualExportType per convertToCSV
    if (!csvString && data.length > 0) { 
        console.warn(`CSV string is empty for type "${actualExportType}" despite data present.`);
        return;
    }
     if (!csvString && data.length === 0 && dataType !== 'keyPersonnel' && dataType !== 'auditTrail') {
         console.info(`Generating template CSV for type "${actualExportType}".`);
    }

    let finalFileName = "database-export.csv";
    const timestamp = getFormattedTimestamp();

    if ('globalType' in baseFileNameElements) {
        if (baseFileNameElements.globalType === 'keyPersonnel') {
            finalFileName = `supabase-utenti_chiave-${timestamp}.csv`;
        } else if (baseFileNameElements.globalType === 'auditTrail') {
            finalFileName = `supabase-audit_trail-${timestamp}.csv`;
        }
    } else if ('sede' in baseFileNameElements && 'year' in baseFileNameElements && baseFileNameElements.sede && baseFileNameElements.year) {
        finalFileName = `supabase-${baseFileNameElements.sede}-${baseFileNameElements.year}-${baseFileNameElements.type}-${timestamp}.csv`;
    } else if ('type' in baseFileNameElements) { 
         finalFileName = `supabase-TEMPLATE-${baseFileNameElements.type}-${timestamp}.csv`;
    }
    
    const blobType = 'text/csv;charset=utf-8;';
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
    
    if (data.length > 0) { // Non mostrare alert per template vuoti
         alert(`Dati "${actualExportType}" esportati come ${finalFileName}.`);
    } else {
        alert(`Template CSV per "${actualExportType}" esportato come ${finalFileName}.`);
    }
};