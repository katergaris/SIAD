
// userKey non è più necessario, la decrittazione CSV client-side è rimossa
export const parseCSV = async <T,>(
  file: File,
  mapHeadersToRow: (headers: string[]) => (rowValues: string[]) => T
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Nessun file fornito."));
      return;
    }
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      reject(new Error("Il file deve essere in formato CSV."));
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event: ProgressEvent<FileReader>) => {
      const text = event.target?.result as string;
      if (!text) {
        reject(new Error("Il file è vuoto o illeggibile."));
        return;
      }

      try {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        
        if (lines.length === 0) {
          resolve([]);
          return;
        }

        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().toLowerCase()); // Converti header in minuscolo per matching robusto
        
        if (headers.length === 0 || headers.every(h => h === '')) {
          reject(new Error("Il file CSV non contiene header validi o è vuoto."));
          return;
        }
        
        const dataMapper = mapHeadersToRow(headers);
        const data: T[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim() === '') continue; 

          // Basic CSV line splitting (might need a more robust library for complex CSVs with quoted commas)
          const values: string[] = [];
          let currentVal = '';
          let inQuotes = false;
          for (let char of line) {
              if (char === '"') {
                  inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                  values.push(currentVal.trim());
                  currentVal = '';
              } else {
                  currentVal += char;
              }
          }
          values.push(currentVal.trim()); // Add the last value

          if (values.length !== headers.length && line.split(',').length !== headers.length) { // Fallback simple split check
            console.warn(`Riga ${i+1} ha un numero di valori (${values.length} o ${line.split(',').length}) diverso dagli headers (${headers.length}). Riga saltata: ${line}`);
            continue;
          }
          
          const finalValues = values.length === headers.length ? values : line.split(',').map(v => v.trim());


          try {
            data.push(dataMapper(finalValues));
          } catch (error) {
            console.error(`Errore durante il parsing della riga ${i + 1}: ${line}`, error);
            // Non rigettare per una singola riga, continua con le altre
          }
        }
        resolve(data);
      } catch (error) {
        console.error("Errore durante il processo di parsing:", error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file); 
  });
};
