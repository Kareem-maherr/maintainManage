import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  orderBy,
  getDoc,
  doc,
  getDocs,
  limit,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAuth } from 'firebase/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

interface FullTicket {
  id: string;
  title: string;
  company: string;
  location: string;
  createdAt: any;
  severity: string;
  status: string;
  responsible_engineer?: string;
  hasUnreadMessages?: boolean;
  date?: any;
  isViewed?: boolean;
  isDateSet?: boolean;
  readableId?: string;
  sender?: string;
  noteStatus?: string;
  projectNumber?: string;
  ticketDetails?: string;
}

interface FilterOptions {
  startDate: string;
  endDate: string;
  company: string;
  severity: string;
  status: string;
  location: string;
  sort: string;
}

interface Team {
  id: string;
  name: string;
  leadEngineer: string;
  projectManager: string;
  supervisor?: string;
  supervisorEmail?: string;
  team_engineer?: string;
}

const FullTicketList = () => {
  const [tickets, setTickets] = useState<FullTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<FullTicket | null>(null);
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: '',
    endDate: '',
    company: '',
    severity: '',
    status: '',
    location: '',
    sort: 'newest',
  });
  const [companies, setCompanies] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isResponsibleEngineer, setIsResponsibleEngineer] = useState(false);
  const [isEngineer, setIsEngineer] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [showDatePopup, setShowDatePopup] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editSeverity, setEditSeverity] = useState<string>('');
  const auth = getAuth();
  const { t } = useLanguage();

  // Handle ticket selection
  const handleSelectTicket = (ticket: FullTicket) => {
    setSelectedTicket(selectedTicket?.id === ticket.id ? null : ticket);
  };

  const severityOptions = [
    t('tickets.filters.all'),
    t('tickets.severity.critical'),
    t('tickets.severity.high'),
    t('tickets.severity.medium'),
    t('tickets.severity.low'),
  ];
  const statusOptions = [
    t('tickets.filters.all'),
    t('tickets.status.open'),
    t('tickets.status.inprogress'),
    t('tickets.status.resolved'),
  ];

  useEffect(() => {
    const fetchUserRoleAndTickets = async () => {
      if (!auth.currentUser) return;

      try {
        const currentUser = auth.currentUser;
        setUserEmail(currentUser.email);

        // Get user document to check role
        const userDocRef = doc(db, 'engineers', currentUser.uid);
        console.log('Fetching engineer document from path:', userDocRef.path);
        
        const userDoc = await getDoc(userDocRef);
        console.log('Document exists:', userDoc.exists());
        
        const userData = userDoc.data();
        console.log('User document data:', userData);
        
        const isUserEngineer = userData?.role === 'engineer';
        console.log('Role field value:', userData?.role);
        console.log('Is engineer based on role:', isUserEngineer);
        
        setIsResponsibleEngineer(isUserEngineer);
        setIsEngineer(isUserEngineer);

        // Set admin status based on role in engineers collection
        const isAdmin = userData?.role === 'admin';
        setIsAdmin(isAdmin);
        
        // Log user information for debugging
        console.log('User logged in:', {
          email: currentUser.email,
          uid: currentUser.uid,
          role: userData?.role || 'unknown',
          isAdmin: isAdmin,
          isEngineer: isUserEngineer
        });

        // Build query based on user role
        let ticketsQuery;
        if (isAdmin) {
          // Admin sees all tickets
          ticketsQuery = query(
            collection(db, 'tickets'),
            orderBy('createdAt', 'desc'),
          );
        } else if (isUserEngineer && currentUser.email) {
          // Engineer sees only their tickets
          console.log('Creating engineer query with email:', currentUser.email);
          ticketsQuery = query(
            collection(db, 'tickets'),
            where('responsible_engineer', '==', currentUser.email),
            orderBy('createdAt', 'desc'),
          );
          console.log('Engineer query created:', ticketsQuery);
        } else {
          // Non-admin, non-engineer users should see no tickets
          setTickets([]);
          setLoading(false);
          return;
        }

        // Apply filters
        if (filters.startDate) {
          const startTimestamp = Timestamp.fromDate(
            new Date(filters.startDate),
          );
          ticketsQuery = query(
            ticketsQuery,
            where('createdAt', '>=', startTimestamp),
          );
        }

        if (filters.endDate) {
          const endTimestamp = Timestamp.fromDate(
            new Date(filters.endDate + 'T23:59:59'),
          );
          ticketsQuery = query(
            ticketsQuery,
            where('createdAt', '<=', endTimestamp),
          );
        }

        if (filters.company && filters.company !== 'All') {
          ticketsQuery = query(
            ticketsQuery,
            where('company', '==', filters.company),
          );
        }

        if (filters.severity && filters.severity !== 'All') {
          ticketsQuery = query(
            ticketsQuery,
            where('severity', '==', filters.severity),
          );
        }

        if (filters.status && filters.status !== 'All') {
          ticketsQuery = query(
            ticketsQuery,
            where('status', '==', filters.status),
          );
        }

        if (filters.location && filters.location !== 'All') {
          ticketsQuery = query(
            ticketsQuery,
            where('location', '==', filters.location),
          );
        }

        const unsubscribe = onSnapshot(ticketsQuery, async (snapshot) => {
          console.log('Snapshot received, document count:', snapshot.docs.length);
          const ticketsData: FullTicket[] = [];

          for (const doc of snapshot.docs) {
            const ticketData = doc.data();
            console.log('Ticket found:', {
              id: doc.id,
              title: ticketData.title,
              responsible_engineer: ticketData.responsible_engineer,
              createdAt: ticketData.createdAt ? new Date(ticketData.createdAt.seconds * 1000).toLocaleString() : 'unknown'
            });

            // Check for unread messages
            const messagesRef = collection(db, 'tickets', doc.id, 'messages');
            const lastMessageQuery = query(
              messagesRef,
              orderBy('timestamp', 'desc'),
              limit(1),
            );
            const lastMessageSnap = await getDocs(lastMessageQuery);

            const hasUnreadMessages =
              !lastMessageSnap.empty &&
              lastMessageSnap.docs[0].data().sender !== currentUser.email &&
              (!ticketData.lastReadTimestamp ||
                lastMessageSnap.docs[0].data().timestamp >
                  ticketData.lastReadTimestamp);

            ticketsData.push({
              id: doc.id,
              title: ticketData.title,
              company: ticketData.company,
              location: ticketData.location,
              createdAt: ticketData.createdAt,
              severity: ticketData.severity,
              status: ticketData.status,
              responsible_engineer: ticketData.responsible_engineer,
              hasUnreadMessages,
              date: ticketData.date,
              isViewed: ticketData.isViewed || false,
              isDateSet: ticketData.isDateSet || false,
              readableId: ticketData.ticketId || 'Unknown',
              sender: ticketData.sender,
              noteStatus: ticketData.noteStatus || '',
              projectNumber: ticketData.projectNumber,
              ticketDetails: ticketData.ticketDetails,
            });
          }

          // Update unique companies and locations for filters
          const uniqueCompanies = [
            ...new Set(ticketsData.map((ticket) => ticket.company)),
          ];
          const uniqueLocations = [
            ...new Set(ticketsData.map((ticket) => ticket.location)),
          ];
          setCompanies(['All', ...uniqueCompanies]);
          setLocations(['All', ...uniqueLocations]);

          setTickets(ticketsData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up ticket listener:', error);
        setLoading(false);
      }
    };

    fetchUserRoleAndTickets();
  }, [filters, auth.currentUser]);

  // Handle URL parameter for ticket highlighting
  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    if (highlightParam) {
      setHighlightedTicketId(highlightParam);
      
      // Clear the URL parameter immediately
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('highlight');
      setSearchParams(newSearchParams, { replace: true });
      
      // Clear highlighting after 1 second
      const timer = setTimeout(() => {
        setHighlightedTicketId(null);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams.get('highlight'), setSearchParams]);

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      company: '',
      severity: '',
      status: '',
      location: '',
      sort: 'newest',
    });
  };

  // Generate a ticket ID from sender email and random number
  const generateTicketId = (ticket: FullTicket) => {
    // Get the sender email from the ticket
    const senderEmail = ticket.sender || userEmail || 'unknown';
    // Extract the part before @ in the email
    const senderName = senderEmail.split('@')[0] || 'user';
    // Generate a random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${senderName}-${randomNum}`;
  };

  // Handle click on Unknown ticket ID to generate a new readable ID
  const handleGenerateTicketId = async (e: React.MouseEvent, ticket: FullTicket) => {
    e.stopPropagation(); // Prevent opening the ticket details modal
    
    if (ticket.readableId !== 'Unknown' || generatingId === ticket.id) {
      return; // Already has an ID or is currently generating
    }
    
    try {
      setGeneratingId(ticket.id);
      const newTicketId = generateTicketId(ticket);
      
      // Update the ticket in Firestore
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        ticketId: newTicketId
      });
      
      // Update local state
      setTickets(prevTickets => 
        prevTickets.map(t => 
          t.id === ticket.id ? { ...t, readableId: newTicketId } : t
        )
      );
      
      console.log(`Generated new ticket ID: ${newTicketId} for ticket: ${ticket.id}`);
    } catch (error) {
      console.error('Error generating ticket ID:', error);
    } finally {
      setGeneratingId(null);
    }
  };

  // Filter and sort tickets based on current filters
  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter((ticket) => {
      const matchesCompany = !filters.company || ticket.company.toLowerCase().includes(filters.company.toLowerCase());
      const matchesSeverity = !filters.severity || filters.severity === t('tickets.filters.all') || ticket.severity.toLowerCase() === filters.severity.toLowerCase();
      const matchesStatus = !filters.status || filters.status === t('tickets.filters.all') || ticket.status.toLowerCase() === filters.status.toLowerCase();
      const matchesLocation = !filters.location || ticket.location.toLowerCase().includes(filters.location.toLowerCase());
      
      let matchesDateRange = true;
      if (filters.startDate || filters.endDate) {
        const ticketDate = ticket.createdAt?.toDate();
        if (ticketDate) {
          if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            matchesDateRange = matchesDateRange && ticketDate >= startDate;
          }
          if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999); // Include the entire end date
            matchesDateRange = matchesDateRange && ticketDate <= endDate;
          }
        }
      }
      
      return matchesCompany && matchesSeverity && matchesStatus && matchesLocation && matchesDateRange;
    });

    // Sort the filtered tickets
    return filtered.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      
      const dateA = a.createdAt.toDate().getTime();
      const dateB = b.createdAt.toDate().getTime();
      
      if (filters.sort === 'oldest') {
        return dateA - dateB; // Oldest first
      } else {
        return dateB - dateA; // Newest first (default)
      }
    });
  }, [tickets, filters, t]);

  const getTimeElapsed = (createdAt: any) => {
    if (!createdAt) return t('tickets.timeElapsed.na');

    const now = new Date();
    const created = createdAt.toDate();
    const elapsed = now.getTime() - created.getTime();

    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} ${days > 1 ? t('tickets.timeElapsed.daysPlural') : t('tickets.timeElapsed.days')}`;
    if (hours > 0) return `${hours} ${hours > 1 ? t('tickets.timeElapsed.hoursPlural') : t('tickets.timeElapsed.hours')}`;
    if (minutes > 0) return `${minutes} ${minutes > 1 ? t('tickets.timeElapsed.minutesPlural') : t('tickets.timeElapsed.minutes')}`;
    return t('tickets.timeElapsed.justNow');
  };

  // Fetch teams for the date popup
  useEffect(() => {
    const fetchTeams = async () => {
      if (!userEmail) return;
      
      const teamsCollection = collection(db, 'teams');
      const q = query(teamsCollection, where('team_engineer', '==', userEmail));
      const teamsSnapshot = await getDocs(q);
      const teamsData = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      setTeams(teamsData);
    };

    fetchTeams();
  }, [userEmail]);

  // Initialize edit values when ticket is selected
  useEffect(() => {
    if (selectedTicket) {
      setEditStatus(selectedTicket.status);
      setEditSeverity(selectedTicket.severity);
    }
  }, [selectedTicket]);

  // Handle save event date
  const handleSaveEventDate = async () => {
    if (!selectedDate || !selectedTeam || !selectedTicket) return;

    const selectedTeamData = teams.find(team => team.id === selectedTeam);
    if (!selectedTeamData) return;

    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 1);

    try {
      const eventData = {
        title: selectedTicket.title || 'Untitled Event',
        startDate: selectedDate,
        endDate: endDate,
        teamName: selectedTeamData.name || 'Unknown Team',
        projectName: selectedTicket.company || 'Unknown Project',
        projectManager: selectedTeamData.projectManager || 'Unassigned',
        leadEngineer: selectedTeamData.leadEngineer || 'Unassigned',
        location: selectedTicket.location || 'Unknown Location',
        ticketIds: [selectedTicket.id],
        ticketCount: 1,
        event_type: 'single',
        responsibleEngineer: userEmail || '',
        supervisorEmail: selectedTeamData.supervisorEmail || '',
        createdAt: new Date(),
        tickets: [{
          id: selectedTicket.id,
          title: selectedTicket.title,
          company: selectedTicket.company,
          location: selectedTicket.location,
          severity: selectedTicket.severity,
          status: selectedTicket.status,
          noteStatus: selectedTicket.noteStatus
        }]
      };

      await addDoc(collection(db, 'events'), eventData);

      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      const updateData: any = {
        date: selectedDate,
        isDateSet: true,
        supervisor_email: selectedTeamData.supervisorEmail || ''
      };
      
      if (!(selectedTicket as any).transfer_engineer) {
        updateData.responsible_engineer = userEmail || '';
      }
      
      await updateDoc(ticketRef, updateData);

      setShowDatePopup(false);
      setSelectedTeam('');
      setSelectedDate(new Date());
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  // Handle save status and severity
  const handleSaveStatusAndSeverity = async () => {
    if (!selectedTicket || !editStatus || !editSeverity) return;

    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      await updateDoc(ticketRef, {
        status: editStatus,
        severity: editSeverity,
      });

      setShowStatusPopup(false);
    } catch (error) {
      console.error('Error updating ticket status and severity:', error);
    }
  };

  if (loading) {
    return (
      <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-6"
      >
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('tickets.title')}</h2>
      </motion.div>

      {/* Split Panel Layout */}
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Left Panel - Ticket List */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-1/3 bg-white dark:bg-boxdark rounded-xl shadow-sm overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-gray-200 dark:border-strokedark">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              All Tickets ({filteredTickets.length})
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <motion.div
                    key={`skeleton-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-gray-200 dark:border-strokedark p-4"
                  >
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"
                    />
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: 0.1 }}
                      className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"
                    />
                  </motion.div>
                ))
              ) : (
                filteredTickets.map((ticket, index) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`
                      border-b border-gray-200 dark:border-strokedark p-4 cursor-pointer transition-all
                      ${selectedTicket?.id === ticket.id 
                        ? 'bg-primary/10 border-l-4 border-l-primary' 
                        : 'hover:bg-gray-50 dark:hover:bg-meta-4'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate mb-1 flex items-center gap-2">
                          {ticket.title}
                          {!ticket.isViewed && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                          {ticket.hasUnreadMessages && (
                            <span className="h-2 w-2 rounded-full bg-meta-1" />
                          )}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {ticket.company}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className={`
                            px-2 py-0.5 text-xs font-medium rounded-full
                            ${ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' : 
                              ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'}
                          `}>
                            {ticket.status}
                          </span>
                          <span className={`
                            px-2 py-0.5 text-xs font-medium rounded-full
                            ${ticket.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                              ticket.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                              ticket.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'}
                          `}>
                            {ticket.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right Panel - Ticket Details */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 bg-white dark:bg-boxdark rounded-xl shadow-sm overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {selectedTicket ? (
              <motion.div
                key={selectedTicket.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="h-full overflow-y-auto p-8"
              >
                {/* Ticket Header */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6 pb-6 border-b border-gray-200 dark:border-strokedark"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {selectedTicket.title}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ID: {selectedTicket.readableId || 'N/A'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`
                        px-3 py-1 text-sm font-medium rounded-full
                        ${selectedTicket.status === 'Resolved' ? 'bg-green-100 text-green-800' : 
                          selectedTicket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'}
                      `}>
                        {selectedTicket.status}
                      </span>
                      <span className={`
                        px-3 py-1 text-sm font-medium rounded-full
                        ${selectedTicket.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                          selectedTicket.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                          selectedTicket.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'}
                      `}>
                        {selectedTicket.severity}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Ticket Details - Reorganized with Sections */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-8"
                >
                  {/* Project Information Section */}
                  <div className="bg-gray-50 dark:bg-meta-4 rounded-lg p-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Project Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Company</label>
                        <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedTicket.company}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Location</label>
                        <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedTicket.location}</p>
                      </div>
                      {selectedTicket.projectNumber && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Project Number</label>
                          <p className="text-base font-medium text-primary dark:text-primary mt-1">{selectedTicket.projectNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ticket Details Section */}
                  {selectedTicket.ticketDetails && (
                    <div className="bg-blue-50 dark:bg-boxdark-2 rounded-lg p-5 border-l-4 border-primary">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Ticket Details
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.ticketDetails}
                      </p>
                    </div>
                  )}

                  {/* People & Assignment Section */}
                  <div className="bg-purple-50 dark:bg-meta-4 rounded-lg p-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      People & Assignment
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedTicket.sender && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sender</label>
                          <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedTicket.sender}</p>
                        </div>
                      )}
                      {selectedTicket.responsible_engineer && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Assigned Engineer</label>
                          <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedTicket.responsible_engineer}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Timeline Section */}
                  <div className="bg-green-50 dark:bg-meta-4 rounded-lg p-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Status & Timeline
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Created At</label>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          {selectedTicket.createdAt?.toDate().toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date Status</label>
                        <div className="mt-1">
                          <span className={`
                            inline-block px-3 py-1 text-xs font-semibold rounded-full
                            ${selectedTicket.isDateSet ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}
                          `}>
                            {selectedTicket.isDateSet ? 'Date Set' : 'Date Not Set'}
                          </span>
                        </div>
                      </div>
                      {selectedTicket.noteStatus && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Note Status</label>
                          <div className="mt-1">
                            <span className={`
                              inline-block px-3 py-1.5 text-sm font-medium rounded-full
                              ${selectedTicket.noteStatus === 'Quotation Sent' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' :
                                selectedTicket.noteStatus === 'Material Complete' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                selectedTicket.noteStatus === 'Material Not Complete' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}
                            `}>
                              {selectedTicket.noteStatus}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Section */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Set Event Date Section */}
                    <div className="relative flex-1">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowDatePopup(!showDatePopup)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-opacity-90 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Set Event Date
                      </motion.button>

                      {/* Responsive Popup */}
                      <AnimatePresence>
                        {showDatePopup && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-96 md:w-[28rem] z-50 bg-white dark:bg-boxdark rounded-xl shadow-2xl border border-gray-200 dark:border-strokedark p-6 max-h-[80vh] overflow-y-auto"
                          >
                            {/* Close button */}
                            <button
                              onClick={() => setShowDatePopup(false)}
                              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>

                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                              Set Event Date
                            </h3>

                            {/* Team Selection */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Select Team
                              </label>
                              <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                              >
                                <option value="">Select a team</option>
                                {teams.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Calendar */}
                            <div className="mb-4 flex justify-center">
                              <Calendar
                                onChange={(value) => {
                                  if (value instanceof Date) {
                                    setSelectedDate(value);
                                  } else if (Array.isArray(value) && value[0] instanceof Date) {
                                    setSelectedDate(value[0]);
                                  }
                                }}
                                value={selectedDate}
                                className="rounded-lg border-0 shadow-sm"
                                minDate={new Date()}
                              />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => setShowDatePopup(false)}
                                className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveEventDate}
                                disabled={!selectedTeam || !selectedDate}
                                className="flex-1 rounded-lg bg-primary py-2.5 px-4 font-medium text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                Save Event
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Edit Status & Severity Section */}
                    <div className="relative flex-1">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowStatusPopup(!showStatusPopup)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-meta-3 px-6 py-3 text-white font-medium hover:bg-opacity-90 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Status & Severity
                      </motion.button>

                      {/* Responsive Popup */}
                      <AnimatePresence>
                        {showStatusPopup && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-96 z-50 bg-white dark:bg-boxdark rounded-xl shadow-2xl border border-gray-200 dark:border-strokedark p-6"
                          >
                            {/* Close button */}
                            <button
                              onClick={() => setShowStatusPopup(false)}
                              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>

                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                              Edit Status & Severity
                            </h3>

                            {/* Status Selection */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Status
                              </label>
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                              >
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Resolved">Resolved</option>
                              </select>
                            </div>

                            {/* Severity Selection */}
                            <div className="mb-6">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Severity
                              </label>
                              <select
                                value={editSeverity}
                                onChange={(e) => setEditSeverity(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                              </select>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => setShowStatusPopup(false)}
                                className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveStatusAndSeverity}
                                disabled={!editStatus || !editSeverity}
                                className="flex-1 rounded-lg bg-meta-3 py-2.5 px-4 font-medium text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                Save Changes
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
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
                  <svg className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select a Ticket</h3>
                  <p className="text-gray-500 dark:text-gray-400">Click on a ticket from the list to view its details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-green-500';
    default:
      return 'text-black dark:text-white';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'open':
      return 'bg-blue-100 text-blue-800';
    case 'in progress':
      return 'bg-purple-100 text-purple-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default FullTicketList;
