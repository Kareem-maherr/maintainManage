import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  where,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import { generate } from '@pdfme/generator';
import { text, line, table, svg, multiVariableText, image } from '@pdfme/schemas';
import eventReportTemplate from '../assets/docs/ticket_report.json';

interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  teamName: string;
  projectId: string;
  projectName: string;
  projectManager?: string;
  location?: string;
  responsibleEngineer?: string;
  status?: string;
  reportUrl?: string;
  resolvedAt?: any;
  resolvedBy?: string;
  resolved?: boolean;
  event_type?: 'single' | 'group';
  tickets?: {
    id: string;
    title: string;
    company: string;
    location: string;
    severity: string;
    status: string;
    noteStatus?: string;
    reportUrl?: string;
  }[];
  ticketIds?: string[];
  ticketCount?: number;
  supervisorEmail?: string;
  leadEngineer?: string;
  email?: string;
  phone?: string;
  teamMembers?: { name: string }[];
  ticketId?: string;
}

interface FilterOptions {
  status: string;
  engineer: string;
  location: string;
  eventType: string;
  sort: string;
}

const statusColors: { [key: string]: string } = {
  'Resolved': 'bg-green-100 text-green-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Quotation Sent': 'bg-yellow-100 text-yellow-800',
  'Material Not Complete': 'bg-orange-100 text-orange-800',
  'No status': 'bg-gray-100 text-gray-600',
};

