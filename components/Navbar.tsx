
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaUsers, FaTasks, FaChartBar, FaUserShield, FaSignInAlt, FaSignOutAlt, FaBuilding, FaUserCircle, FaCalendarDay } from 'react-icons/fa';
import { useData } from '../contexts/DataContext';
import Select from 'react-select';
import Modal from './Modal';

const Navbar: React.FC = () => {
  const { 
    sedi, currentSedeId, setCurrentSedeId, 
    currentYear, setCurrentYear, availableYears,
    isAdminAuthenticated, // Derivato da currentKeyPersonnel
    currentKeyPersonnel, loginUser, logoutUser, keyPersonnelList 
  } = useData();
  const navigate = useNavigate();
  
  const [isLoginUserModalOpen, setIsLoginUserModalOpen] = useState(false);
  const [userLoginEmail, setUserLoginEmail] = useState(''); // Email per Supabase Auth
  const [userLoginPassword, setUserLoginPassword] = useState('');

  // L'autenticazione Admin ora è gestita come un utente chiave con ruolo 'Admin'
  // Quindi la modale Admin separata non è più necessaria se l'Admin logga come Utente Chiave.
  // Se si vuole mantenere un flusso di "login as admin" distinto senza che l'admin sia nella lista 'KeyPersonnel' visibile,
  // allora quella logica andrebbe adattata. Per ora, unifico.

  const activeClassName = "bg-primary text-white";
  const inactiveClassName = "text-gray-300 hover:bg-gray-700 hover:text-white";
  
  const linkClasses = (isActive: boolean) => 
    `px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${isActive ? activeClassName : inactiveClassName}`;
  
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const {success, message} = await loginUser(userLoginEmail, userLoginPassword);
    if (success) {
      setIsLoginUserModalOpen(false);
      setUserLoginEmail('');
      setUserLoginPassword('');
      // Navigate to admin if user is admin, or home/dashboard otherwise
      // This logic might need refinement based on `currentKeyPersonnel` role after login
      // For now, onAuthStateChange in DataContext handles setting currentKeyPersonnel
      // We can check currentKeyPersonnel.role here *after* it's set.
      // However, direct navigation based on role after login is better handled in DataContext or App.tsx
    } else {
        alert(message || "Login fallito.");
    }
  };

  const handleUserLogout = async () => {
    await logoutUser();
    navigate('/'); // Navigate to home after logout
  };

  const sedeOptions = sedi.map(s => ({ value: s.id, label: s.name }));
  const selectedSedeOption = currentSedeId ? sedeOptions.find(s => s.value === currentSedeId) : null;
  
  const yearOptions = availableYears().map(y => ({ value: y, label: y.toString() }));
  const selectedYearOption = currentYear ? { value: currentYear, label: currentYear.toString() } : null;
  
  const customSelectStyles = { 
    control: (base: any, {selectProps}: any) => ({ 
        ...base, 
        backgroundColor: '#1A202C', 
        borderColor: '#6c757d', 
        color: 'white', 
        minWidth: selectProps.id === 'year-select' ? '150px' : '120px'
    }), 
    singleValue: (base: any) => ({ ...base, color: 'white' }),
    placeholder: (base: any) => ({ ...base, color: '#A0AEC0' }),
    menu: (base: any) => ({ ...base, backgroundColor: '#1A202C', zIndex: 50}),
    option: (base: any, {isFocused, isSelected}: any) => ({
         ...base, 
         backgroundColor: isSelected ? '#2E8540' : isFocused ? '#2c3e50' : '#1A202C',
         color: 'white',
         ':active': {backgroundColor: '#1c6430'}
    })
  };

  return (
    <>
      <nav className="bg-dark shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-auto md:h-24 py-4 flex-wrap"> {/* Updated line */}
            <div className="flex items-center flex-shrink-0 mr-4">
              <NavLink to="/" className="text-white text-lg sm:text-xl font-bold flex items-center">
                 <img src="/logo.png" alt="SIAD Logo" className="h-7 sm:h-8 mr-2 sm:mr-3" />
                 SIAD GxP - Training Platform
              </NavLink>
            </div>

            <div className="order-3 md:order-2 flex flex-wrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto md:ml-4">
                 <div className="flex items-center">
                    <FaBuilding className="text-gray-300 mr-2" />
                    <Select
                        id="sede-select"
                        options={sedeOptions}
                        value={selectedSedeOption}
                        onChange={(option) => setCurrentSedeId(option ? option.value : null)}
                        placeholder="Sede..."
                        className="text-sm w-full sm:w-40" 
                        isClearable
                        styles={customSelectStyles}
                    />
                 </div>
                 <div className="flex items-center">
                    <FaCalendarDay className="text-gray-300 mr-2" />
                     <Select
                        id="year-select"
                        options={yearOptions}
                        value={selectedYearOption}
                        onChange={(option) => setCurrentYear(option ? option.value : null)}
                        placeholder="Anno..."
                        className="text-sm w-full sm:w-auto"
                        isClearable
                        styles={customSelectStyles}
                    />
                 </div>
            </div>

            <div className="order-2 md:order-3 flex items-center mt-2 md:mt-0">
              <div className="ml-3 relative flex items-center space-x-2">
                {currentKeyPersonnel ? (
                  <div className="flex items-center">
                    <span className="text-gray-300 text-sm mr-2 hidden sm:inline" title={currentKeyPersonnel.email}>
                        Ciao, {currentKeyPersonnel.name} ({currentKeyPersonnel.roles.join(', ')})
                    </span>
                    <button onClick={handleUserLogout} className={linkClasses(false) + " bg-red-500 hover:bg-red-600"}>
                      <FaSignOutAlt /> <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setIsLoginUserModalOpen(true)} className={linkClasses(false)}>
                    <FaSignInAlt /> <span className="hidden sm:inline">Login</span>
                  </button>
                )}
              </div>
            </div>

            <div className="order-4 md:order-4 hidden md:flex items-baseline space-x-4 mt-2 md:mt-0 w-full md:w-auto justify-center md:justify-start">
              <NavLink to="/" className={({isActive}) => linkClasses(isActive)}>
                <FaHome /> <span>Home</span>
              </NavLink>
              <NavLink to="/pianificazione" className={({isActive}) => linkClasses(isActive)}>
                <FaCalendarAlt /> <span>Pianificazione</span>
              </NavLink>
              <NavLink to="/dipendenti" className={({isActive}) => linkClasses(isActive)}>
                <FaUsers /> <span>Dipendenti</span>
              </NavLink>
              <NavLink to="/assegnazioni" className={({isActive}) => linkClasses(isActive)}>
                <FaTasks /> <span>Assegnazioni</span>
              </NavLink>
              <NavLink to="/report" className={({isActive}) => linkClasses(isActive)}>
                <FaChartBar /> <span>Report</span>
              </NavLink>
              {isAdminAuthenticated && (
                <NavLink to="/admin" className={({isActive}) => linkClasses(isActive)}>
                  <FaUserShield /> <span>Pannello Admin</span>
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </nav>

      <Modal isOpen={isLoginUserModalOpen} onClose={() => setIsLoginUserModalOpen(false)} title="Login Utente">
        <form onSubmit={handleUserLogin} className="space-y-4">
          <div>
            <label htmlFor="userLoginEmail" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="userLoginEmail"
              value={userLoginEmail}
              onChange={(e) => setUserLoginEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-white text-gray-900"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="userLoginPassword" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              id="userLoginPassword"
              value={userLoginPassword}
              onChange={(e) => setUserLoginPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-white text-gray-900"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-green-700">Login</button>
        </form>
      </Modal>
    </>
  );
};

export default Navbar;
