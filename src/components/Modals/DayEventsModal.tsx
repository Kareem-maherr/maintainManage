import React from 'react';
import { format } from 'date-fns';

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
}

interface DayEventsModalProps {
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
}

const DayEventsModal: React.FC<DayEventsModalProps> = ({
  date,
  events,
  onClose,
  onEventClick,
}) => {
  // Generate time slots for the day (24 hours)
  const timeSlots = Array.from({ length: 24 }, (_, i) => i);

  // Function to calculate event position and height
  const getEventStyle = (event: CalendarEvent, index: number, events: CalendarEvent[]) => {
    const startHour = event.startDate.getHours() + event.startDate.getMinutes() / 60;
    const endHour = event.endDate.getHours() + event.endDate.getMinutes() / 60;
    const duration = endHour - startHour;

    // Find overlapping events
    const overlappingEvents = events.filter((e, i) => {
      if (i === index) return false;
      const eStart = e.startDate.getHours() + e.startDate.getMinutes() / 60;
      const eEnd = e.endDate.getHours() + e.endDate.getMinutes() / 60;
      return (
        (startHour >= eStart && startHour < eEnd) ||
        (endHour > eStart && endHour <= eEnd) ||
        (startHour <= eStart && endHour >= eEnd)
      );
    });

    // Calculate width and left offset based on overlaps
    const width = overlappingEvents.length > 0 ? 85 / (overlappingEvents.length + 1) : 95;
    const leftOffset = overlappingEvents.length > 0 
      ? (index % (overlappingEvents.length + 1)) * (width + 2)
      : 0;

    return {
      top: `${(startHour * 60)}px`,
      height: `${(duration * 60)}px`,
      left: `${leftOffset}%`,
      width: `${width}%`,
      position: 'absolute' as const,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderLeft: '4px solid #3b82f6',
      borderRadius: '4px',
      padding: '4px 8px',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      zIndex: overlappingEvents.length > 0 ? index + 1 : 1,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '2px',
    };
  };

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40">
      <div className="relative bg-white dark:bg-boxdark rounded-sm w-[90vw] max-w-[1000px] h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stroke dark:border-strokedark">
          <h3 className="text-xl font-semibold text-black dark:text-white">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="relative h-[1440px]"> {/* 24 hours * 60px per hour */}
            {/* Time slots */}
            <div className="absolute top-0 left-0 w-16 h-full border-r border-stroke dark:border-strokedark">
              {timeSlots.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-b border-stroke dark:border-strokedark px-2 text-sm text-gray-500 dark:text-gray-400 relative"
                >
                  <span className="absolute -top-3 right-2">
                    {format(new Date().setHours(hour, 0), 'ha')}
                  </span>
                </div>
              ))}
            </div>

            {/* Events container */}
            <div className="absolute left-16 right-0 h-full px-4">
              {/* Hour grid lines */}
              {timeSlots.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-b border-stroke dark:border-strokedark"
                />
              ))}

              {/* Events */}
              {sortedEvents.map((event, index) => (
                <div
                  key={event.id}
                  className="absolute rounded hover:bg-opacity-90"
                  style={getEventStyle(event, index, sortedEvents)}
                  onClick={() => onEventClick(event)}
                >
                  <div className="font-medium text-sm text-black dark:text-white">
                    {event.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {format(event.startDate, 'h:mm a')} -{' '}
                    {format(event.endDate, 'h:mm a')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {event.teamName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayEventsModal;
