import React from 'react';
import { Link } from 'react-router-dom';
import { FaCalendarAlt, FaUsers, FaTasks, FaChartBar, FaInfoCircle, FaEraser, FaDatabase, FaExclamationTriangle } from 'react-icons/fa';
import { useData } from '../contexts/DataContext';

const HomePage: React.FC = () => {
  const { 
    getSedeEmployees, getSedeCourses, getSedeAssignments, 
    clearCurrentSedeYearData, 
    currentSede, currentYear, yearlySedeData 
  } = useData();

  const employees = getSedeEmployees();
  const courses = getSedeCourses();
  const assignments = getSedeAssignments();
  
  const isDataEffectivelyLoaded = currentSede && currentYear && 
                                  yearlySedeData[currentYear] && yearlySedeData[currentYear][currentSede] &&
                                  (yearlySedeData[currentYear][currentSede].employees.length > 0 || 
                                   yearlySedeData[currentYear][currentSede].courses.length > 0 || 
                                   yearlySedeData[currentYear][currentSede].assignments.length > 0);


  const cardStyle = "bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1";
  const linkStyle = "flex flex-col items-center justify-center text-center text-primary hover:text-green-700"; // Use primary color
  const iconStyle = "text-4xl mb-3 text-primary"; // Use primary color

  return (
    <div className="space-y-8">
      <header className="bg-gradient-to-r from-primary to-dark text-white p-8 rounded-lg shadow-md">
        <h1 className="text-4xl font-bold mb-2">SIAD GxP - Training Platform</h1>
      </header>

      {(!currentSede || !currentYear) && (
        <section className={`${cardStyle} bg-yellow-50 border-l-4 border-yellow-500`}>
            <div className="flex items-start">
                <FaExclamationTriangle className="text-2xl mr-3 mt-1 text-yellow-600"/>
                <div>
                    <h2 className="text-xl font-semibold text-yellow-700">Selezione Incompleta</h2>
                    <p className="text-yellow-600">Per iniziare, seleziona una <strong>Sede</strong> e un <strong>Anno Operativo</strong> dalla barra di navigazione.</p>
                    <p className="text-sm text-yellow-600 mt-1">Se non hai ancora configurato nomi di sedi, vai al <Link to="/admin" className="font-semibold underline hover:text-yellow-800">Pannello Admin</Link> per aggiungerle. Successivamente, carica i dati CSV per la sede e l'anno scelti.</p>
                </div>
            </div>
        </section>
      )}

      {currentSede && currentYear && !isDataEffectivelyLoaded && (
         <section className={`${cardStyle} bg-orange-50 border-l-4 border-orange-500`}>
            <div className="flex items-start">
                <FaDatabase className="text-2xl mr-3 mt-1 text-orange-600"/>
                <div>
                    <h2 className="text-xl font-semibold text-orange-700">Dati Non Caricati per {currentSede} / {currentYear}</h2>
                    <p className="text-orange-600">I dati per la sede "<strong>{currentSede}</strong>" e l'anno "<strong>{currentYear}</strong>" non sembrano essere stati caricati in questa sessione.</p>
                    <p className="text-sm text-orange-600 mt-1">Vai al <Link to="/admin" className="font-semibold underline hover:text-orange-800">Pannello Admin &gt; Gestione Dati CSV</Link> per caricare i 4 file CSV (Dipendenti, Corsi, Assegnazioni, Stato Piano) per questa combinazione sede/anno.</p>
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

      {currentSede && currentYear && isDataEffectivelyLoaded && (
        <section className={`${cardStyle} text-gray-700`}>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Statistiche Rapide (Sede: {currentSede} - Anno: {currentYear})</h2>
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
          <FaInfoCircle className="text-2xl mr-3 mt-1 text-yellow-500"/>
          <div>
            <h3 className="text-xl font-semibold mb-2 text-yellow-800">Flusso di Lavoro CSV Consigliato</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Seleziona <strong>Sede</strong> e <strong>Anno</strong> dalla barra di navigazione.</li>
              <li>Vai al <Link to="/admin" className="font-semibold underline hover:text-yellow-800">Pannello Admin</Link> e seleziona "Gestione Dati CSV".</li>
              <li>Carica il file globale <code>utenti_chiave.csv</code> (se non già fatto).</li>
              <li>Per la Sede/Anno scelti, carica i 4 file CSV: <code>[SEDE]_[ANNO]_dipendenti.csv</code>, <code>[SEDE]_[ANNO]_corsi.csv</code>, <code>[SEDE]_[ANNO]_assegnazioni.csv</code>, e <code>[SEDE]_[ANNO]_stato_piano.csv</code>.</li>
              <li>Una volta caricati i dati, puoi navigare nelle altre sezioni.</li>
              <li><strong>Importante:** Ogni modifica ai dati attiverà un **download automatico** del file CSV pertinente. **Devi salvare questo file, sovrascrivendo quello esistente nella tua cartella condivisa, per rendere la modifica persistente.**</li>
            </ol>
          </div>
        </div>
      </section>

      {currentSede && currentYear && (
        <section className={`${cardStyle}`}>
            <h2 className="text-2xl font-semibold mb-3 text-gray-800">Azioni Rapide per {currentSede} / {currentYear}</h2>
            <button
            onClick={clearCurrentSedeYearData}
            className="bg-danger text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center text-lg"
            >
            <FaEraser className="mr-2" />
            Cancella Dati in Memoria per {currentSede} / {currentYear}
            </button>
            <p className="text-sm text-gray-500 mt-2">Attenzione: cancella i dati per la sede/anno correnti solo dalla memoria dell'applicazione per la sessione. Non modificherà i file CSV su disco.</p>
        </section>
      )}
    </div>
  );
};

export default HomePage;