import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import EventModal from '../components/Modals/EventModal';
import DayEventsModal from '../components/Modals/DayEventsModal';
import EventDetailsModal from '../components/Modals/EventDetailsModal';
import { db } from '../config/firebase';
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
  projectManager?: string;
  location?: string;
  email?: string;
  phone?: string;
  leadEngineer?: string;
  responsibleEngineer?: string;
}

const CalendarComponent = () => {
  const [date, setDate] = useState(new Date());
  const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);

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
    setIsDayModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    const teamDetails = teams.find((team) => team.name === event.teamName);
    setSelectedEvent({
      ...event,
      teamMembers: teamDetails?.members || [],
      projectManager: '',
      location: '',
      email: '',
      phone: '',
      leadEngineer: teamDetails?.leadEngineer || '',
    });
    setIsDetailsModalOpen(true);
    setIsDayModalOpen(false);
  };

  const handleEventSave = async (
    teamId: string,
    projectId: string,
    startDate: Date,
    endDate: Date,
    responsibleEngineer?: string,
    eventTitle: string,
  ) => {
    const mockProjects = [
      { id: '1', name: 'Al Shaee3 Group' },
      { id: '2', name: 'Dr. Suliman Al Habib' },
      { id: '3', name: 'SAB Bank' },
      { id: '4', name: 'ALInma Bank' },
      { id: '5', name: 'LUCID' },
    ];

    const projectName =
      mockProjects.find((p) => p.id === projectId)?.name || '';

    try {
      const team = teams.find((t) => t.name === teamId);
      const newEvent: Omit<CalendarEvent, 'id'> = {
        title: eventTitle,
        startDate,
        endDate,
        teamName: teamId,
        projectId,
        projectName,
        teamMembers: team?.members || [],
        projectManager: '',
        location: '',
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
      <Breadcrumb pageName="Calendar" />

      <div className="flex flex-col gap-10">
        <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-xl font-semibold text-black dark:text-white">
              Team Calendar
            </h4>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-full bg-primary py-3 px-10 text-center font-medium text-white hover:bg-opacity-90 lg:px-8 xl:px-10"
            >
              <span className="mr-2">+</span> Add Event
            </button>
          </div>

          <div className="calendar-container">
            <Calendar
              onChange={setDate}
              value={date}
              onClickDay={handleDateClick}
              tileClassName={tileClassName}
              tileContent={tileContent}
              className="custom-calendar"
            />
          </div>
        </div>
      </div>

      {isDayModalOpen && (
        <DayEventsModal
          date={selectedDate}
          events={dayEvents}
          onClose={() => setIsDayModalOpen(false)}
          onEventClick={handleEventClick}
        />
      )}

      {isModalOpen && (
        <EventModal
          onClose={() => setIsModalOpen(false)}
          isOpen={isModalOpen}
          teams={teams}
          onSave={handleEventSave}
          selectedDate={selectedDate}
        />
      )}

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
