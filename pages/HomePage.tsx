import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaCalendarAlt, FaUsers, FaTasks, FaChartBar, FaInfoCircle, FaEraser, FaDatabase, FaExclamationTriangle, FaCloudUploadAlt, FaWrench } from 'react-icons/fa';
import { useData } from '../contexts/DataContext';

const HomePage: React.FC = () => {
  const { 
    getSedeEmployees, getSedeCourses, getSedeAssignments, 
    clearCurrentSedeYearData, 
    currentSedeId, currentYear, yearlySedeData, sedi,
    isSupabaseConfigured 
  } = useData();

  const employees = getSedeEmployees();
  const courses = getSedeCourses();
  const assignments = getSedeAssignments();

  const currentSedeObject = useMemo(() => sedi.find(s => s.id === currentSedeId), [sedi, currentSedeId]);
  const currentSedeName = currentSedeObject?.name;
  
  const isDataEffectivelyLoaded = currentSedeName && currentYear && 
                                  yearlySedeData[currentYear] && yearlySedeData[currentYear][currentSedeName] &&
                                  (yearlySedeData[currentYear][currentSedeName].employees.length > 0 || 
                                   yearlySedeData[currentYear][currentSedeName].courses.length > 0 || 
                                   yearlySedeData[currentYear][currentSedeName].assignments.length > 0);


  const cardStyle = "bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1";
  const linkStyle = "flex flex-col items-center justify-center text-center text-primary hover:text-green-700"; 
  const iconStyle = "text-4xl mb-3 text-primary"; 

  if (!isSupabaseConfigured) {
    return (
      <div className="p-4 sm:p-8">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-md max-w-2xl mx-auto">
          <div className="flex items-start">
            <FaWrench className="text-4xl mr-4 mt-1 text-red-600 flex-shrink-0"/>
            <div>
              <h2 className="text-2xl font-bold mb-3">Configurazione Supabase Mancante!</h2>
              <p className="mb-2">L'applicazione non è riuscita a connettersi a Supabase perché l'URL del progetto o la chiave Anon non sono stati trovati.</p>
              <p className="mb-1">Per risolvere:</p>
              <ol className="list-decimal list-inside space-y-1 pl-2 mb-3 text-sm">
                <li>Crea un file chiamato <strong><code>.env.local</code></strong> nella directory principale del tuo progetto (allo stesso livello di <code>package.json</code>).</li>
                <li>Apri il file <code>.env.local</code> e aggiungi le seguenti righe, sostituendo i placeholder con i tuoi valori reali:
                  <pre className="bg-red-100 p-2 rounded mt-1 text-xs overflow-x-auto">
                    {`SUPABASE_URL=IL_TUO_URL_SUPABASE_QUI
SUPABASE_ANON_KEY=LA_TUA_CHIAVE_ANON_PUBBLICA_SUPABASE_QUI
GEMINI_API_KEY=LA_TUA_CHIAVE_GEMINI_SE_USATA`}
                  </pre>
                </li>
                <li>Puoi trovare l'URL e la chiave Anon pubblica nelle impostazioni API del tuo progetto Supabase.</li>
                <li><strong>Importante:</strong> Dopo aver creato o modificato il file <code>.env.local</code>, devi <strong>fermare e riavviare il server di sviluppo</strong> (es. `npm run dev`).</li>
              </ol>
              <p className="text-sm">Se il problema persiste, controlla la console del browser per ulteriori dettagli e assicurati che Vite stia caricando correttamente le variabili d'ambiente.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="bg-gradient-to-r from-primary to-dark text-white p-8 rounded-lg shadow-md">
        <h1 className="text-4xl font-bold mb-2">SIAD GxP - Training Platform</h1>
        <p className="text-lg">Gestione centralizzata della formazione con database Supabase.</p>
      </header>

      {(!currentSedeId || !currentYear) && (
        <section className={`${cardStyle} bg-yellow-50 border-l-4 border-yellow-500`}>
            <div className="flex items-start">
                <FaExclamationTriangle className="text-2xl mr-3 mt-1 text-yellow-600"/>
                <div>
                    <h2 className="text-xl font-semibold text-yellow-700">Selezione Incompleta</h2>
                    <p className="text-yellow-600">Per iniziare, seleziona una <strong>Sede</strong> e un <strong>Anno Operativo</strong> dalla barra di navigazione.</p>
                    <p className="text-sm text-yellow-600 mt-1">Se non hai ancora configurato nomi di sedi, vai al <Link to="/admin" className="font-semibold underline hover:text-yellow-800">Pannello Admin</Link> per aggiungerle. I dati verranno poi caricati da Supabase per la sede e l'anno scelti.</p>
                </div>
            </div>
        </section>
      )}

      {currentSedeId && currentYear && !isDataEffectivelyLoaded && (
         <section className={`${cardStyle} bg-orange-50 border-l-4 border-orange-500`}>
            <div className="flex items-start">
                <FaDatabase className="text-2xl mr-3 mt-1 text-orange-600"/>
                <div>
                    <h2 className="text-xl font-semibold text-orange-700">Dati Non Caricati per {currentSedeName || currentSedeId} / {currentYear}</h2>
                    <p className="text-orange-600">I dati per la sede "<strong>{currentSedeName || currentSedeId}</strong>" e l'anno "<strong>{currentYear}</strong>" non sembrano essere stati caricati in questa sessione da Supabase.</p>
                    <p className="text-sm text-orange-600 mt-1">
                        Assicurati di avere una connessione internet. I dati dovrebbero caricarsi automaticamente. Se i dati mancano completamente nel database per questa sede/anno, 
                        vai nelle rispettive pagine (Pianificazione, Dipendenti, Assegnazioni) per aggiungerli. 
                        L'import CSV di massa per queste entità è per casi specifici tramite il <Link to="/admin" className="font-semibold underline hover:text-orange-800">Pannello Admin</Link>.
                    </p>
                </div>
            </div>
        </section>
      )}


      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/pianificazione" className={`${cardStyle} ${linkStyle}`}>
          <FaCalendarAlt className={iconStyle} />
          <h2 className="text-xl font-semibold">Pianificazione Corsi</h2>
          <p className="text-sm text-gray-600 mt-1">Visualizza e gestisci i corsi.</p>
        </Link>
        <Link to="/dipendenti" className={`${cardStyle} ${linkStyle}`}>
          <FaUsers className={iconStyle} />
          <h2 className="text-xl font-semibold">Dipendenti</h2>
          <p className="text-sm text-gray-600 mt-1">Gestisci anagrafica e ruoli.</p>
        </Link>
        <Link to="/assegnazioni" className={`${cardStyle} ${linkStyle}`}>
          <FaTasks className={iconStyle} />
          <h2 className="text-xl font-semibold">Assegnazioni</h2>
          <p className="text-sm text-gray-600 mt-1">Assegna corsi ai dipendenti.</p>
        </Link>
        <Link to="/report" className={`${cardStyle} ${linkStyle}`}>
          <FaChartBar className={iconStyle} />
          <h2 className="text-xl font-semibold">Reportistica</h2>
          <p className="text-sm text-gray-600 mt-1">Analizza i dati di formazione.</p>
        </Link>
      </section>

      {currentSedeId && currentYear && isDataEffectivelyLoaded && (
        <section className={`${cardStyle} text-gray-700`}>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Statistiche Rapide (Sede: {currentSedeName || currentSedeId} - Anno: {currentYear})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-primary">{employees.length}</p>
                <p className="text-sm">Dipendenti Registrati</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-success">{courses.length}</p>
                <p className="text-sm">Corsi Disponibili</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-info">{assignments.length}</p>
                <p className="text-sm">Assegnazioni Effettuate</p>
            </div>
            </div>
        </section>
      )}
      
      <section className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-6 rounded-lg shadow">
        <div className="flex items-start">
          <FaCloudUploadAlt className="text-3xl mr-3 mt-1 text-yellow-500"/>
          <div>
            <h3 className="text-xl font-semibold mb-2 text-yellow-800">Flusso di Lavoro Consigliato (con Supabase)</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Login:</strong> Accedi con le tue credenziali.</li>
              <li>Seleziona <strong>Sede</strong> e <strong>Anno</strong> dalla barra di navigazione.</li>
              <li>I dati dovrebbero caricarsi automaticamente da Supabase.</li>
              <li><strong>Gestione Dati:</strong> Utilizza le sezioni Pianificazione, Dipendenti, Assegnazioni. Le modifiche sono salvate direttamente su Supabase.</li>
              <li><strong>Import Personale Chiave (Admin):</strong>
                <ul className="list-disc list-inside pl-4 mt-1">
                    <li>Vai al <Link to="/admin" className="font-semibold underline hover:text-yellow-800">Pannello Admin</Link> &gt; "Import/Export CSV".</li>
                    <li>Importa <code>utenti_chiave.csv</code> (se necessario per aggiunte massive).</li>
                </ul>
              </li>
              <li><strong>Export CSV (Admin):</strong> Per backup o analisi esterne, usa la funzione di export nel Pannello Admin.</li>
              <li><strong>Audit Log (Admin):</strong> Controlla le azioni nel sistema.</li>
            </ol>
          </div>
        </div>
      </section>

      {currentSedeId && currentYear && (
        <section className={`${cardStyle}`}>
            <h2 className="text-2xl font-semibold mb-3 text-gray-800">Azioni Rapide per {currentSedeName || currentSedeId} / {currentYear}</h2>
            <button
            onClick={clearCurrentSedeYearData}
            className="bg-danger text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center text-lg"
            >
            <FaEraser className="mr-2" />
            Pulisci Cache Dati per {currentSedeName || currentSedeId} / {currentYear}
            </button>
            <p className="text-sm text-gray-500 mt-2">Attenzione: questa azione pulisce i dati per la sede/anno correnti solo dalla memoria (cache) dell'applicazione per la sessione corrente. Non modifica i dati su Supabase. Utile per forzare un ricaricamento.</p>
        </section>
      )}
    </div>
  );
};

export default HomePage;