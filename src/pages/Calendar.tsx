import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import EventModal from '../components/Modals/EventModal';
import EventDetailsModal from '../components/Modals/EventDetailsModal';
import ScanDocumentModal from '../components/Modals/ScanDocumentModal';
import { db } from '../config/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import '../styles/calendar.css';
import { format } from 'date-fns';

interface Team {
  id: string;
  name: string;
  members: { name: string }[];
  leadEngineer?: string;
}

interface CalendarEvent {
  id?: string;
  title: string;
  startDate: Date;
  endDate: Date;
  teamName: string;
  projectId: string;
  projectName: string;
  teamMembers?: { name: string }[];
  projectManager: string;
  location: string;
  email: string;
  phone: string;
  leadEngineer?: string;
  responsibleEngineer?: string;
}

const CalendarComponent = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsCollection = collection(db, 'teams');
        const teamsSnapshot = await getDocs(teamsCollection);
        const teamsData = teamsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Team[];
        setTeams(teamsData);
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    };

    const fetchEvents = async () => {
      try {
        const eventsCollection = collection(db, 'events');
        const eventsQuery = query(eventsCollection, orderBy('startDate'));
        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
          } as CalendarEvent;
        });
        setMyEvents(eventsData);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchTeams();
    fetchEvents();
  }, []);

  const handleDateClick = (value: Date) => {
    const events = myEvents.filter((event) => {
      const eventDate = new Date(event.startDate);
      const clickedDate = new Date(value);
      
      return (
        eventDate.getFullYear() === clickedDate.getFullYear() &&
        eventDate.getMonth() === clickedDate.getMonth() &&
        eventDate.getDate() === clickedDate.getDate()
      );
    });
    
    setSelectedDate(value);
    setDayEvents(events);
  };

  const handleEventClick = (event: CalendarEvent) => {
    const teamDetails = teams.find((team) => team.name === event.teamName);
    const fullEvent: CalendarEvent = {
      ...event,
      teamMembers: teamDetails?.members || [],
      projectManager: event.projectManager || '',
      location: event.location || '',
      email: event.email || '',
      phone: event.phone || '',
      leadEngineer: teamDetails?.leadEngineer || '',
    };
    setSelectedEvent(fullEvent);
    setIsDetailsModalOpen(true);
  };

  const handleEventSave = async (
    teamId: string,
    eventTitle: string,
    startDate: Date,
    endDate: Date,
    responsibleEngineer?: string,
    location?: string
  ) => {
    const mockProjects = [
      { id: '1', name: 'Al Shaee3 Group' },
      { id: '2', name: 'Dr. Suliman Al Habib' },
      { id: '3', name: 'SAB Bank' },
      { id: '4', name: 'ALInma Bank' },
      { id: '5', name: 'LUCID' },
    ];

    const projectId = '1'; // Default to first project for now
    const projectName = mockProjects.find((p) => p.id === projectId)?.name || '';

    try {
      const team = teams.find((t) => t.name === teamId);
      const newEvent: CalendarEvent = {
        title: eventTitle,
        startDate,
        endDate,
        teamName: teamId,
        projectId,
        projectName,
        teamMembers: team?.members || [],
        projectManager: '',
        location: location || '',
        email: '',
        phone: '',
        leadEngineer: team?.leadEngineer || '',
        responsibleEngineer,
      };

      const eventsCollection = collection(db, 'events');
      const docRef = await addDoc(eventsCollection, {
        ...newEvent,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
      });

      setMyEvents((prev) => [...prev, { ...newEvent, id: docRef.id }]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dayEvents = myEvents.filter((event) => {
        const eventDate = new Date(event.startDate);
        const clickedDate = new Date(date);
        
        return (
          eventDate.getFullYear() === clickedDate.getFullYear() &&
          eventDate.getMonth() === clickedDate.getMonth() &&
          eventDate.getDate() === clickedDate.getDate()
        );
      });

      if (dayEvents.length > 0) {
        return (
          <div className="absolute bottom-1 right-1">
            <span className="bg-primary text-white text-xs rounded-full px-1.5 py-0.5">
              {dayEvents.length}
            </span>
          </div>
        );
      }
    }
    return null;
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const hasEvent = myEvents.some((event) => {
        const eventDate = new Date(event.startDate);
        const clickedDate = new Date(date);
        
        return (
          eventDate.getFullYear() === clickedDate.getFullYear() &&
          eventDate.getMonth() === clickedDate.getMonth() &&
          eventDate.getDate() === clickedDate.getDate()
        );
      });

      return `relative ${hasEvent ? 'event-day' : ''}`;
    }
  };

  return (
    <>
      <Breadcrumb pageName={t('calendar.title')} />

      <div className="flex flex-col gap-6">
        <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xl font-semibold text-black dark:text-white">
              {t('calendar.teamCalendar')}
            </h4>
            <div className="flex gap-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90"
              >
                {t('calendar.addEvent')}
              </button>
              <button
                onClick={() => setIsScanModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-primary py-2 px-6 text-center font-medium text-primary hover:bg-primary hover:text-white"
              >
                <svg 
                  className="w-5 h-5 mr-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                  />
                </svg>
                {t('calendar.scanDocument')}
              </button>
            </div>
          </div>

          <div className="calendar-container">
            <Calendar
              onChange={(value) => {
                if (value instanceof Date) {
                  setDate(value);
                }
              }}
              value={date}
              onClickDay={(value: Date) => handleDateClick(value)}
              tileClassName={tileClassName}
              tileContent={tileContent}
              className="custom-calendar"
            />
          </div>
        </div>

        {dayEvents.length > 0 && (
          <div className="rounded-sm border border-stroke bg-white px-5 py-6 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5">
            <div className="mb-6">
              <h4 className="text-xl font-semibold text-black dark:text-white">
                {t('calendar.eventsFor').replace('{0}', format(selectedDate, 'MMMM d, yyyy'))}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="cursor-pointer rounded-sm border border-stroke bg-gray-2 p-4 dark:border-strokedark dark:bg-meta-4 hover:bg-gray-3 dark:hover:bg-meta-3 transition-colors"
                >
                  <h4 className="text-lg font-semibold text-black dark:text-white mb-2">
                    {event.title}
                  </h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center text-black dark:text-white">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {format(event.startDate, 'h:mm a')} - {format(event.endDate, 'h:mm a')}
                    </div>
                    <div className="flex items-center text-black dark:text-white">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="flex items-center">
                        <span className="mr-1">{t('calendar.details.team')}:</span>
                        {event.teamName}
                      </span>
                    </div>
                    <div className="flex items-center text-black dark:text-white">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="flex items-center">
                        <span className="mr-1">{t('calendar.details.project')}:</span>
                        {event.projectName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        teams={teams}
        onSave={handleEventSave}
        selectedDate={selectedDate}
      />

      <ScanDocumentModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
      />

      {isDetailsModalOpen && selectedEvent && (
        <EventDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          event={selectedEvent}
        />
      )}
    </>
  );
};

export default CalendarComponent;
