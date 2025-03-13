import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  where,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import FilterTicketsModal from '../components/Modals/FilterTicketsModal';
import PDFGenerator from '../components/PDFGenerator/PDFGenerator';

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
  resolved?: boolean;
}

const statusColors: { [key: string]: string } = {
  Open: 'bg-blue-100 text-blue-800',
  Resolved: 'bg-purple-100 text-purple-800',
};

const CalendarTickets = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEngineer, setIsEngineer] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    status: 'all',
    engineer: 'all'
  });
  const auth = getAuth();

  useEffect(() => {
    const fetchUserRoleAndEvents = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.log('No current user found');
          setLoading(false);
          return;
        }

        setUserEmail(currentUser.email);
        console.log('Current user email:', currentUser.email);

        // Get user document to check role
        const userDoc = await getDoc(doc(db, 'engineers', currentUser.uid));
        const userData = userDoc.data();
        
        // Check roles
        const isAdmin = userData?.role === 'admin';
        const isUserEngineer = userData?.role === 'engineer';
        
        console.log('User data:', userData);
        console.log('Is admin:', isAdmin);
        console.log('Is engineer:', isUserEngineer);
        setIsEngineer(isUserEngineer);

        // Build query based on user role
        let eventsQuery;
        if (!isAdmin) {
          if (isUserEngineer && currentUser.email) {
            eventsQuery = query(
              collection(db, 'events'),
              where('responsibleEngineer', '==', currentUser.email),
              orderBy('startDate', 'desc')
            );
            console.log('Filtering events for engineer:', currentUser.email);
          } else {
            // Non-admin, non-engineer users should see no events
            setEvents([]);
            setLoading(false);
            return;
          }
        } else {
          eventsQuery = query(
            collection(db, 'events'),
            orderBy('startDate', 'desc')
          );
          console.log('Showing all events (admin)');
        }

        const eventsSnapshot = await getDocs(eventsQuery);
        console.log('Found events:', eventsSnapshot.size);
        const eventsData = eventsSnapshot.docs.map((doc) => {
          const data = doc.data();
          console.log('Event data:', data);
          return {
            id: doc.id,
            ...data,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            resolved: data.resolved || false,
          } as CalendarEvent;
        });
        setEvents(eventsData);
        setFilteredEvents(eventsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      }
    };

    fetchUserRoleAndEvents();
  }, [auth.currentUser]);

  const getEventStatus = (event: CalendarEvent) => {
    return event.resolved ? 'Resolved' : 'Open';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeElapsed = (startDate: Date) => {
    const now = new Date();
    const elapsed = now.getTime() - startDate.getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const handleResolveClick = async (eventId: string) => {
    try {
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        resolved: true,
      });

      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? { ...event, resolved: true } : event,
        ),
      );
    } catch (error) {
      console.error('Error resolving event:', error);
    }
  };

  const applyFilters = ({ status, engineer }: { status: string; engineer: string }) => {
    setActiveFilters({ status, engineer });
    
    let filtered = [...events];
    
    // Apply status filter
    if (status !== 'all') {
      const isResolved = status === 'Resolved';
      filtered = filtered.filter(event => event.resolved === isResolved);
    }
    
    // Apply engineer filter
    if (engineer !== 'all') {
      filtered = filtered.filter(event => event.responsibleEngineer === engineer);
    }
    
    setFilteredEvents(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Calendar Events" />

      <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-xl font-semibold text-black dark:text-white mb-1">
              Calendar Events
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Overview of all scheduled events and their status
            </p>
          </div>
          <div className="flex space-x-4">
            <PDFGenerator 
              events={filteredEvents} 
              filters={activeFilters}
            />
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-white hover:bg-opacity-90"
            >
              <svg 
                className="w-4 h-4 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
                />
              </svg>
              Filter Events
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="rounded-t-sm bg-gray-2 dark:bg-meta-4">
              <tr>
                <th className="min-w-[180px] p-2.5 xl:p-5">Date & Time</th>
                <th className="min-w-[220px] p-2.5 xl:p-5">Event Details</th>
                <th className="p-2.5 xl:p-5">Team</th>
                <th className="p-2.5 xl:p-5">Project</th>
                <th className="p-2.5 xl:p-5">Duration</th>
                <th className="p-2.5 xl:p-5">Location</th>
                <th className="p-2.5 xl:p-5">Status</th>
                <th className="p-2.5 xl:p-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                    <svg
                      className="w-16 h-16 mb-4 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium">No events found</p>
                    <p className="text-sm">Schedule an event to see it here</p>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event, index) => {
                  const status = getEventStatus(event);
                  const duration = Math.ceil(
                    (event.endDate.getTime() - event.startDate.getTime()) /
                      (1000 * 60 * 60 * 24),
                  );

                  return (
                    <tr key={event.id} className="border-b border-stroke dark:border-strokedark">
                      <td className="p-2.5 xl:p-5">
                        <div className="flex flex-col">
                          <span className="font-medium text-black dark:text-white">
                            {formatDate(event.startDate)}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatTime(event.startDate)}
                          </span>
                          <span className="text-xs text-gray-400 mt-1">
                            {getTimeElapsed(event.startDate)}
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 xl:p-5">
                        <div className="flex flex-col">
                          <span className="font-medium text-black dark:text-white">
                            {event.title}
                          </span>
                          {event.projectManager && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Manager: {event.projectManager}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 xl:p-5">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {event.teamName}
                        </span>
                      </td>
                      <td className="p-2.5 xl:p-5">
                        <span className="font-medium text-black dark:text-white">
                          {event.projectName}
                        </span>
                      </td>
                      <td className="p-2.5 xl:p-5">
                        <span className="inline-flex items-center gap-1">
                          <svg
                            className="w-4 h-4 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-black dark:text-white">
                            {duration} day{duration > 1 ? 's' : ''}
                          </span>
                        </span>
                      </td>
                      <td className="p-2.5 xl:p-5">
                        {event.location ? (
                          <span className="inline-flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-gray-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            <span className="text-black dark:text-white">
                              {event.location}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">Remote</span>
                        )}
                      </td>
                      <td className="p-2.5 xl:p-5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full py-1.5 px-4 text-sm font-medium ${statusColors[status]}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              status === 'Resolved'
                                ? 'bg-purple-500'
                                : 'bg-blue-500'
                            }`}
                          ></span>
                          {status}
                        </span>
                      </td>
                      <td className="p-2.5 xl:p-5">
                        {!event.resolved && (
                          <button
                            onClick={() => handleResolveClick(event.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 transition-colors duration-200"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <FilterTicketsModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApplyFilters={applyFilters}
        events={filteredEvents}
      />
    </>
  );
};

export default CalendarTickets;
