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
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { getAuth } from 'firebase/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { generate } from '@pdfme/generator';
import { text, line, table, svg, multiVariableText, image } from '@pdfme/schemas';
import ticketReportTemplate from '../../assets/docs/template.json';

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

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
  isAdmin: boolean;
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
  const [showNoteStatusPopup, setShowNoteStatusPopup] = useState(false);
  const [editNoteStatus, setEditNoteStatus] = useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfParams, setPdfParams] = useState({
    engineer: '',
    startDate: '',
    endDate: '',
    status: '',
    severity: '',
  });
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [engineers, setEngineers] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [showGroupDatePopup, setShowGroupDatePopup] = useState(false);
  const [newTicketData, setNewTicketData] = useState({
    subject: '',
    sender: '',
    company: '',
    city: '',
    severity: 'Low',
    contractCode: '',
    contractNumber: '',
    branchLocation: '',
    issueDescription: '',
    attachment: null as File | null,
  });
  const auth = getAuth();
  const { t } = useLanguage();

  // Generate ticket ID from company name
  const generateTicketId = (company: string) => {
    const companyPrefix = company
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4) || 'TKT';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear().toString().slice(-2);
    return `${companyPrefix}-${year}${randomNum}`;
  };

  // Handle create ticket submission
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingTicket) return;

    try {
      setCreatingTicket(true);
      const user = auth.currentUser;
      if (!user) {
        console.error('No user logged in');
        return;
      }

      const ticketId = generateTicketId(newTicketData.company);

      let attachmentUrl = '';
      if (newTicketData.attachment) {
        const storageRef = ref(storage, `tickets/${ticketId}/${newTicketData.attachment.name}`);
        await uploadBytes(storageRef, newTicketData.attachment);
        attachmentUrl = await getDownloadURL(storageRef);
      }

      const newTicket = {
        title: newTicketData.subject,
        sender: newTicketData.sender,
        company: newTicketData.company,
        location: newTicketData.city,
        severity: newTicketData.severity,
        contractCode: newTicketData.contractCode,
        projectNumber: newTicketData.contractNumber,
        branch: newTicketData.branchLocation,
        ticketDetails: newTicketData.issueDescription,
        attachmentUrl: attachmentUrl,
        status: 'Open',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        ticketId: ticketId,
        isDateSet: false,
        isViewed: false,
        responsible_engineer: isEngineer ? userEmail : '',
      };

      await addDoc(collection(db, 'tickets'), newTicket);

      // Reset form and close modal
      setNewTicketData({
        subject: '',
        sender: '',
        company: '',
        city: '',
        severity: 'Low',
        contractCode: '',
        contractNumber: '',
        branchLocation: '',
        issueDescription: '',
        attachment: null,
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket. Please try again.');
    } finally {
      setCreatingTicket(false);
    }
  };

  // Handle ticket selection
  const handleSelectTicket = async (ticket: FullTicket) => {
    // Toggle selection
    if (selectedTicket?.id === ticket.id) {
      setSelectedTicket(null);
      return;
    }
    
    setSelectedTicket(ticket);
    
    // Mark ticket as viewed in Firestore if not already viewed
    if (!ticket.isViewed) {
      try {
        const ticketRef = doc(db, 'tickets', ticket.id);
        await updateDoc(ticketRef, {
          isViewed: true
        });
        
        // Update local state to reflect the change
        setTickets(prevTickets =>
          prevTickets.map(t =>
            t.id === ticket.id ? { ...t, isViewed: true } : t
          )
        );
      } catch (error) {
        console.error('Error marking ticket as viewed:', error);
      }
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

  // Generate a ticket ID from ticket's company name
  const generateTicketIdFromTicket = (ticket: FullTicket) => {
    return generateTicketId(ticket.company || 'Unknown');
  };

  // Handle click on Unknown ticket ID to generate a new readable ID
  const handleGenerateTicketId = async (e: React.MouseEvent, ticket: FullTicket) => {
    e.stopPropagation(); // Prevent opening the ticket details modal
    
    if (ticket.readableId !== 'Unknown' || generatingId === ticket.id) {
      return; // Already has an ID or is currently generating
    }
    
    try {
      setGeneratingId(ticket.id);
      const newTicketId = generateTicketIdFromTicket(ticket);
      
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

  // Fetch engineers for PDF filter
  useEffect(() => {
    const fetchEngineers = async () => {
      const uniqueEngineers = [...new Set(tickets.map(t => t.responsible_engineer).filter(Boolean))];
      setEngineers(uniqueEngineers as string[]);
    };
    fetchEngineers();
  }, [tickets]);

  // Generate PDF report
  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      // Filter tickets based on PDF params
      let filteredForPdf = [...tickets];
      
      if (pdfParams.engineer) {
        filteredForPdf = filteredForPdf.filter(t => t.responsible_engineer === pdfParams.engineer);
      }
      if (pdfParams.status) {
        filteredForPdf = filteredForPdf.filter(t => t.status === pdfParams.status);
      }
      if (pdfParams.severity) {
        filteredForPdf = filteredForPdf.filter(t => t.severity === pdfParams.severity);
      }
      if (pdfParams.startDate) {
        const startDate = new Date(pdfParams.startDate);
        filteredForPdf = filteredForPdf.filter(t => {
          if (!t.createdAt) return false;
          return t.createdAt.toDate() >= startDate;
        });
      }
      if (pdfParams.endDate) {
        const endDate = new Date(pdfParams.endDate);
        endDate.setHours(23, 59, 59, 999);
        filteredForPdf = filteredForPdf.filter(t => {
          if (!t.createdAt) return false;
          return t.createdAt.toDate() <= endDate;
        });
      }

      // Build filter range data for the template
      // Columns: Filter Type, Value
      const filterRangeData = [
        ['Date Range', pdfParams.startDate && pdfParams.endDate 
          ? `${new Date(pdfParams.startDate).toLocaleDateString()} - ${new Date(pdfParams.endDate).toLocaleDateString()}`
          : pdfParams.startDate 
            ? `From ${new Date(pdfParams.startDate).toLocaleDateString()}`
            : pdfParams.endDate
              ? `Until ${new Date(pdfParams.endDate).toLocaleDateString()}`
              : 'All Dates'],
        ['Engineer', pdfParams.engineer || 'All Engineers'],
        ['Status', pdfParams.status || 'All Statuses'],
        ['Severity', pdfParams.severity || 'All Severities'],
        ['Total Tickets', filteredForPdf.length.toString()]
      ];

      // Prepare ticket table data for the template
      // Columns: Ticket ID, Company, Created, Status, Severity, Engineer
      const ticketTableData = filteredForPdf.map(ticket => {
        const createdDate = ticket.createdAt?.toDate?.() 
          ? ticket.createdAt.toDate().toLocaleDateString() 
          : 'N/A';
        return [
          ticket.readableId || ticket.id.slice(0, 8),
          ticket.company || 'N/A',
          createdDate,
          ticket.status || 'N/A',
          ticket.severity || 'N/A',
          ticket.responsible_engineer || 'Unassigned'
        ];
      });

      // Create inputs matching the template field names
      // Include text fields (field1, field4, field6) and table fields (filter_range, ticket_table)
      const inputs = [{
        field1: 'Filter Information',
        field4: 'Ticket Table',
        field6: 'Ticket Report',
        filter_range: JSON.stringify(filterRangeData),
        ticket_table: JSON.stringify(ticketTableData.length > 0 ? ticketTableData : [['No tickets', '-', '-', '-', '-', '-']])
      }];

      // Clone the template (headers are already set in template.json)
      const template = JSON.parse(JSON.stringify(ticketReportTemplate));
      
      // Update filter_range table headers
      const filterRangeSchema = template.schemas[0].find((s: any) => s.name === 'filter_range');
      if (filterRangeSchema) {
        filterRangeSchema.head = ['Filter', 'Value'];
        filterRangeSchema.headWidthPercentages = [40, 60];
      }

      const plugins = { text, line, table, svg, multiVariableText, image };

      const pdf = await generate({
        template,
        inputs,
        plugins,
      });

      // Download the PDF
      const blob = new Blob([pdf.buffer as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      setShowPdfModal(false);
      setPdfParams({ engineer: '', startDate: '', endDate: '', status: '', severity: '' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Initialize edit values when ticket is selected
  useEffect(() => {
    if (selectedTicket) {
      setEditStatus(selectedTicket.status);
      setEditSeverity(selectedTicket.severity);
    }
  }, [selectedTicket]);

  // Keep selectedTicket in sync with tickets array when it updates
  useEffect(() => {
    if (selectedTicket) {
      const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
      if (updatedTicket && JSON.stringify(updatedTicket) !== JSON.stringify(selectedTicket)) {
        setSelectedTicket(updatedTicket);
      }
    }
  }, [tickets]);

  // Listen to messages for the selected ticket
  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(db, 'tickets', selectedTicket.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(messageData);
    });

    return () => unsubscribe();
  }, [selectedTicket?.id]);

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket || sendingMessage) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('No user logged in to send message');
      return;
    }

    try {
      setSendingMessage(true);
      const messagesRef = collection(db, 'tickets', selectedTicket.id, 'messages');
      await addDoc(messagesRef, {
        text: newMessage,
        sender: currentUser.email || 'Unknown User',
        isAdmin: !isEngineer,
        timestamp: serverTimestamp(),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle save event date (single ticket)
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

  // Handle save group event date (multiple tickets)
  const handleSaveGroupEventDate = async () => {
    if (!selectedDate || !selectedTeam || selectedTicketIds.size === 0) return;

    const selectedTeamData = teams.find(team => team.id === selectedTeam);
    if (!selectedTeamData) return;

    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 1);

    // Get selected tickets data
    const selectedTicketsData = tickets.filter(t => selectedTicketIds.has(t.id));
    const companies = [...new Set(selectedTicketsData.map(t => t.company))].join(', ');
    const locations = [...new Set(selectedTicketsData.map(t => t.location))].join(', ');

    try {
      const eventData = {
        title: `Group Event (${selectedTicketsData.length} tickets)`,
        startDate: selectedDate,
        endDate: endDate,
        teamName: selectedTeamData.name || 'Unknown Team',
        projectName: companies || 'Multiple Projects',
        projectManager: selectedTeamData.projectManager || 'Unassigned',
        leadEngineer: selectedTeamData.leadEngineer || 'Unassigned',
        location: locations || 'Multiple Locations',
        ticketIds: Array.from(selectedTicketIds),
        ticketCount: selectedTicketsData.length,
        event_type: 'group',
        responsibleEngineer: userEmail || '',
        supervisorEmail: selectedTeamData.supervisorEmail || '',
        createdAt: new Date(),
        tickets: selectedTicketsData.map(t => ({
          id: t.id,
          title: t.title,
          company: t.company,
          location: t.location,
          severity: t.severity,
          status: t.status,
          noteStatus: t.noteStatus
        }))
      };

      await addDoc(collection(db, 'events'), eventData);

      // Update all selected tickets
      for (const ticketId of selectedTicketIds) {
        const ticketRef = doc(db, 'tickets', ticketId);
        const ticket = tickets.find(t => t.id === ticketId);
        const updateData: any = {
          date: selectedDate,
          isDateSet: true,
          supervisor_email: selectedTeamData.supervisorEmail || ''
        };
        
        if (ticket && !(ticket as any).transfer_engineer) {
          updateData.responsible_engineer = userEmail || '';
        }
        
        await updateDoc(ticketRef, updateData);
      }

      setShowGroupDatePopup(false);
      setSelectedTeam('');
      setSelectedDate(new Date());
      setSelectedTicketIds(new Set());
    } catch (error) {
      console.error('Error creating group event:', error);
    }
  };

  // Toggle ticket selection
  const toggleTicketSelection = (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTicketIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  // Select all tickets
  const handleSelectAll = () => {
    if (selectedTicketIds.size === filteredTickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)));
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

  // Handle save note status
  const handleSaveNoteStatus = async () => {
    if (!selectedTicket || !editNoteStatus) return;

    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      await updateDoc(ticketRef, {
        noteStatus: editNoteStatus,
      });

      setShowNoteStatusPopup(false);
    } catch (error) {
      console.error('Error updating ticket note status:', error);
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Select All Checkbox */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSelectAll}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selectedTicketIds.size === filteredTickets.length && filteredTickets.length > 0
                      ? 'bg-primary border-primary'
                      : selectedTicketIds.size > 0
                        ? 'bg-primary/50 border-primary'
                        : 'border-gray-300 dark:border-gray-600'
                  }`}
                  title={selectedTicketIds.size === filteredTickets.length ? 'Deselect All' : 'Select All'}
                >
                  {selectedTicketIds.size > 0 && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </motion.button>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  All Tickets ({filteredTickets.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Create Group Event Button - Shows when tickets selected */}
                <AnimatePresence>
                  {selectedTicketIds.size > 1 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowGroupDatePopup(true)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Group ({selectedTicketIds.size})
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Create Ticket Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateModal(true)}
                  className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  title="Create New Ticket"
                >
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </motion.button>

                {/* PDF Report Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPdfModal(true)}
                  className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  title="Generate PDF Report"
                >
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9h1m-1 4h6m-6 4h6" />
                  </svg>
                </motion.button>

                {/* Filter Button */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={`p-2 rounded-lg transition-colors relative ${
                      filters.company || filters.status || filters.severity || filters.location
                        ? 'bg-primary/20 hover:bg-primary/30'
                        : 'bg-gray-100 dark:bg-meta-4 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <svg className={`w-5 h-5 ${
                      filters.company || filters.status || filters.severity || filters.location
                        ? 'text-primary'
                        : 'text-gray-600 dark:text-gray-300'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {(filters.company || filters.status || filters.severity || filters.location) && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></span>
                    )}
                  </motion.button>
                
                <AnimatePresence>
                  {showFilterDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 bg-white dark:bg-boxdark rounded-lg shadow-lg border border-gray-200 dark:border-strokedark z-50 overflow-hidden max-h-[70vh] overflow-y-auto"
                    >
                      <div className="p-3 space-y-4">
                        {/* Sort Section */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-2">
                            Sort by Date
                          </p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setFilters(prev => ({ ...prev, sort: 'newest' }))}
                              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                filters.sort === 'newest'
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              Newest
                            </button>
                            <button
                              onClick={() => setFilters(prev => ({ ...prev, sort: 'oldest' }))}
                              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                filters.sort === 'oldest'
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              Oldest
                            </button>
                          </div>
                        </div>

                        {/* Company Filter */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">
                            Company
                          </label>
                          <select
                            value={filters.company}
                            onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="">All Companies</option>
                            {companies.filter(c => c !== 'All').map((company) => (
                              <option key={company} value={company}>{company}</option>
                            ))}
                          </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">
                            Status
                          </label>
                          <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </div>

                        {/* Severity Filter */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">
                            Severity
                          </label>
                          <select
                            value={filters.severity}
                            onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="">All Severities</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>

                        {/* Location Filter */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">
                            Location
                          </label>
                          <select
                            value={filters.location}
                            onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="">All Locations</option>
                            {locations.filter(l => l !== 'All').map((location) => (
                              <option key={location} value={location}>{location}</option>
                            ))}
                          </select>
                        </div>

                        {/* Clear Filters Button */}
                        {(filters.company || filters.status || filters.severity || filters.location) && (
                          <button
                            onClick={() => {
                              setFilters(prev => ({
                                ...prev,
                                company: '',
                                status: '',
                                severity: '',
                                location: ''
                              }));
                            }}
                            className="w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
              </div>
            </div>
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
                      ${selectedTicketIds.has(ticket.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : selectedTicket?.id === ticket.id 
                          ? 'bg-primary/10 border-l-4 border-l-primary' 
                          : 'hover:bg-gray-50 dark:hover:bg-meta-4'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox for multi-select */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => toggleTicketSelection(ticket.id, e)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          selectedTicketIds.has(ticket.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {selectedTicketIds.has(ticket.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </motion.button>
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
                      {selectedTicket.noteStatus && (
                        <span className={`
                          px-3 py-1 text-sm font-medium rounded-full
                          ${selectedTicket.noteStatus === 'Quotation Sent' ? 'bg-purple-100 text-purple-800' :
                            selectedTicket.noteStatus === 'Material Not Complete' ? 'bg-red-100 text-red-800' :
                            selectedTicket.noteStatus === 'Under review' ? 'bg-cyan-100 text-cyan-800' :
                            'bg-gray-100 text-gray-800'}
                        `}>
                          {selectedTicket.noteStatus}
                        </span>
                      )}
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
                  <div className="space-y-4">
                    {/* Action Buttons Row */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Set Event Date Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowDatePopup(!showDatePopup);
                          setShowStatusPopup(false);
                          setShowNoteStatusPopup(false);
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-all ${
                          showDatePopup
                            ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 dark:ring-offset-boxdark'
                            : 'bg-primary text-white hover:bg-opacity-90'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">Set Event Date</span>
                        <span className="sm:hidden">Date</span>
                        <motion.svg
                          animate={{ rotate: showDatePopup ? 180 : 0 }}
                          className="w-4 h-4 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </motion.svg>
                      </motion.button>

                      {/* Edit Status & Severity Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowStatusPopup(!showStatusPopup);
                          setShowDatePopup(false);
                          setShowNoteStatusPopup(false);
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-all ${
                          showStatusPopup
                            ? 'bg-meta-3 text-white ring-2 ring-meta-3 ring-offset-2 dark:ring-offset-boxdark'
                            : 'bg-meta-3 text-white hover:bg-opacity-90'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="hidden sm:inline">Edit Status & Severity</span>
                        <span className="sm:hidden">Status</span>
                        <motion.svg
                          animate={{ rotate: showStatusPopup ? 180 : 0 }}
                          className="w-4 h-4 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </motion.svg>
                      </motion.button>

                      {/* Edit Note Status Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (!showNoteStatusPopup && selectedTicket) {
                            setEditNoteStatus(selectedTicket.noteStatus || '');
                          }
                          setShowNoteStatusPopup(!showNoteStatusPopup);
                          setShowDatePopup(false);
                          setShowStatusPopup(false);
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-all ${
                          showNoteStatusPopup
                            ? 'bg-meta-5 text-white ring-2 ring-meta-5 ring-offset-2 dark:ring-offset-boxdark'
                            : 'bg-meta-5 text-white hover:bg-opacity-90'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="hidden sm:inline">Edit Note Status</span>
                        <span className="sm:hidden">Note</span>
                        <motion.svg
                          animate={{ rotate: showNoteStatusPopup ? 180 : 0 }}
                          className="w-4 h-4 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </motion.svg>
                      </motion.button>
                    </div>

                    {/* Expandable Sections */}
                    <AnimatePresence mode="wait">
                      {/* Set Event Date Section */}
                      {showDatePopup && (
                        <motion.div
                          key="date-section"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-blue-50 dark:bg-meta-4 rounded-xl p-5 border border-primary/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Set Event Date
                              </h3>
                              <button
                                onClick={() => setShowDatePopup(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

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
                                className="rounded-lg border-0 shadow-sm w-full max-w-sm"
                                minDate={new Date()}
                              />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => setShowDatePopup(false)}
                                className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-boxdark transition-all"
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
                          </div>
                        </motion.div>
                      )}

                      {/* Edit Status & Severity Section */}
                      {showStatusPopup && (
                        <motion.div
                          key="status-section"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-green-50 dark:bg-meta-4 rounded-xl p-5 border border-meta-3/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-meta-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Status & Severity
                              </h3>
                              <button
                                onClick={() => setShowStatusPopup(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                              {/* Status Selection */}
                              <div>
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
                              <div>
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
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => setShowStatusPopup(false)}
                                className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-boxdark transition-all"
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
                          </div>
                        </motion.div>
                      )}

                      {/* Edit Note Status Section */}
                      {showNoteStatusPopup && (
                        <motion.div
                          key="note-section"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-orange-50 dark:bg-meta-4 rounded-xl p-5 border border-meta-5/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-meta-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Edit Note Status
                              </h3>
                              <button
                                onClick={() => setShowNoteStatusPopup(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            {/* Note Status Selection */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Note Status
                              </label>
                              <select
                                value={editNoteStatus}
                                onChange={(e) => setEditNoteStatus(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                              >
                                <option value="">Select Note Status</option>
                                <option value="Quotation Sent">Quotation Sent</option>
                                <option value="Material Not Complete">Material Not Complete</option>
                                <option value="Under review">Under review</option>
                              </select>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => setShowNoteStatusPopup(false)}
                                className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-boxdark transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveNoteStatus}
                                disabled={!editNoteStatus}
                                className="flex-1 rounded-lg bg-meta-5 py-2.5 px-4 font-medium text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Conversation/Chat Section */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gray-50 dark:bg-meta-4 rounded-lg p-5 mt-8"
                  >
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Conversation
                    </h3>

                    {/* Messages Container */}
                    <div className="bg-white dark:bg-boxdark rounded-lg p-4 max-h-[300px] overflow-y-auto mb-4 space-y-3">
                      {messages.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <p className="text-sm">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        messages.map((message) => {
                          const isCurrentUserSender = message.sender === userEmail;
                          return (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${isCurrentUserSender ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg p-3 ${
                                  isCurrentUserSender
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 dark:bg-meta-4 text-gray-900 dark:text-white'
                                }`}
                              >
                                <div className={`text-xs font-medium mb-1 ${isCurrentUserSender ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                  {message.sender} • {message.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}
                                </div>
                                <div className="text-sm">{message.text}</div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input text-gray-900 dark:text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <motion.button
                        type="submit"
                        disabled={sendingMessage || !newMessage.trim()}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {sendingMessage ? (
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                        <span className="hidden sm:inline">Send</span>
                      </motion.button>
                    </form>
                  </motion.div>
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

      {/* PDF Report Modal */}
      <AnimatePresence>
        {showPdfModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
            onClick={() => setShowPdfModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-boxdark rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Generate PDF Report
                </h3>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Engineer Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Responsible Engineer
                  </label>
                  <select
                    value={pdfParams.engineer}
                    onChange={(e) => setPdfParams(prev => ({ ...prev, engineer: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                  >
                    <option value="">All Engineers</option>
                    {engineers.map((engineer) => (
                      <option key={engineer} value={engineer}>{engineer}</option>
                    ))}
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={pdfParams.startDate}
                      onChange={(e) => setPdfParams(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={pdfParams.endDate}
                      onChange={(e) => setPdfParams(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={pdfParams.status}
                    onChange={(e) => setPdfParams(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                  >
                    <option value="">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                {/* Severity Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Severity
                  </label>
                  <select
                    value={pdfParams.severity}
                    onChange={(e) => setPdfParams(prev => ({ ...prev, severity: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary"
                  >
                    <option value="">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPdfModal(false);
                    setPdfParams({ engineer: '', startDate: '', endDate: '', status: '', severity: '' });
                  }}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGeneratePdf}
                  disabled={generatingPdf}
                  className="flex-1 rounded-lg bg-red-500 py-2.5 px-4 font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {generatingPdf ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Create Ticket Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-999999 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-boxdark rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-boxdark border-b border-gray-200 dark:border-strokedark px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create New Ticket</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-meta-4 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTicketData.subject}
                    onChange={(e) => setNewTicketData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                    placeholder="Enter ticket subject"
                    required
                  />
                </div>

                {/* Sender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sender Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newTicketData.sender}
                    onChange={(e) => setNewTicketData(prev => ({ ...prev, sender: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                    placeholder="Enter sender email"
                    required
                  />
                </div>

                {/* Company and City */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTicketData.company}
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                      placeholder="Company name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTicketData.city}
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                      placeholder="City"
                      required
                    />
                  </div>
                </div>

                {/* Date and Time (Read-only) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="text"
                      value={new Date().toLocaleDateString()}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-gray-100 dark:bg-meta-4 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time
                    </label>
                    <input
                      type="text"
                      value={new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-gray-100 dark:bg-meta-4 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Severity <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newTicketData.severity}
                    onChange={(e) => setNewTicketData(prev => ({ ...prev, severity: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                    required
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                {/* Contract Code and Contract Number */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contract Code
                    </label>
                    <input
                      type="text"
                      value={newTicketData.contractCode}
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, contractCode: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                      placeholder="Contract code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contract Number
                    </label>
                    <input
                      type="text"
                      value={newTicketData.contractNumber}
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, contractNumber: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                      placeholder="Contract number"
                    />
                  </div>
                </div>

                {/* Branch Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Branch Location
                  </label>
                  <input
                    type="text"
                    value={newTicketData.branchLocation}
                    onChange={(e) => setNewTicketData(prev => ({ ...prev, branchLocation: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                    placeholder="Branch location"
                  />
                </div>

                {/* Issue Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Issue Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newTicketData.issueDescription}
                    onChange={(e) => setNewTicketData(prev => ({ ...prev, issueDescription: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all resize-none"
                    rows={4}
                    placeholder="Describe the issue in detail"
                    required
                  />
                </div>

                {/* Attachment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Attachment
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, attachment: e.target.files?.[0] || null }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-white file:cursor-pointer"
                    />
                    {newTicketData.attachment && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {newTicketData.attachment.name}
                        <button
                          type="button"
                          onClick={() => setNewTicketData(prev => ({ ...prev, attachment: null }))}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-strokedark">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTicket}
                    className="flex-1 rounded-lg bg-primary py-2.5 px-4 font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {creatingTicket ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Create Ticket
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Group Event Modal */}
        {showGroupDatePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
            onClick={() => setShowGroupDatePopup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-boxdark rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Create Group Event
                </h3>
                <button
                  onClick={() => setShowGroupDatePopup(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Selected Tickets Summary */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  {selectedTicketIds.size} tickets selected
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {tickets.filter(t => selectedTicketIds.has(t.id)).map(ticket => (
                    <div key={ticket.id} className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span className="truncate">{ticket.title}</span>
                      <span className="text-blue-500">({ticket.company})</span>
                    </div>
                  ))}
                </div>
              </div>

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
              <div className="mb-6 flex justify-center">
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
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowGroupDatePopup(false);
                    setSelectedTicketIds(new Set());
                  }}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroupEventDate}
                  disabled={!selectedTeam || !selectedDate}
                  className="flex-1 rounded-lg bg-blue-500 py-2.5 px-4 font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Create Group Event
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
