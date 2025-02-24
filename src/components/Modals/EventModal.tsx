import { useState, useEffect } from 'react';
import { Team } from '../TeamsList';
import { format } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';


interface Client {
  id: string;
  companyName: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  onSave: (
    teamId: string,
    eventTitle: string,
    startDate: Date,
    endDate: Date,
    responsibleEngineer?: string,
    location?: string,
  ) => void;
  selectedDate: Date;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  teams,
  onSave,
  selectedDate,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(selectedDate);
  const [endDate, setEndDate] = useState<Date>(selectedDate);
  const [responsibleEngineer, setResponsibleEngineer] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [location, setLocation] = useState('');
  const [engineers, setEngineers] = useState<Array<{ id: string; email: string; displayName: string }>>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState({
    engineers: false,
    clients: false,
  });
  const [error, setError] = useState({
    engineers: '',
    clients: '',
  });

  useEffect(() => {
    const fetchEngineers = async () => {
      setIsLoading(prev => ({ ...prev, engineers: true }));
      setError(prev => ({ ...prev, engineers: '' }));
      try {
        const engineersRef = collection(db, 'engineers');
        const engineersSnapshot = await getDocs(engineersRef);
        
        const engineersList = engineersSnapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          displayName: doc.data().displayName || doc.data().email
        }));
        
        setEngineers(engineersList);
      } catch (error) {
        console.error('Error fetching engineers:', error);
        setError(prev => ({ ...prev, engineers: 'Failed to load engineers. Please try again.' }));
      } finally {
        setIsLoading(prev => ({ ...prev, engineers: false }));
      }
    };

    if (isOpen) {
      fetchEngineers();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchClients = async () => {
      setIsLoading(prev => ({ ...prev, clients: true }));
      setError(prev => ({ ...prev, clients: '' }));
      try {
        const clientsRef = collection(db, 'users');
        const clientsSnapshot = await getDocs(clientsRef);
        
        const clientsList = clientsSnapshot.docs.map(doc => ({
          id: doc.id,
          companyName: doc.data().companyName || ''
        }));
        
        setClients(clientsList);
      } catch (error) {
        console.error('Error fetching clients:', error);
        setError(prev => ({ ...prev, clients: 'Failed to load clients. Please try again.' }));
      } finally {
        setIsLoading(prev => ({ ...prev, clients: false }));
      }
    };

    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);


  useEffect(() => {
    if (isOpen) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
      setSelectedTeam('');
      setSelectedClient('');
      setResponsibleEngineer('');
      setEventTitle('');
      setLocation('');
      setError({
        engineers: '',
        clients: '',
      });
    }
  }, [isOpen, selectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (!eventTitle.trim()) {
      alert('Please enter an event title');
      return;
    }
    if (!selectedTeam) {
      alert('Please select a team');
      return;
    }
    if (!selectedClient) {
      alert('Please select a client');
      return;
    }
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    if (endDate < startDate) {
      alert('End date cannot be before start date');
      return;
    }

    onSave(selectedTeam, eventTitle, startDate, endDate, responsibleEngineer, location);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black bg-opacity-40">
      <div className="rounded-sm bg-white p-8 dark:bg-boxdark w-full max-w-2xl">
        <h4 className="mb-6 text-xl font-semibold text-black dark:text-white">
          Add New Event
        </h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="eventTitle"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Event Title
            </label>
            <input
              type="text"
              id="eventTitle"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              placeholder="Enter event title"
              required
            />
          </div>

          <div>
            <label
              htmlFor="team"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Team
            </label>
            <div className="relative z-20 bg-transparent dark:bg-form-input">
              <select
                id="team"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <span className="absolute top-1/2 right-4 z-30 -translate-y-1/2">
                <svg
                  className="fill-current"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g opacity="0.8">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M5.29289 8.29289C5.68342 7.90237 6.31658 7.90237 6.70711 8.29289L12 13.5858L17.2929 8.29289C17.6834 7.90237 18.3166 7.90237 18.7071 8.29289C19.0976 8.68342 19.0976 9.31658 18.7071 9.70711L12.7071 15.7071C12.3166 16.0976 11.6834 16.0976 11.2929 15.7071L5.29289 9.70711C4.90237 9.31658 4.90237 8.68342 5.29289 8.29289Z"
                      fill=""
                    ></path>
                  </g>
                </svg>
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="client"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Client
            </label>
            <div className="relative z-20 bg-transparent dark:bg-form-input">
              {error.clients && (
                <p className="text-danger mb-2">{error.clients}</p>
              )}
              <select
                id="client"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                disabled={isLoading.clients}
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName}
                  </option>
                ))}
              </select>
              {isLoading.clients && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              )}
              <span className="absolute top-1/2 right-4 z-30 -translate-y-1/2">
                <svg
                  className="fill-current"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g opacity="0.8">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 15.713L18.01 9.70299L16.597 8.28799L12 12.888L7.40399 8.28799L5.98999 9.70199L12 15.713Z"
                      fill=""
                    ></path>
                  </g>
                </svg>
              </span>
            </div>
          </div>
          <div>
            <label
              htmlFor="responsibleEngineer"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Responsible Engineer
            </label>
            <div className="relative z-20 bg-transparent dark:bg-form-input">
              {error.engineers && (
                <p className="text-danger mb-2">{error.engineers}</p>
              )}
              <select
                id="responsibleEngineer"
                value={responsibleEngineer}
                onChange={(e) => setResponsibleEngineer(e.target.value)}
                className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                disabled={isLoading.engineers}
              >
                <option value="">Select Engineer</option>
                {engineers.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>
                    {engineer.displayName}
                  </option>
                ))}
              </select>
              {isLoading.engineers && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              )}
              <span className="absolute top-1/2 right-4 z-30 -translate-y-1/2">
                <svg
                  className="fill-current"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g opacity="0.8">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 15.713L18.01 9.70299L16.597 8.28799L12 12.888L7.40399 8.28799L5.98999 9.70199L12 15.713Z"
                      fill=""
                    ></path>
                  </g>
                </svg>
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="location"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Location
            </label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              placeholder="Enter event location"
            />
          </div>

          <div>
            <label
              htmlFor="startDate"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Start Date and Time
            </label>
            <input
              type="datetime-local"
              id="startDate"
              value={format(startDate, "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              required
            />
          </div>

          <div>
            <label
              htmlFor="endDate"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              End Date and Time
            </label>
            <input
              type="datetime-local"
              id="endDate"
              value={format(endDate, "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-primary py-3 px-10 text-center font-medium text-white hover:bg-opacity-90 lg:px-8 xl:px-10"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-stroke py-3 px-10 text-center font-medium hover:bg-opacity-90 lg:px-8 xl:px-10"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
