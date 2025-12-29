import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAuth } from 'firebase/auth';
import 'react-calendar/dist/Calendar.css';

interface Team {
  id: string;
  name: string;
  leadEngineer: string;
  projectManager: string;
  supervisor?: string;
  supervisorEmail?: string;
  team_engineer?: string;
  team_engineers?: string[];
}

interface SetDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: any[];
}

const SetDateModal = ({ isOpen, onClose, tickets }: SetDateModalProps) => {
  const [date, setDate] = useState<Date | null>(new Date());
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const auth = getAuth();
  const currentUserEmail = auth.currentUser?.email;

  useEffect(() => {
    const fetchTeams = async () => {
      if (!currentUserEmail) return;
      
      const teamsCollection = collection(db, 'teams');
      // Prefer array-based assignment, but also support legacy single assignment
      const qArray = query(teamsCollection, where('team_engineers', 'array-contains', currentUserEmail));
      const qLegacy = query(teamsCollection, where('team_engineer', '==', currentUserEmail));
      const [arraySnap, legacySnap] = await Promise.all([getDocs(qArray), getDocs(qLegacy)]);
      const byId = new Map<string, Team>();
      arraySnap.docs.forEach((d) => byId.set(d.id, ({ id: d.id, ...d.data() } as Team)));
      legacySnap.docs.forEach((d) => byId.set(d.id, ({ id: d.id, ...d.data() } as Team)));
      setTeams(Array.from(byId.values()));
    };

    fetchTeams();
  }, [currentUserEmail]);

  const handleSave = async () => {
    if (!date || !selectedTeam || tickets.length === 0) return;

    const selectedTeamData = teams.find(team => team.id === selectedTeam);
    if (!selectedTeamData) return;

    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1); // Default to 1-day event

    try {
      // Create a group event title
      const groupTitle = tickets.length === 1 
        ? tickets[0].title || 'Untitled Event'
        : `Group Event - ${tickets.length} Tickets`;

      // Combine locations from all tickets
      const locations = [...new Set(tickets.map(ticket => ticket.location).filter(Boolean))];
      const combinedLocation = locations.join(', ') || 'Unknown Location';

      // Combine companies from all tickets
      const companies = [...new Set(tickets.map(ticket => ticket.company).filter(Boolean))];
      const combinedCompany = companies.join(', ') || 'Unknown Project';

      // Get ticket IDs
      const ticketIds = tickets.map(ticket => ticket.id);

      const eventData = {
        title: groupTitle,
        startDate: date,
        endDate: endDate,
        teamName: selectedTeamData.name || 'Unknown Team',
        projectName: combinedCompany,
        projectManager: selectedTeamData.projectManager || 'Unassigned',
        leadEngineer: selectedTeamData.leadEngineer || 'Unassigned',
        location: combinedLocation,
        ticketIds: ticketIds, // Array of ticket IDs
        ticketCount: tickets.length,
        event_type: tickets.length === 1 ? 'single' : 'group', // Track event type
        responsibleEngineer: currentUserEmail || '',
        supervisorEmail: selectedTeamData.supervisorEmail || '',
        createdAt: new Date(),
        // Add combined ticket information
        tickets: tickets.map(ticket => ({
          id: ticket.id,
          title: ticket.title,
          company: ticket.company,
          location: ticket.location,
          severity: ticket.severity,
          status: ticket.status,
          noteStatus: ticket.noteStatus
        }))
      };

      // Create the group event
      await addDoc(collection(db, 'events'), eventData);

      // Update all tickets with the date, isDateSet flag, responsible engineer, and supervisor email
      const updatePromises = tickets.map(ticket => {
        const ticketRef = doc(db, 'tickets', ticket.id);
        const updateData: any = {
          date: date,
          isDateSet: true,
          supervisor_email: selectedTeamData.supervisorEmail || ''
        };
        
        // Only update responsible_engineer if the ticket is not transferred
        // If ticket has transfer_engineer, preserve the original responsible_engineer
        if (!ticket.transfer_engineer) {
          updateData.responsible_engineer = currentUserEmail || '';
        }
        
        return updateDoc(ticketRef, updateData);
      });

      await Promise.all(updatePromises);

      onClose();
    } catch (error) {
      console.error('Error creating group event:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-medium text-black dark:text-white">
            {tickets.length === 1 ? 'Set Event Date' : `Create Group Event (${tickets.length} tickets)`}
          </h3>
          <button onClick={onClose}>
            <svg
              className="h-4 w-4 fill-current"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="1.67"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-2.5 block font-medium text-black dark:text-white">
            Select Team
          </label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          >
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5 flex justify-center">
          <Calendar
            onChange={(value) => {
              if (value instanceof Date) {
                setDate(value);
              } else if (Array.isArray(value) && value[0] instanceof Date) {
                setDate(value[0]);
              }
            }}
            value={date}
            className="custom-calendar"
            minDate={new Date()}
          />
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="rounded border border-stroke py-2 px-6 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-primary py-2 px-6 font-medium text-white hover:shadow-1"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetDateModal;
