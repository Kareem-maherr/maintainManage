import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import 'react-calendar/dist/Calendar.css';

interface Team {
  id: string;
  name: string;
  leadEngineer: string;
  projectManager: string;
}

interface SetDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: any;
}

const SetDateModal = ({ isOpen, onClose, ticket }: SetDateModalProps) => {
  const [date, setDate] = useState<Date | null>(new Date());
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  useEffect(() => {
    const fetchTeams = async () => {
      const teamsCollection = collection(db, 'teams');
      const teamsSnapshot = await getDocs(teamsCollection);
      const teamsData = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      setTeams(teamsData);
    };

    fetchTeams();
  }, []);

  const handleSave = async () => {
    if (!date || !selectedTeam) return;

    const selectedTeamData = teams.find(team => team.id === selectedTeam);
    if (!selectedTeamData) return;

    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1); // Default to 1-day event

    try {
      const eventData = {
        title: ticket.title || 'Untitled Event',
        startDate: date,
        endDate: endDate,
        teamName: selectedTeamData.name || 'Unknown Team',
        projectName: ticket.projectName || 'Unknown Project',
        projectManager: selectedTeamData.projectManager || 'Unassigned',
        leadEngineer: selectedTeamData.leadEngineer || 'Unassigned',
        location: 'Remote',
        ticketId: ticket.id,
        createdAt: new Date()
      };

      // Create the event
      await addDoc(collection(db, 'events'), eventData);

      // Update the ticket with the date
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        date: date
      });

      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-medium text-black dark:text-white">
            Set Event Date
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
            onChange={setDate}
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
