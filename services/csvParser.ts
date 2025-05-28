import { decryptTextFromCSV } from './cryptoService'; // Assuming cryptoService is in the same directory

export const parseCSV = async <T,>(
  file: File,
  mapHeadersToRow: (headers: string[]) => (rowValues: string[]) => T,
  userKey?: CryptoKey | null // Optional userKey for decryption
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Nessun file fornito."));
      return;
    }
    // Allow any file type if userKey is present, as it might be an encrypted blob
    if (!userKey && file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      reject(new Error("Il file deve essere in formato CSV (o criptato se la chiave utente è attiva)."));
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event: ProgressEvent<FileReader>) => {
      let text = event.target?.result as string;
      if (!text) {
        reject(new Error("Il file è vuoto o illeggibile."));
        return;
      }

      try {
        if (userKey && file.type !== 'text/csv' && !file.name.endsWith('.csv')) { // Heuristic: if not CSV type and key exists, assume encrypted
             // A more robust check might be needed, e.g., a magic number or specific extension for encrypted files
            console.info("Tentativo di decriptare il file CSV...");
            text = await decryptTextFromCSV(text, userKey);
        } else if (userKey && (text.includes(':') && text.length > 50) ) { // Basic heuristic for encrypted content
            try {
                console.info("File CSV, tentativo di decriptazione del contenuto...");
                text = await decryptTextFromCSV(text, userKey);
            } catch (decryptionError) {
                console.warn("Fallita decriptazione del CSV, procedo come testo in chiaro:", decryptionError);
                // If decryption fails, proceed assuming it might be plaintext already (e.g. admin uploaded plaintext for user)
            }
        }


        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        
        if (lines.length === 0) {
          resolve([]);
          return;
        }

        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim());
        
        if (headers.length === 0 || headers.every(h => h === '')) {
          reject(new Error("Il file CSV non contiene header validi o è vuoto."));
          return;
        }
        
        const dataMapper = mapHeadersToRow(headers);
        const data: T[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim() === '') continue; 

          const values = line.split(',').map(v => v.trim());
          
          if (values.length !== headers.length) {
            console.warn(`Riga ${i+1} ha ${values.length} valori, ma ci sono ${headers.length} headers. Riga saltata: ${line}`);
            continue;
          }

          try {
            data.push(dataMapper(values));
          } catch (error) {
            console.error(`Errore durante il parsing della riga ${i + 1}: ${line}`, error);
          }
        }
        resolve(data);
      } catch (error) {
        console.error("Errore durante il processo di parsing o decriptazione:", error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };
    
    // If we expect it to be encrypted, read as text first.
    // If it's a binary blob from encryption, this might need adjustment
    // For now, assuming encrypted content is also text-based (base64 encoded parts)
    reader.readAsText(file); 
  });
};