const CalendarTickets = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: '',
    engineer: '',
    location: '',
    eventType: '',
    sort: 'newest',
  });
  const [pdfParams, setPdfParams] = useState({
    engineer: '',
    startDate: '',
    endDate: '',
    status: '',
  });
  const auth = getAuth();

  const uniqueEngineers = useMemo(() => {
    return [...new Set(events.map(e => e.responsibleEngineer).filter(Boolean))] as string[];
  }, [events]);

  const uniqueLocations = useMemo(() => {
    return [...new Set(events.map(e => e.location).filter(Boolean))] as string[];
  }, [events]);

  const filteredEvents = useMemo(() => {
    let filtered = events.filter((event) => {
      const matchesStatus = !filters.status || (event.status || 'No status') === filters.status;
      const matchesEngineer = !filters.engineer || event.responsibleEngineer === filters.engineer;
      const matchesLocation = !filters.location || event.location === filters.location;
      const matchesEventType = !filters.eventType || event.event_type === filters.eventType;
      return matchesStatus && matchesEngineer && matchesLocation && matchesEventType;
    });

    return filtered.sort((a, b) => {
      const dateA = a.startDate.getTime();
      const dateB = b.startDate.getTime();
      return filters.sort === 'oldest' ? dateA - dateB : dateB - dateA;
    });
  }, [events, filters]);

  useEffect(() => {
    const fetchUserRoleAndEvents = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db, 'engineers', currentUser.uid));
        const userData = userDoc.data();
        const isAdmin = userData?.role === 'admin';
        const isUserEngineer = userData?.role === 'engineer';

        let eventsQuery;
        if (!isAdmin) {
          if (isUserEngineer && currentUser.email) {
            eventsQuery = query(
              collection(db, 'events'),
              where('responsibleEngineer', '==', currentUser.email),
              orderBy('startDate', 'desc')
            );
          } else {
            setEvents([]);
            setLoading(false);
            return;
          }
        } else {
          eventsQuery = query(collection(db, 'events'), orderBy('startDate', 'desc'));
        }

        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            teamName: data.teamName || '',
            projectId: data.projectId || '',
            projectName: data.projectName || '',
            projectManager: data.projectManager,
            location: data.location,
            responsibleEngineer: data.responsibleEngineer,
            status: data.status || 'No status',
            reportUrl: data.reportUrl,
            resolvedAt: data.resolvedAt,
            resolvedBy: data.resolvedBy,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            event_type: data.event_type,
            tickets: data.tickets,
            ticketIds: data.ticketIds,
            ticketCount: data.ticketCount,
            supervisorEmail: data.supervisorEmail,
            leadEngineer: data.leadEngineer,
            email: data.email || '',
            phone: data.phone || '',
            teamMembers: data.teamMembers,
            resolved: data.resolved,
            ticketId: data.ticketId,
          } as CalendarEvent;
        });
        setEvents(eventsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      }
    };
    fetchUserRoleAndEvents();
  }, [auth.currentUser]);

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const getTimeElapsed = (startDate: Date) => {
    const now = new Date();
    const elapsed = now.getTime() - startDate.getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getDuration = (event: CalendarEvent) => Math.ceil((event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60 * 60 * 24));
  const handleSelectEvent = (event: CalendarEvent) => setSelectedEvent(selectedEvent?.id === event.id ? null : event);
  const hasActiveFilters = filters.status || filters.engineer || filters.location || filters.eventType;
  const clearFilters = () => setFilters({ status: '', engineer: '', location: '', eventType: '', sort: 'newest' });

  const handleResolveEvent = async () => {
    if (!selectedEvent) return;
    try {
      const eventRef = doc(db, 'events', selectedEvent.id);
      await updateDoc(eventRef, { resolved: true, status: 'Resolved' });
      setEvents((prev) => prev.map((e) => e.id === selectedEvent.id ? { ...e, resolved: true, status: 'Resolved' } : e));
      setSelectedEvent({ ...selectedEvent, resolved: true, status: 'Resolved' });
    } catch (error) {
      console.error('Error resolving event:', error);
    }
  };

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      let filteredForPdf = [...events];
      if (pdfParams.engineer) filteredForPdf = filteredForPdf.filter(e => e.responsibleEngineer === pdfParams.engineer);
      if (pdfParams.status) filteredForPdf = filteredForPdf.filter(e => e.status === pdfParams.status);
      if (pdfParams.startDate) {
        const startDate = new Date(pdfParams.startDate);
        filteredForPdf = filteredForPdf.filter(e => e.startDate >= startDate);
      }
      if (pdfParams.endDate) {
        const endDate = new Date(pdfParams.endDate);
        endDate.setHours(23, 59, 59, 999);
        filteredForPdf = filteredForPdf.filter(e => e.startDate <= endDate);
      }

      let dateRangeStr = 'All Dates';
      if (pdfParams.startDate || pdfParams.endDate) {
        const start = pdfParams.startDate ? new Date(pdfParams.startDate).toLocaleDateString() : 'Start';
        const end = pdfParams.endDate ? new Date(pdfParams.endDate).toLocaleDateString() : 'Present';
        dateRangeStr = `${start} - ${end}`;
      }

      const tableData = filteredForPdf.map(event => [
        event.id.slice(0, 8),
        event.title.length > 35 ? event.title.slice(0, 32) + '...' : event.title,
        event.projectName || 'N/A',
        event.responsibleEngineer || 'N/A',
        event.status || 'No status',
        event.startDate.toLocaleDateString()
      ]);

      const inputs = [{
        reportTitle: 'Calendar Events Report',
        reportDate: new Date().toLocaleDateString(),
        filterInfo: JSON.stringify({ engineer: pdfParams.engineer || 'All', status: pdfParams.status || 'All', dateRange: dateRangeStr }),
        ticketsTable: JSON.stringify(tableData.length > 0 ? tableData : [['No events', '-', '-', '-', '-', '-']])
      }];

      const template = { ...eventReportTemplate, schemas: eventReportTemplate.schemas as any, basePdf: eventReportTemplate.basePdf as any };
      const plugins = { text, line, table, svg, multiVariableText, image };
      const pdf = await generate({ template, inputs, plugins });

      const blob = new Blob([pdf.buffer as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `events-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setShowPdfModal(false);
      setPdfParams({ engineer: '', startDate: '', endDate: '', status: '' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Calendar Events" />
      <div className="w-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Calendar Events</h2>
        </motion.div>

        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Events List */}
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="w-1/3 bg-white dark:bg-boxdark rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-strokedark">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Events ({filteredEvents.length})</h3>
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowPdfModal(true)} className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors" title="Generate PDF Report">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </motion.button>
                  <div className="relative">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowFilterDropdown(!showFilterDropdown)} className={`p-2 rounded-lg transition-colors relative ${hasActiveFilters ? 'bg-primary/20 hover:bg-primary/30' : 'bg-gray-100 dark:bg-meta-4 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      <svg className={`w-5 h-5 ${hasActiveFilters ? 'text-primary' : 'text-gray-600 dark:text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      {hasActiveFilters && <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></span>}
                    </motion.button>
                    <AnimatePresence>
                      {showFilterDropdown && (
                        <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className="absolute right-0 mt-2 w-64 bg-white dark:bg-boxdark rounded-lg shadow-lg border border-gray-200 dark:border-strokedark z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                          <div className="p-3 space-y-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-2">Sort by Date</p>
                              <div className="flex gap-1">
                                <button onClick={() => setFilters(prev => ({ ...prev, sort: 'newest' }))} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${filters.sort === 'newest' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-gray-300'}`}>Newest</button>
                                <button onClick={() => setFilters(prev => ({ ...prev, sort: 'oldest' }))} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${filters.sort === 'oldest' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-gray-300'}`}>Oldest</button>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">Status</label>
                              <select value={filters.status} onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))} className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50">
                                <option value="">All Statuses</option>
                                <option value="No status">No Status</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Quotation Sent">Quotation Sent</option>
                                <option value="Material Not Complete">Material Not Complete</option>
                                <option value="Resolved">Resolved</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">Engineer</label>
                              <select value={filters.engineer} onChange={(e) => setFilters(prev => ({ ...prev, engineer: e.target.value }))} className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50">
                                <option value="">All Engineers</option>
                                {uniqueEngineers.map((eng) => <option key={eng} value={eng}>{eng}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">Location</label>
                              <select value={filters.location} onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))} className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50">
                                <option value="">All Locations</option>
                                {uniqueLocations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1 mb-1 block">Event Type</label>
                              <select value={filters.eventType} onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value }))} className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-strokedark bg-white dark:bg-meta-4 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50">
                                <option value="">All Types</option>
                                <option value="single">Single</option>
                                <option value="group">Group</option>
                              </select>
                            </div>
                            {hasActiveFilters && <button onClick={clearFilters} className="w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">Clear Filters</button>}
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
                    <motion.div key={`skeleton-${index}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="border-b border-gray-200 dark:border-strokedark p-4">
                      <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                      <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.1 }} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </motion.div>
                  ))
                ) : filteredEvents.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                    <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-lg font-medium">No events found</p>
                    <p className="text-sm">Schedule an event to see it here</p>
                  </motion.div>
                ) : (
                  filteredEvents.map((event, index) => (
                    <motion.div key={event.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }} onClick={() => handleSelectEvent(event)} className={`border-b border-gray-200 dark:border-strokedark p-4 cursor-pointer transition-all ${selectedEvent?.id === event.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-gray-50 dark:hover:bg-meta-4'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate mb-1 flex items-center gap-2">
                            {event.title}
                            {event.event_type === 'group' && <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Group</span>}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{event.projectName}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(event.startDate)} • {getTimeElapsed(event.startDate)}</p>
                          <div className="flex gap-2 mt-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[event.status || 'No status'] || 'bg-gray-100 text-gray-600'}`}>{event.status || 'No status'}</span>
                            {event.location && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{event.location}</span>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right Panel - Event Details */}
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="flex-1 bg-white dark:bg-boxdark rounded-xl shadow-sm overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedEvent ? (
                <motion.div key={selectedEvent.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="h-full overflow-y-auto p-8">
                  <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6 pb-6 border-b border-gray-200 dark:border-strokedark">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedEvent.title}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedEvent.id.slice(0, 12)}...</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[selectedEvent.status || 'No status'] || 'bg-gray-100 text-gray-600'}`}>{selectedEvent.status || 'No status'}</span>
                        {selectedEvent.event_type === 'group' && <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">Group ({selectedEvent.ticketCount || selectedEvent.tickets?.length || 0})</span>}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-6">
                    {/* Date & Time */}
                    <div className="bg-blue-50 dark:bg-meta-4 rounded-lg p-5">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Date & Time
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Start Date</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{formatDate(selectedEvent.startDate)}</p><p className="text-sm text-gray-500">{formatTime(selectedEvent.startDate)}</p></div>
                        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">End Date</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{formatDate(selectedEvent.endDate)}</p><p className="text-sm text-gray-500">{formatTime(selectedEvent.endDate)}</p></div>
                        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Duration</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{getDuration(selectedEvent)} day(s)</p></div>
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="bg-gray-50 dark:bg-meta-4 rounded-lg p-5">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        Project Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Project Name</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedEvent.projectName || 'N/A'}</p></div>
                        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Location</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedEvent.location || 'Remote'}</p></div>
                        {selectedEvent.projectManager && <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Project Manager</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedEvent.projectManager}</p></div>}
                      </div>
                    </div>

                    {/* Team */}
                    <div className="bg-purple-50 dark:bg-meta-4 rounded-lg p-5">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Team
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Team Name</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedEvent.teamName || 'N/A'}</p></div>
                        <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Responsible Engineer</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedEvent.responsibleEngineer || 'N/A'}</p></div>
                        {selectedEvent.leadEngineer && <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Lead Engineer</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedEvent.leadEngineer}</p></div>}
                        {selectedEvent.supervisorEmail && <div><label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Supervisor</label><p className="text-base font-medium text-gray-900 dark:text-white mt-1">{selectedEvent.supervisorEmail}</p></div>}
                      </div>
                    </div>

                    {/* Tickets (for group events) */}
                    {selectedEvent.event_type === 'group' && selectedEvent.tickets && selectedEvent.tickets.length > 0 && (
                      <div className="bg-green-50 dark:bg-meta-4 rounded-lg p-5">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          Tickets ({selectedEvent.tickets.length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {selectedEvent.tickets.map((ticket, idx) => (
                            <div key={ticket.id || idx} className="bg-white dark:bg-boxdark rounded-lg p-3 border border-gray-200 dark:border-strokedark">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 dark:text-white truncate">{ticket.title}</span>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[ticket.status] || 'bg-gray-100 text-gray-600'}`}>{ticket.status}</span>
                              </div>
                              <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                <span>{ticket.company}</span>
                                <span>•</span>
                                <span>{ticket.location}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Report URL */}
                    {selectedEvent.reportUrl && (
                      <div className="bg-orange-50 dark:bg-meta-4 rounded-lg p-5">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Report
                        </h3>
                        <a href={selectedEvent.reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          View Report
                        </a>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!selectedEvent.resolved && (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleResolveEvent} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-6 py-3 text-white font-medium hover:bg-green-600 transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Mark as Resolved
                      </motion.button>
                    )}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                      <svg className="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </motion.div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select an Event</h3>
                    <p className="text-gray-500 dark:text-gray-400">Click on an event from the list to view its details</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* PDF Report Modal */}
      <AnimatePresence>
        {showPdfModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setShowPdfModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white dark:bg-boxdark rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  Generate PDF Report
                </h3>
                <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsible Engineer</label>
                  <select value={pdfParams.engineer} onChange={(e) => setPdfParams(prev => ({ ...prev, engineer: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary">
                    <option value="">All Engineers</option>
                    {uniqueEngineers.map((eng) => <option key={eng} value={eng}>{eng}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input type="date" value={pdfParams.startDate} onChange={(e) => setPdfParams(prev => ({ ...prev, startDate: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input type="date" value={pdfParams.endDate} onChange={(e) => setPdfParams(prev => ({ ...prev, endDate: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select value={pdfParams.status} onChange={(e) => setPdfParams(prev => ({ ...prev, status: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input py-2.5 px-4 text-gray-900 dark:text-white outline-none transition focus:border-primary">
                    <option value="">All Statuses</option>
                    <option value="No status">No Status</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Quotation Sent">Quotation Sent</option>
                    <option value="Material Not Complete">Material Not Complete</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowPdfModal(false); setPdfParams({ engineer: '', startDate: '', endDate: '', status: '' }); }} className="flex-1 rounded-lg border border-gray-300 dark:border-strokedark py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all">Cancel</button>
                <button onClick={handleGeneratePdf} disabled={generatingPdf} className="flex-1 rounded-lg bg-red-500 py-2.5 px-4 font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                  {generatingPdf ? (
                    <><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</>
                  ) : (
                    <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Generate PDF</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CalendarTickets;
