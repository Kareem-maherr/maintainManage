import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { format } from 'date-fns';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  where, 
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAuth } from 'firebase/auth';

interface TeamMember {
  name: string;
}

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: any;
  isAdmin: boolean;
}

interface ProjectDetails {
  id?: string;
  title: string;
  projectManager: string;
  leadEngineer?: string;
  responsibleEngineer?: string;
  location: string;
  email: string;
  phone: string;
  startDate: Date;
  endDate: Date;
  teamName: string;
  projectName: string;
  teamMembers?: TeamMember[];
  reportUrl?: string;
  status?: string;
  resolved?: boolean;
  resolvedAt?: any;
  resolvedBy?: string;
  ticketId?: string;
  eventId?: string;
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
    reportUploadedAt?: any;
  }[];
  ticketIds?: string[];
  ticketCount?: number;
  lastUpdated?: any;
  supervisorEmail?: string;
}

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ProjectDetails;
}

const EventDetailsModal = ({ isOpen, onClose, event }: EventDetailsModalProps) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConfirmChecked, setIsConfirmChecked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedTicketReport, setSelectedTicketReport] = useState<string | null>(null);
  const [fullEventData, setFullEventData] = useState<any>(null);
  const auth = getAuth();
  
  // Fetch complete event data from Firebase
  useEffect(() => {
    const fetchFullEventData = async () => {
      if (event.id) {
        try {
          const eventDoc = await getDoc(doc(db, 'events', event.id));
          if (eventDoc.exists()) {
            const data = eventDoc.data();
            console.log('Full Firebase event data:', data);
            setFullEventData(data);
          }
        } catch (error) {
          console.error('Error fetching full event data:', error);
        }
      }
    };
    
    fetchFullEventData();
  }, [event.id]);
  
  const handleMarkAsResolved = async () => {
    if (!isConfirmChecked) return;
    
    try {
      setIsUpdating(true);
      const eventRef = doc(db, 'events', event.id || '');
      
      // First update the event status
      await updateDoc(eventRef, {
        status: 'Resolved',
        resolved: true,
        resolvedAt: serverTimestamp(),
        resolvedBy: auth.currentUser?.email || 'System'
      });
      
      // Update local state to reflect the change
      event.status = 'Resolved';
      event.resolved = true;
      
      // Find and update the corresponding ticket
      try {
        // First try to find tickets with eventId field matching this event's ID
        let ticketsQuery = query(
          collection(db, 'tickets'),
          where('eventId', '==', event.id),
          where('status', '!=', 'Resolved') // Only update if not already resolved
        );
        
        let querySnapshot = await getDocs(ticketsQuery);
        
        // If no tickets found with eventId, try using ticketId field from event
        if (querySnapshot.empty && event.ticketId) {
          ticketsQuery = query(
            collection(db, 'tickets'),
            where('ticketId', '==', event.ticketId),
            where('status', '!=', 'Resolved')
          );
          querySnapshot = await getDocs(ticketsQuery);
        }
        
        // If still no tickets found, fall back to projectName matching
        if (querySnapshot.empty && event.projectName) {
          ticketsQuery = query(
            collection(db, 'tickets'),
            where('projectName', '==', event.projectName),
            where('status', '!=', 'Resolved')
          );
          querySnapshot = await getDocs(ticketsQuery);
        }
        
        // Update all matching tickets (though typically there should be only one)
        const updatePromises: Promise<void>[] = [];
        querySnapshot.forEach((ticketDoc) => {
          const ticketRef = doc(db, 'tickets', ticketDoc.id);
          updatePromises.push(
            updateDoc(ticketRef, {
              status: 'Resolved',
              resolved: true,
              resolvedAt: serverTimestamp(),
              resolvedBy: auth.currentUser?.email || 'System',
              updatedAt: serverTimestamp()
            })
          );
        });
        
        await Promise.all(updatePromises);
        
        if (querySnapshot.size > 0) {
          console.log(`Updated ${querySnapshot.size} ticket(s) to Resolved status`);
        } else {
          console.log('No matching tickets found to update');
        }
      } catch (ticketError) {
        console.error('Error updating ticket status:', ticketError);
        // Don't fail the entire operation if ticket update fails
      }
      
      // Close the modal after a short delay to show success
      setTimeout(() => {
        setIsUpdating(false);
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('Error updating event status:', error);
      setIsUpdating(false);
    }
  };
  
  useEffect(() => {
    // Return early if modal is not open or if projectName is missing/invalid
    if (!isOpen) return;
    if (!event.projectName || event.projectName === 'N/A' || event.projectName.includes('/')) return;
    
    try {
      // Set up messages listener
      const messagesRef = collection(db, "events", event.projectName, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      console.log('Messages snapshot received:', snapshot.docs.length, 'messages');
      const messageData = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log('Message data:', data);
        return {
          id: doc.id,
          content: data.content || '',
          sender: data.sender || 'Unknown',
          timestamp: data.timestamp,
          isAdmin: data.isAdmin || false
        } as Message;
      });
      console.log('Processed messages:', messageData);
      setMessages(messageData);
    });

    return () => {
      // Only call unsubscribe if it exists
      if (typeof unsubscribeMessages === 'function') {
        unsubscribeMessages();
      }
    };
    } catch (error) {
      console.error('Error setting up messages listener:', error);
      setMessages([]);
    }
  }, [isOpen, event.projectName]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    // Validate projectName before attempting to send message
    if (!event.projectName || event.projectName === 'N/A' || event.projectName.includes('/')) {
      console.error('Cannot send message: Invalid project name');
      return;
    }

    try {
      const messagesRef = collection(db, 'events', event.projectName, 'messages');
      await addDoc(messagesRef, {
        content: newMessage,
        sender: auth.currentUser?.email || 'User',
        isAdmin: true,
        timestamp: serverTimestamp(),
      });

      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black bg-opacity-40">
      <div className="rounded-sm bg-white p-8 dark:bg-boxdark w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-xl font-semibold text-black dark:text-white">
            {event.title}
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Conditional rendering based on event type */}
        {fullEventData?.event_type === 'group' ? (
          /* Group Event Layout */
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h5 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                  Group Event
                </h5>
              </div>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                This event contains multiple tickets. Click on any ticket below to view its report.
              </p>
            </div>

            {/* Event Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Team
                </label>
                <p className="text-black dark:text-white">{event.teamName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Project Manager
                </label>
                <p className="text-black dark:text-white">{event.projectManager}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Location(s)
                </label>
                <p className="text-black dark:text-white">{event.location}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Date & Time
                </label>
                <p className="text-black dark:text-white">
                  {format(event.startDate, 'dd/MM/yyyy')} {format(event.startDate, 'h:mm a')}
                </p>
              </div>
            </div>

            {/* Tickets List */}
            <div>
              <h6 className="text-md font-semibold text-black dark:text-white mb-4">
                Tickets in this Group Event
              </h6>
              <div className="space-y-3">
                {fullEventData?.tickets && fullEventData.tickets.length > 0 ? (
                  fullEventData.tickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      onClick={() => ticket.reportUrl && setSelectedTicketReport(ticket.reportUrl)}
                      className={`p-4 border border-stroke rounded-lg transition-all duration-200 ${
                        ticket.reportUrl 
                          ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-meta-4 hover:border-primary' 
                          : 'cursor-not-allowed opacity-60'
                      } dark:border-strokedark`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h6 className="font-medium text-black dark:text-white">
                              {ticket.title}
                            </h6>
                            <span className={`inline-flex items-center gap-1.5 rounded-full py-0.5 px-2.5 text-xs font-medium ${
                              ticket.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                              ticket.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                              ticket.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {ticket.severity}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>{ticket.company}</span>
                            <span>•</span>
                            <span>{ticket.location}</span>
                            <span>•</span>
                            <span className={`font-medium ${
                              ticket.status === 'Resolved' ? 'text-green-600' :
                              ticket.status === 'In Progress' ? 'text-blue-600' :
                              'text-gray-600'
                            }`}>
                              {ticket.status}
                            </span>
                            {ticket.noteStatus && (
                              <>
                                <span>•</span>
                                <span className="text-purple-600">{ticket.noteStatus}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ticket.reportUrl ? (
                            <div className="flex items-center gap-1 text-primary">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-xs">View Report</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No Report</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>No tickets found for this group event.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Report Viewer for Selected Ticket */}
            
          </div>
        ) : (
          /* Single Event Layout (existing layout) */
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <h5 className="text-lg font-semibold text-black dark:text-white mb-4">
                {event.projectName}
              </h5>
            </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.project')}
              </label>
              <p className="text-black dark:text-white">{event.projectManager}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.location')}
              </label>
              <p className="text-black dark:text-white">{event.location}</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.team')}
              </label>
              <p className="text-black dark:text-white">{event.teamName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full py-0.5 px-2.5 text-xs font-medium ${
                  event.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                  event.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                  event.status === 'Quotation Sent' ? 'bg-yellow-100 text-yellow-800' :
                  event.status === 'Material Not Complete' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {event.status || 'No status'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.contact.email')}
              </label>
              <p className="text-black dark:text-white">{event.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.contact.phone')}
              </label>
              <p className="text-black dark:text-white">{event.phone}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.time.start')} - {t('calendar.time.end')}
              </label>
              <p className="text-black dark:text-white">
                {format(event.startDate, 'dd/MM/yyyy')} {format(event.startDate, 'h:mm a')} - {format(event.endDate, 'dd/MM/yyyy')} {format(event.endDate, 'h:mm a')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.responsible')}
              </label>
              <p className="text-black dark:text-white">{event.responsibleEngineer || 'Not assigned'}</p>
            </div>
          </div>

          {/* Team Members Section */}
          <div className="col-span-2 mt-6">
            <h6 className="text-md font-semibold text-black dark:text-white mb-4">
              {t('calendar.details.team')}
            </h6>
            <div className="grid grid-cols-2 gap-4">
              {event.leadEngineer && (
                <div
                  className="flex items-center space-x-3 p-3 rounded-sm border border-stroke bg-primary/5 dark:border-strokedark dark:bg-meta-4"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-lg font-semibold">
                        {event.leadEngineer.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-primary mb-0.5">{t('calendar.details.responsible')}</p>
                    <p className="text-sm font-medium text-black dark:text-white">
                      {event.leadEngineer}
                    </p>
                  </div>
                </div>
              )}
              {event.teamMembers && event.teamMembers.length > 0 ? (
                event.teamMembers.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 rounded-sm border border-stroke bg-gray-50 dark:border-strokedark dark:bg-meta-4"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary text-lg font-semibold">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white">
                        {member.name}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="col-span-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('calendar.details.noTeamMembers')}
                </p>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Report Section - Only show for single events or when no ticket is selected in group events */}
        {(event.event_type !== 'group' || !selectedTicketReport) && (
        <div className="mt-8">
          <h5 className="text-lg font-semibold text-black dark:text-white mb-4">
            Event Report
          </h5>
          
          {/* Check if reportUrl exists and is not empty */}
          {(selectedTicketReport || (event.reportUrl && event.reportUrl.trim() !== '')) ? (
            <div className="border border-stroke rounded-lg p-6 mb-6 bg-white dark:bg-boxdark">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <svg className="w-10 h-10 text-primary mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <h6 className="text-md font-medium text-black dark:text-white mb-1">
                      {selectedTicketReport ? 'Ticket Report' : 'Event Report'}
                    </h6>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedTicketReport ? 'View the selected ticket report below' : 'View the full report below'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {selectedTicketReport && (
                    <button 
                      onClick={() => setSelectedTicketReport(null)}
                      className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Back to tickets</span>
                    </button>
                  )}
                  <a 
                    href={selectedTicketReport || event.reportUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center"
                  >
                    <span>Open in new tab</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
              
              {/* PDF viewer options */}
              <div className="w-full border border-stroke rounded p-4">
                <div className="flex flex-col gap-4">
                  {/* Direct download button */}
                  <a 
                    href={selectedTicketReport || event.reportUrl}
                    download="event_report.pdf"
                    className="flex items-center justify-center gap-2 bg-primary text-white py-3 px-4 rounded-md hover:bg-opacity-90 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Report
                  </a>
                  
                  {/* Message about browser security */}
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-md">
                    <p className="text-sm">
                      <strong>Note:</strong> Some browsers (like Brave) may block the embedded PDF viewer for security reasons. 
                      If you can't see the PDF below, please use the download button above or open in a new tab.
                    </p>
                  </div>
                  
                  {/* Embedded PDF viewer with object tag (more compatible than iframe) */}
                  <div className="w-full h-[400px] border border-stroke rounded overflow-hidden bg-gray-50">
                    <object
                      data={selectedTicketReport || event.reportUrl}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <p className="p-4 text-center">
                        Your browser doesn't support embedded PDFs. 
                        <a 
                          href={selectedTicketReport || event.reportUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Click here to view the PDF
                        </a>
                      </p>
                    </object>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 mb-6 bg-gray-50 dark:bg-meta-4">
              <div className="flex flex-col items-center justify-center text-center">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h6 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                  No Report Available
                </h6>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  The report for this event has not been uploaded yet.
                </p>
              </div>
            </div>
          )}
        </div>
        )}
        
        {/* Conversation Section */}
        
        
        <div className="mt-8 space-y-4">
          {event.status !== 'Resolved' && (
            <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-meta-4 rounded-md">
              <input
                type="checkbox"
                id="confirmRead"
                checked={isConfirmChecked}
                onChange={(e) => setIsConfirmChecked(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="confirmRead" className="text-sm text-gray-700 dark:text-gray-300">
                I confirm the report has been reviewed
              </label>
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            {event.status !== 'Material Complete' && (
              <button
                onClick={handleMarkAsResolved}
                disabled={!isConfirmChecked || isUpdating}
                className={`rounded-md px-6 py-2 text-white ${
                  isConfirmChecked 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-green-400 cursor-not-allowed'
                } ${isUpdating ? 'opacity-70' : ''}`}
              >
                {isUpdating ? 'Updating...' : 'Mark as Resolved'}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md bg-primary px-6 py-2 text-white hover:bg-opacity-90"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;
