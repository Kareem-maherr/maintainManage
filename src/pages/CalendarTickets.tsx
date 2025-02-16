import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';

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
}

const statusColors: { [key: string]: string } = {
  'Upcoming': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800'
};

const CalendarTickets = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsCollection = collection(db, 'events');
        const eventsQuery = query(eventsCollection, orderBy('startDate', 'desc'));
        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate()
          } as CalendarEvent;
        });
        setEvents(eventsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const getEventStatus = (startDate: Date, endDate: Date) => {
    const now = new Date();
    if (now < startDate) return 'Upcoming';
    if (now > endDate) return 'Completed';
    return 'In Progress';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h4 className="text-xl font-semibold text-black dark:text-white mb-1">
              Calendar Events
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Overview of all scheduled events and their status
            </p>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-8 rounded-t-sm bg-gray-2 dark:bg-meta-4 sm:grid-cols-8">
            <div className="p-2.5 xl:p-5">
              <h5 className="text-sm font-medium uppercase xsm:text-base">
                Date & Time
              </h5>
            </div>
            <div className="p-2.5 xl:p-5 col-span-2">
              <h5 className="text-sm font-medium uppercase xsm:text-base">
                Event Details
              </h5>
            </div>
            <div className="p-2.5 xl:p-5">
              <h5 className="text-sm font-medium uppercase xsm:text-base">
                Team
              </h5>
            </div>
            <div className="p-2.5 xl:p-5">
              <h5 className="text-sm font-medium uppercase xsm:text-base">
                Project
              </h5>
            </div>
            <div className="p-2.5 xl:p-5">
              <h5 className="text-sm font-medium uppercase xsm:text-base">
                Duration
              </h5>
            </div>
            <div className="p-2.5 xl:p-5">
              <h5 className="text-sm font-medium uppercase xsm:text-base">
                Location
              </h5>
            </div>
            <div className="p-2.5 xl:p-5">
              <h5 className="text-sm font-medium uppercase xsm:text-base">
                Status
              </h5>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">No events found</p>
              <p className="text-sm">Schedule an event to see it here</p>
            </div>
          ) : (
            events.map((event, index) => {
              const status = getEventStatus(event.startDate, event.endDate);
              const duration = Math.ceil((event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <div
                  key={event.id}
                  className={`grid grid-cols-8 hover:bg-gray-50 dark:hover:bg-meta-4 transition-colors duration-200 ${
                    index === events.length - 1
                      ? ''
                      : 'border-b border-stroke dark:border-strokedark'
                  } sm:grid-cols-8`}
                >
                  <div className="p-2.5 xl:p-5">
                    <div className="flex flex-col">
                      <span className="font-medium text-black dark:text-white">
                        {formatDate(event.startDate)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(event.startDate)}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 xl:p-5 col-span-2">
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
                  </div>
                  <div className="p-2.5 xl:p-5">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      {event.teamName}
                    </span>
                  </div>
                  <div className="p-2.5 xl:p-5">
                    <span className="font-medium text-black dark:text-white">
                      {event.projectName}
                    </span>
                  </div>
                  <div className="p-2.5 xl:p-5">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-black dark:text-white">
                        {duration} day{duration > 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>
                  <div className="p-2.5 xl:p-5">
                    {event.location ? (
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-black dark:text-white">{event.location}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">Remote</span>
                    )}
                  </div>
                  <div className="p-2.5 xl:p-5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full py-1.5 px-4 text-sm font-medium ${statusColors[status]}`}>
                      <span className={`h-2 w-2 rounded-full ${
                        status === 'Completed' ? 'bg-green-500' :
                        status === 'In Progress' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}></span>
                      {status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default CalendarTickets;
