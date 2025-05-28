import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaUsers, FaTasks, FaChartBar, FaUserShield, FaSignInAlt, FaSignOutAlt, FaBuilding, FaUserCircle, FaCalendarDay } from 'react-icons/fa';
import { useData } from '../contexts/DataContext';
import Select from 'react-select';
import Modal from './Modal'; // Per il login admin

const Navbar: React.FC = () => {
  const { 
    sedi, currentSede, setCurrentSede, 
    currentYear, setCurrentYear, availableYears,
    isAdminAuthenticated, loginAdmin, logoutAdmin,
    currentKeyPersonnel, loginKeyPersonnel, logoutKeyPersonnel, keyPersonnelList
  } = useData();
  const navigate = useNavigate();

  const [isLoginAdminModalOpen, setIsLoginAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const [isLoginUserModalOpen, setIsLoginUserModalOpen] = useState(false);
  const [userLoginName, setUserLoginName] = useState('');
  const [userLoginPassword, setUserLoginPassword] = useState('');


  const activeClassName = "bg-primary text-white";
  const inactiveClassName = "text-gray-300 hover:bg-gray-700 hover:text-white";
  
  const linkClasses = (isActive: boolean) => 
    `px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${isActive ? activeClassName : inactiveClassName}`;

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(adminPassword)) {
      setIsLoginAdminModalOpen(false);
      setAdminPassword('');
      navigate('/admin');
    }
  };
  
  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginKeyPersonnel(userLoginName, userLoginPassword)) {
      setIsLoginUserModalOpen(false);
      setUserLoginName('');
      setUserLoginPassword('');
    }
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    navigate('/');
  };

  const handleUserLogout = () => {
    logoutKeyPersonnel();
  };

  const sedeOptions = sedi.map(s => ({ value: s, label: s }));
  const selectedSedeOption = currentSede ? { value: currentSede, label: currentSede } : null;
  
  const yearOptions = availableYears().map(y => ({ value: y, label: y.toString() }));
  const selectedYearOption = currentYear ? { value: currentYear, label: currentYear.toString() } : null;
  
  // Updated to use new theme colors
  const customSelectStyles = { 
    control: (base: any, {selectProps}: any) => ({ 
        ...base, 
        backgroundColor: '#1A202C', 
        borderColor: '#6c757d', 
        color: 'white', 
        minWidth: selectProps.id === 'year-select' ? '150px' : '120px' // Increased minWidth for year select
    }), 
    singleValue: (base: any) => ({ ...base, color: 'white' }),
    placeholder: (base: any) => ({ ...base, color: '#A0AEC0' }), //text-gray-400
    menu: (base: any) => ({ ...base, backgroundColor: '#1A202C', zIndex: 50}), // bg-dark
    option: (base: any, {isFocused, isSelected}: any) => ({
         ...base, 
         backgroundColor: isSelected ? '#2E8540' : isFocused ? '#2c3e50' : '#1A202C', // primary, lighter dark-charcoal, dark-charcoal
         color: 'white',
         ':active': {backgroundColor: '#1c6430'} // darker primary
    })
  };

  return (
    <>
      <nav className="bg-dark shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-auto md:h-20 py-2 flex-wrap"> {/* Allow wrapping for smaller screens */}
            <div className="flex items-center flex-shrink-0 mr-4">
              <NavLink to="/" className="text-white text-lg sm:text-xl font-bold flex items-center">
                 <img src="/logo.png" alt="SIAD Logo" className="h-8 sm:h-10 mr-2 sm:mr-3" /> {/* SIAD Logo Added */}
                 SIAD GxP - Training Platform
              </NavLink>
            </div>

            {/* Selectors Area */}
            <div className="order-3 md:order-2 flex flex-wrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto md:ml-4">
                 <div className="flex items-center">
                    <FaBuilding className="text-gray-300 mr-2" />
                    <Select
                        id="sede-select"
                        options={sedeOptions}
                        value={selectedSedeOption}
                        onChange={(option) => setCurrentSede(option ? option.value : null)}
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
                        className="text-sm w-full sm:w-auto" // Allow auto width, minWidth handles it
                        isClearable
                        styles={customSelectStyles}
                    />
                 </div>
            </div>


            <div className="order-2 md:order-3 flex items-center mt-2 md:mt-0">
              <div className="ml-3 relative flex items-center space-x-2">
                {isAdminAuthenticated ? (
                  <button onClick={handleAdminLogout} className={linkClasses(false) + " bg-red-600 hover:bg-red-700"}>
                    <FaSignOutAlt /> <span className="hidden sm:inline">Logout Admin</span>
                  </button>
                ) : (
                  <button onClick={() => setIsLoginAdminModalOpen(true)} className={linkClasses(false)}>
                    <FaUserShield /> <span className="hidden sm:inline">Admin</span>
                  </button>
                )}

                {currentKeyPersonnel ? (
                  <div className="flex items-center">
                    <span className="text-gray-300 text-sm mr-2 hidden sm:inline">Ciao, {currentKeyPersonnel.name} ({currentKeyPersonnel.role})</span>
                    <button onClick={handleUserLogout} className={linkClasses(false) + " bg-red-500 hover:bg-red-600"}>
                      <FaSignOutAlt /> <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                ) : (
                  keyPersonnelList.length > 0 && ( 
                    <button onClick={() => setIsLoginUserModalOpen(true)} className={linkClasses(false)}>
                      <FaUserCircle /> <span className="hidden sm:inline">Login Utente</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Navigation Links - full width on mobile below selectors */}
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

      {/* Admin Login Modal */}
      <Modal isOpen={isLoginAdminModalOpen} onClose={() => setIsLoginAdminModalOpen(false)} title="Login Admin">
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">Password Admin</label>
            <input
              type="password"
              id="adminPassword"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-white text-gray-900"
              required
            />
          </div>
          <button type="submit" className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-green-700">Login</button>
        </form>
      </Modal>

      {/* User Login Modal */}
      <Modal isOpen={isLoginUserModalOpen} onClose={() => setIsLoginUserModalOpen(false)} title="Login Utente Chiave">
        <form onSubmit={handleUserLogin} className="space-y-4">
          <div>
            <label htmlFor="userLoginName" className="block text-sm font-medium text-gray-700">Nome Utente</label>
            <input
              type="text"
              id="userLoginName"
              value={userLoginName}
              onChange={(e) => setUserLoginName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-white text-gray-900"
              required
            />
          </div>
          <div>
            <label htmlFor="userLoginPassword" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              id="userLoginPassword"
              value={userLoginPassword}
              onChange={(e) => setUserLoginPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-white text-gray-900"
              required
            />
          </div>
          <button type="submit" className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-green-700">Login</button>
        </form>
      </Modal>
    </>
  );
};

export default Navbar;