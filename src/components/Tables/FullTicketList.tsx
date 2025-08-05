import React, { useState, useEffect, useMemo } from 'react';
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
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAuth } from 'firebase/auth';
import TicketDetailsModal from '../Modals/TicketDetailsModal';
import NewTicketModal from '../Modals/NewTicketModal';
import PDFGeneratorModal from '../Modals/PDFGeneratorModal';
import SetDateModal from '../Modals/SetDateModal';
import { useLanguage } from '../../contexts/LanguageContext';

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
}

interface FilterOptions {
  startDate: string;
  endDate: string;
  company: string;
  severity: string;
  status: string;
  location: string;
}

const FullTicketList = () => {
  const [tickets, setTickets] = useState<FullTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<FullTicket | null>(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [showSetDateModal, setShowSetDateModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: '',
    endDate: '',
    company: '',
    severity: '',
    status: '',
    location: '',
  });
  const [companies, setCompanies] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isResponsibleEngineer, setIsResponsibleEngineer] = useState(false);
  const [isEngineer, setIsEngineer] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const auth = getAuth();
  const { t } = useLanguage();

  // Handle checkbox selection
  const handleTicketSelect = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectedTickets.size === filteredTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(filteredTickets.map(ticket => ticket.id)));
    }
  };

  // Handle group event creation
  const handleCreateGroupEvent = () => {
    if (selectedTickets.size > 0) {
      setShowSetDateModal(true);
    }
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

  // Filter tickets based on current filters
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
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
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      {showNewTicketModal && (
        <NewTicketModal onClose={() => setShowNewTicketModal(false)} />
      )}

      {showPDFModal && (
        <PDFGeneratorModal
          onClose={() => setShowPDFModal(false)}
        />
      )}
      {showSetDateModal && (
        <SetDateModal
          isOpen={showSetDateModal}
          onClose={() => {
            setShowSetDateModal(false);
            setSelectedTickets(new Set()); // Clear selection after creating event
          }}
          tickets={filteredTickets.filter(ticket => selectedTickets.has(ticket.id))}
        />
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-title-md2 font-semibold text-black dark:text-white">
          {t('tickets.title')}
        </h2>
        <div className="flex gap-2">
          {selectedTickets.size > 0 && (
            <button
              onClick={handleCreateGroupEvent}
              className="inline-flex items-center justify-center rounded-md bg-green-600 py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 lg:px-6 xl:px-8"
            >
              Create Group Event ({selectedTickets.size})
            </button>
          )}
          {(isAdmin || isEngineer) && (
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 lg:px-6 xl:px-8"
            >
              {t('tickets.createTicket')}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowPDFModal(true)}
              className="inline-flex items-center justify-center rounded-md bg-secondary py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 lg:px-6 xl:px-8"
            >
              {t('tickets.generatePDF')}
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="mb-2.5 block text-black dark:text-white">
            {t('tickets.filters.startDate')}
          </label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">
            {t('tickets.filters.endDate')}
          </label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">
            {t('tickets.filters.company')}
          </label>
          <select
            name="company"
            value={filters.company}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {companies.map((company, index) => (
              <option key={company || `company-${index}`} value={company}>
                {company}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">
            {t('tickets.filters.severity')}
          </label>
          <select
            name="severity"
            value={filters.severity}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {severityOptions.map((severity, index) => (
              <option key={severity || `severity-${index}`} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">
            {t('tickets.filters.status')}
          </label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {statusOptions.map((status, index) => (
              <option key={status || `status-${index}`} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">
            {t('tickets.filters.location')}
          </label>
          <select
            name="location"
            value={filters.location}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {locations.map((location, index) => (
              <option key={location || `location-${index}`} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={clearFilters}
          className="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:bg-opacity-90 dark:border-strokedark dark:text-white"
        >
          {t('tickets.filters.clearFilters')}
        </button>
      </div>

      {/* Ticket Table */}
      <div className="max-w-full overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-2 text-left dark:bg-meta-4">
              <th className="py-4 px-4 font-medium text-black dark:text-white">
                <input
                  type="checkbox"
                  checked={selectedTickets.size === filteredTickets.length && filteredTickets.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </th>
              <th className="min-w-[220px] py-4 px-4 font-medium text-black dark:text-white xl:pl-11">
                {t('tickets.table.title')}
              </th>
              <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                {t('tickets.table.company')}
              </th>
              <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                {t('tickets.table.location')}
              </th>
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                {t('tickets.table.created')}
              </th>
              <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                {t('tickets.table.timeElapsed')}
              </th>
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                {t('tickets.table.severity')}
              </th>
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                {t('tickets.table.status')}
              </th>
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                {t('tickets.table.dateStatus')}
              </th>
              {isEngineer && (
                <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                  Note Status
                </th>
              )}
              {isResponsibleEngineer && (
                <th className="min-w-[180px] py-4 px-4 font-medium text-black dark:text-white whitespace-nowrap">
                  {t('tickets.table.assignedTo')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((ticket, key) => (
              <tr
                key={key}
                className={`hover:bg-gray-50 dark:hover:bg-meta-4 ${
                  selectedTickets.has(ticket.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                  <input
                    type="checkbox"
                    checked={selectedTickets.has(ticket.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleTicketSelect(ticket.id);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11 cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  {ticket.readableId === 'Unknown' ? (
                    <p 
                      className="font-medium text-meta-5 cursor-pointer hover:text-primary hover:underline"
                      onClick={(e) => handleGenerateTicketId(e, ticket)}
                    >
                      {generatingId === ticket.id ? (
                        <span className="flex items-center">
                          <span className="animate-spin h-3 w-3 mr-1 border-t-2 border-b-2 border-primary rounded-full"></span>
                          Generating...
                        </span>
                      ) : (
                        'Unknown (click to generate)'
                      )}
                    </p>
                  ) : (
                    <p className="font-medium text-meta-5">{ticket.readableId}</p>
                  )}
                </td>
                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                  <h5 className="font-medium text-black dark:text-white flex items-center">
                    {ticket.title}
                    <div className="flex gap-2 ml-2">
                      {!ticket.isViewed && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-primary"></span>
                      )}
                      {ticket.hasUnreadMessages && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-meta-1"></span>
                      )}
                    </div>
                  </h5>
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <p className="text-black dark:text-white">{ticket.company}</p>
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <p className="text-black dark:text-white">{ticket.location}</p>
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <p className="text-black dark:text-white">
                    {ticket.createdAt?.toDate().toLocaleDateString()}
                  </p>
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <p className="text-black dark:text-white">
                    {getTimeElapsed(ticket.createdAt)}
                  </p>
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <p
                    className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${getSeverityColor(
                      ticket.severity,
                    )}`}
                  >
                    {t(`tickets.severity.${ticket.severity.toLowerCase()}`)}
                  </p>
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <p
                    className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${getStatusColor(
                      ticket.status,
                    )}`}
                  >
                    {t(`tickets.status.${ticket.status.toLowerCase().replace(' ', '')}`)}
                  </p>
                </td>
                <td 
                  className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <p
                    className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${
                      ticket.isDateSet
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {ticket.isDateSet
                      ? t('tickets.table.dateSet')
                      : t('tickets.table.dateNotSet')}
                  </p>
                </td>
                {isEngineer && (
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    {ticket.noteStatus ? (
                      <p
                        className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${
                          ticket.noteStatus === 'Quotation Sent' ? 'bg-teal-100 text-teal-800' :
                          ticket.noteStatus === 'Material Not Complete' ? 'bg-yellow-100 text-yellow-800' :
                          ticket.noteStatus === 'Material Complete' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {ticket.noteStatus}
                      </p>
                    ) : (
                      <p className="text-gray-500 italic">Not set</p>
                    )}
                  </td>
                )}
                {isResponsibleEngineer && (
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <p className="text-black dark:text-white">
                      {ticket.responsible_engineer || t('tickets.table.unassigned')}
                    </p>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
