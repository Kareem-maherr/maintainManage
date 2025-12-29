import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

interface Project {
  id: string;
  project: string[];
}

interface User {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  createdAt: any;
  responsible_engineer: string;
  sales_engineer?: string;
  project: string[];
  branch: string[];
  contactNumber: string;
  contactJobTitle: string;
}

interface Engineer {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  company: string;
}

const ClientList = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [isAssigningEngineer, setIsAssigningEngineer] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [clientTickets, setClientTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [newUser, setNewUser] = useState({
    companyName: '',
    email: '',
    phone: '',
    address: '',
    role: 'client',
    project: [''],
    branch: [''],
    responsible_engineer: '',
    contactNumber: '',
    contactJobTitle: ''
  });
  const { t, tEn } = useLanguage();
  const { currentUser } = useAuth();

  const getCompanyNameEn = (companyName?: string) => {
    if (!companyName) return t('clients.companyNameNotSet');
    const translationKey = `clients.clientNames.${companyName}`;
    const translated = tEn(translationKey);
    return translated === translationKey ? companyName : translated;
  };

  useEffect(() => {
    fetchUsers();
    checkUserRole();
    fetchEngineers();
  }, [currentUser]);

  const checkUserRole = async () => {
    if (!currentUser?.uid) return;
    
    try {
      const engineerDoc = await getDoc(doc(db, 'engineers', currentUser.uid));
      if (engineerDoc.exists()) {
        const userData = engineerDoc.data();
        setIsAdmin(userData?.role === 'admin');
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const fetchEngineers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'engineers'));
      const engineersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Engineer[];
      // Only include engineers, exclude admins
      setEngineers(engineersData.filter(eng => eng.role === 'engineer'));
    } catch (error) {
      console.error('Error fetching engineers:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      // Only show users with role === 'client', excluding any other roles
      setUsers(usersData.filter(user => user.role && user.role.toLowerCase() === 'client'));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'users'), {
        ...newUser,
        createdAt: serverTimestamp(),
      });
      
      setUsers([...users, { id: docRef.id, ...newUser, createdAt: new Date() }]);
      setIsAddingUser(false);
      setNewUser({
        companyName: '',
        email: '',
        phone: '',
        address: '',
        role: 'client',
        project: [''],
        branch: [''], 
        responsible_engineer: '',
        contactNumber: '',
        contactJobTitle: '',
      });
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  const getRandomColor = (str: string) => {
    const colors = [
      'bg-blue-100 text-blue-600',
      'bg-purple-100 text-purple-600',
      'bg-green-100 text-green-600',
      'bg-yellow-100 text-yellow-600',
      'bg-red-100 text-red-600',
      'bg-indigo-100 text-indigo-600',
    ];
    const hash = str.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return colors[hash % colors.length];
  };

  const handleAssignEngineer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedEngineerId) return;

    // Find the selected engineer to get their name and phone
    const selectedEngineer = engineers.find(
      (eng) => eng.email === selectedEngineerId || eng.id === selectedEngineerId,
    );
    if (!selectedEngineer) {
      alert('Selected engineer was not found. Please re-open the modal and try again.');
      return;
    }

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        responsible_engineer: selectedEngineerId,
        assigned_engineer_name: selectedEngineer.name || '',
        assigned_engineer_phone: selectedEngineer.phone || ''
      });

      // Update local state
      setUsers(users.map(user => 
        user.id === selectedUser.id 
          ? { 
              ...user, 
              responsible_engineer: selectedEngineerId,
              assigned_engineer_name: selectedEngineer.name || '',
              assigned_engineer_phone: selectedEngineer.phone || ''
            }
          : user
      ));
      
      // Update selected user
      setSelectedUser({ 
        ...selectedUser, 
        responsible_engineer: selectedEngineerId,
        assigned_engineer_name: selectedEngineer.name || '',
        assigned_engineer_phone: selectedEngineer.phone || ''
      } as User);
      
      setIsAssigningEngineer(false);
      setSelectedEngineerId('');
      alert('Engineer assigned successfully!');
    } catch (error) {
      console.error('Error assigning engineer:', error);
      alert('Failed to assign engineer. Please try again.');
    }
  };

  const fetchClientTickets = async (companyName: string) => {
    if (!companyName) return;
    
    try {
      setLoadingTickets(true);
      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('company', '==', companyName)
      );
      const querySnapshot = await getDocs(ticketsQuery);
      const tickets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      setClientTickets(tickets);
    } catch (error) {
      console.error('Error fetching client tickets:', error);
      setClientTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleSelectUser = (user: User) => {
    const newSelectedUser = selectedUser?.id === user.id ? null : user;
    setSelectedUser(newSelectedUser);
    
    // Fetch tickets for the selected user
    if (newSelectedUser && newSelectedUser.companyName) {
      fetchClientTickets(newSelectedUser.companyName);
    } else {
      setClientTickets([]);
    }
  };

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-6"
      >
        <h2 className="text-2xl font-semibold text-gray-900">{t('clients.title')}</h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAddingUser(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
        >
          {t('clients.addNewClient')}
        </motion.button>
      </motion.div>

      {/* Split Panel Layout */}
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Left Panel - Client List Table */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-96 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Clients</h3>
            <p className="text-sm text-gray-500 mt-1">{users.length} total clients</p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <motion.div
                    key={`skeleton-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gray-50 rounded-lg p-4"
                  >
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: index * 0.1 }}
                      className="h-5 bg-gray-200 rounded mb-2"
                    />
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: index * 0.1 + 0.2 }}
                      className="h-4 bg-gray-200 rounded w-2/3"
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {users.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      delay: index * 0.05 
                    }}
                    whileHover={{ 
                      x: 4,
                      transition: { duration: 0.2 }
                    }}
                    onClick={() => handleSelectUser(user)}
                    className={`
                      p-4 border-b border-gray-100 cursor-pointer transition-all duration-200
                      ${selectedUser?.id === user.id 
                        ? 'bg-primary bg-opacity-10 border-r-4 border-r-primary' 
                        : 'hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        className={`
                          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                          ${selectedUser?.id === user.id 
                            ? 'bg-primary text-white' 
                            : getRandomColor(user.companyName || user.email)
                          }
                        `}
                      >
                        <span className="text-lg font-bold">
                          {user.companyName?.charAt(0) || user.email.charAt(0)}
                        </span>
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`
                          font-semibold truncate
                          ${selectedUser?.id === user.id ? 'text-primary' : 'text-gray-900'}
                        `}>
                          {getCompanyNameEn(user.companyName)}
                        </h4>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                      {selectedUser?.id === user.id && (
                        <motion.svg
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className="w-5 h-5 text-primary flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </motion.svg>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Right Panel - Client Details */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {selectedUser ? (
              <motion.div
                key={selectedUser.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="h-full overflow-y-auto p-8"
              >
                {/* Header with Avatar */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-6 mb-8 pb-6 border-b border-gray-200"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className={`w-24 h-24 rounded-2xl ${getRandomColor(selectedUser.companyName || selectedUser.email)} flex items-center justify-center shadow-lg`}
                  >
                    <span className="text-4xl font-bold">
                      {selectedUser.companyName?.charAt(0) || selectedUser.email.charAt(0)}
                    </span>
                  </motion.div>
                  <div className="flex-1">
                    <motion.h2
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-3xl font-bold text-gray-900 mb-2"
                    >
                      {getCompanyNameEn(selectedUser.companyName)}
                    </motion.h2>
                    <motion.p
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-gray-500 text-lg"
                    >
                      {selectedUser.email}
                    </motion.p>
                  </div>
                  {isAdmin && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedEngineerId(selectedUser.responsible_engineer || '');
                        setIsAssigningEngineer(true);
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Assign Engineer
                    </motion.button>
                  )}
                </motion.div>

                {/* Contact Information */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Phone
                      </div>
                      <p className="text-gray-900 font-medium">{selectedUser.contactNumber || 'Not provided'}</p>
                    </motion.div>
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Address
                      </div>
                      <p className="text-gray-900 font-medium">{selectedUser.address || 'Not provided'}</p>
                    </motion.div>
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Contact Job Title
                      </div>
                      <p className="text-gray-900 font-medium">{selectedUser.contactJobTitle || 'Not provided'}</p>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Engineers */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mb-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Team
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="bg-blue-50 rounded-lg p-4 hover:bg-blue-100 transition-colors"
                    >
                      <div className="flex items-center text-sm text-blue-600 mb-1">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Responsible Engineer
                      </div>
                      <p className="text-gray-900 font-medium">{selectedUser.responsible_engineer || 'Not assigned'}</p>
                    </motion.div>
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="bg-purple-50 rounded-lg p-4 hover:bg-purple-100 transition-colors"
                    >
                      <div className="flex items-center text-sm text-purple-600 mb-1">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6m8 0H8m0 0v.01M8 6v.01" />
                        </svg>
                        Sales Engineer
                      </div>
                      <p className="text-gray-900 font-medium">{selectedUser.sales_engineer || 'Not assigned'}</p>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Projects */}
                {selectedUser.project && selectedUser.project.length > 0 && selectedUser.project[0] && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mb-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {t('clients.projects')}
                    </h3>
                    <div className="space-y-2">
                      {selectedUser.project.map((project, index) => (
                        <motion.div
                          key={index}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.8 + index * 0.1 }}
                          className="bg-green-50 rounded-lg p-3 flex items-center hover:bg-green-100 transition-colors"
                        >
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                          <span className="text-gray-900 font-medium">{project}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Branches */}
                {selectedUser.branch && selectedUser.branch.length > 0 && selectedUser.branch[0] && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="mb-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      {t('clients.branch')}
                    </h3>
                    <div className="space-y-2">
                      {selectedUser.branch.map((branch, index) => (
                        <motion.div
                          key={index}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 1.0 + index * 0.1 }}
                          className="bg-orange-50 rounded-lg p-3 flex items-center hover:bg-orange-100 transition-colors"
                        >
                          <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                          <span className="text-gray-900 font-medium">{branch}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Client Tickets */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.0 }}
                  className="mb-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Client Tickets ({clientTickets.length})
                  </h3>
                  {loadingTickets ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="bg-gray-50 rounded-lg p-3"
                        >
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="h-4 bg-gray-200 rounded w-3/4 mb-2"
                          />
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                            className="h-3 bg-gray-200 rounded w-1/4"
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : clientTickets.length > 0 ? (
                    <div className="space-y-2">
                      {clientTickets.map((ticket, index) => (
                        <motion.div
                          key={ticket.id}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 1.1 + index * 0.05 }}
                          className="bg-white border border-gray-200 rounded-lg p-3 hover:border-primary hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {ticket.title}
                              </p>
                            </div>
                            <span className={`
                              px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap
                              ${ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' : 
                                ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                ticket.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'}
                            `}>
                              {ticket.status}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-8 bg-gray-50 rounded-lg"
                    >
                      <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">No tickets found for this client</p>
                    </motion.div>
                  )}
                </motion.div>

                {/* Additional Info */}
                {selectedUser.createdAt && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex items-center text-sm text-gray-500">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {t('clients.joined')}: <span className="ml-2 font-medium text-gray-900">{selectedUser.createdAt.toDate().toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full flex items-center justify-center"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ 
                      y: [0, -10, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Client</h3>
                  <p className="text-gray-500">Click on a client from the list to view their details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {isAddingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-lg p-6 w-[600px]"
            >
              <motion.h3 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl font-semibold mb-4"
              >
                {t('clients.addNewClient')}
              </motion.h3>
              <motion.form 
                onSubmit={handleAddUser} 
                className="space-y-4"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.2
                    }
                  }
                }}
                initial="hidden"
                animate="show"
              >
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    show: { opacity: 1, x: 0 }
                  }}
                >
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('clients.companyName')}
                  </label>
                  <motion.input
                    type="text"
                    value={newUser.companyName}
                    onChange={(e) => setNewUser({ ...newUser, companyName: e.target.value })}
                    whileFocus={{ scale: 1.02, boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)" }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                  />
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    show: { opacity: 1, x: 0 }
                  }}
                >
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('clients.email')}
                  </label>
                  <motion.input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    whileFocus={{ scale: 1.02, boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)" }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                  />
                </motion.div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('clients.phone')}
                  </label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('clients.address')}
                  </label>
                  <input
                    type="text"
                    value={newUser.address}
                    onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('clients.projects')}
                  </label>
                  <input
                    type="text"
                    value={newUser.project[0]}
                    onChange={(e) => setNewUser({ ...newUser, project: [e.target.value] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t('clients.projectsPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('clients.branch')}
                  </label>
                  <input
                    type="text"
                    value={newUser.branch[0]}
                    onChange={(e) => setNewUser({ ...newUser, branch: [e.target.value] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t('clients.branchPlaceholder')}
                  />
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('clients.engineer')}
                    </label>
                    <select
                      value={newUser.responsible_engineer}
                      onChange={(e) => setNewUser({ ...newUser, responsible_engineer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                    >
                      <option value="">Select an engineer</option>
                      {engineers.map((engineer) => (
                        <option key={engineer.id} value={engineer.email}>
                          {engineer.name} ({engineer.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex justify-end space-x-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsAddingUser(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t('common.cancel')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
                  >
                    {t('clients.addClient')}
                  </motion.button>
                </div>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Engineer Modal */}
      <AnimatePresence>
        {isAssigningEngineer && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-lg p-6 w-[500px]"
            >
              <motion.h3 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl font-semibold mb-4"
              >
                Assign Engineer to {selectedUser.companyName}
              </motion.h3>
              <motion.form 
                onSubmit={handleAssignEngineer} 
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Engineer
                  </label>
                  <select
                    value={selectedEngineerId}
                    onChange={(e) => setSelectedEngineerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                    required
                  >
                    <option value="">Select an engineer</option>
                    {engineers.map((engineer) => (
                      <option key={engineer.id} value={engineer.email}>
                        {engineer.name} ({engineer.email})
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedUser.responsible_engineer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Current Engineer:</span> {selectedUser.responsible_engineer}
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-4 mt-6">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setIsAssigningEngineer(false);
                      setSelectedEngineerId('');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
                  >
                    Assign Engineer
                  </motion.button>
                </div>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientList;
