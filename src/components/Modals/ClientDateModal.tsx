import { useState, useEffect } from 'react';
import { format, addMonths, isFriday, addDays } from 'date-fns';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useLanguage } from '../../contexts/LanguageContext';

interface Client {
  id: string;
  companyName: string;
}

interface Team {
  id: string;
  name: string;
  members: { name: string }[];
  leadEngineer?: string;
}

interface ClientDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  onEventsGenerated: (events: any[]) => void;
}

const ClientDateModal: React.FC<ClientDateModalProps> = ({
  isOpen,
  onClose,
  teams,
  onEventsGenerated,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [contractStart, setContractStart] = useState<Date>(new Date());
  const [contractEnd, setContractEnd] = useState<Date>(new Date());
  const [numberOfVisits, setNumberOfVisits] = useState<number>(1);
  const [isLoading, setIsLoading] = useState({
    clients: false,
    generating: false,
  });
  const [error, setError] = useState({
    clients: '',
    form: '',
  });
  const { t } = useLanguage();

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
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setSelectedClient('');
    setSelectedTeam('');
    setContractStart(new Date());
    setContractEnd(new Date());
    setNumberOfVisits(1);
    setError({
      clients: '',
      form: '',
    });
  };

  // Function to get the next non-Friday date
  const getNextNonFridayDate = (date: Date): Date => {
    if (isFriday(date)) {
      // If it's Friday, move to the next Monday (add 3 days)
      return addDays(date, 3);
    }
    return date;
  };

  // Generate dates between start and end, distributing them evenly
  const generateEventDates = (start: Date, end: Date, count: number): Date[] => {
    if (count <= 0) return [];
    
    const dates: Date[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Always include the contract start date as the first visit
    dates.push(getNextNonFridayDate(startDate));
    
    // If only one visit was requested, we're done
    if (count === 1) {
      return dates;
    }
    
    // Calculate the interval between visits
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Generate remaining dates at regular intervals
    for (let i = 1; i < count - 1; i++) {
      // Add months instead of days for more natural distribution
      const eventDate = addMonths(startDate, Math.floor(i * (totalDays / 30) / (count - 1)));
      dates.push(getNextNonFridayDate(eventDate));
    }
    
    // Include the end date if we need more than one visit
    if (count > 1) {
      dates.push(getNextNonFridayDate(endDate));
    }
    
    return dates;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (!selectedClient) {
      setError(prev => ({ ...prev, form: 'Please select a client' }));
      return;
    }
    if (!selectedTeam) {
      setError(prev => ({ ...prev, form: 'Please select a team' }));
      return;
    }
    if (contractEnd < contractStart) {
      setError(prev => ({ ...prev, form: 'Contract end date cannot be before start date' }));
      return;
    }
    if (numberOfVisits <= 0) {
      setError(prev => ({ ...prev, form: 'Number of visits must be at least 1' }));
      return;
    }

    setIsLoading(prev => ({ ...prev, generating: true }));
    setError(prev => ({ ...prev, form: '' }));

    try {
      // Get client and team details
      const client = clients.find(c => c.id === selectedClient);
      const team = teams.find(t => t.id === selectedTeam);
      
      if (!client || !team) {
        throw new Error('Client or team not found');
      }

      // Generate event dates
      const eventDates = generateEventDates(contractStart, contractEnd, numberOfVisits);
      
      // Create events in Firebase
      const eventsCollection = collection(db, 'events');
      const createdEvents = [];

      for (const date of eventDates) {
        // Set event to start at 9 AM and end at 5 PM
        const startDate = new Date(date);
        startDate.setHours(9, 0, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(17, 0, 0, 0);

        const eventTitle = `${client.companyName} Visit`;
        
        const newEvent = {
          title: eventTitle,
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
          teamName: team.name,
          projectId: selectedClient,
          projectName: client.companyName,
          teamMembers: team.members || [],
          projectManager: '',
          location: '',
          email: '',
          phone: '',
          leadEngineer: team.leadEngineer || '',
          responsibleEngineer: '',
          isClientVisit: true,
          displayDate: format(startDate, "dd/MM/yyyy")
        };

        const docRef = await addDoc(eventsCollection, newEvent);
        createdEvents.push({
          id: docRef.id,
          ...newEvent,
          startDate: startDate,
          endDate: endDate,
        });
      }

      // Notify parent component about the new events
      onEventsGenerated(createdEvents);
      onClose();
    } catch (error) {
      console.error('Error generating events:', error);
      setError(prev => ({ ...prev, form: 'Failed to generate events. Please try again.' }));
    } finally {
      setIsLoading(prev => ({ ...prev, generating: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black bg-opacity-40">
      <div className="rounded-sm bg-white p-8 dark:bg-boxdark w-full max-w-2xl">
        <h4 className="mb-6 text-xl font-semibold text-black dark:text-white">
          {t('calendar.setClientDates')}
        </h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error.form && (
            <div className="bg-danger bg-opacity-10 text-danger px-4 py-3 rounded">
              {error.form}
            </div>
          )}
          
          <div>
            <label
              htmlFor="client"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              {t('calendar.client')}
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
                <option value="">{t('calendar.selectClient')}</option>
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
              htmlFor="team"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              {t('calendar.team')}
            </label>
            <div className="relative z-20 bg-transparent dark:bg-form-input">
              <select
                id="team"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              >
                <option value="">{t('calendar.selectTeam')}</option>
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
              htmlFor="contractStart"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              {t('calendar.contractStart')}
            </label>
            <input
              type="date"
              id="contractStart"
              value={format(contractStart, "yyyy-MM-dd")}
              onChange={(e) => setContractStart(new Date(e.target.value))}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('calendar.displayDate')}: {format(contractStart, "dd/MM/yyyy")}
            </p>
          </div>

          <div>
            <label
              htmlFor="contractEnd"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              {t('calendar.contractEnd')}
            </label>
            <input
              type="date"
              id="contractEnd"
              value={format(contractEnd, "yyyy-MM-dd")}
              onChange={(e) => setContractEnd(new Date(e.target.value))}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('calendar.displayDate')}: {format(contractEnd, "dd/MM/yyyy")}
            </p>
          </div>

          <div>
            <label
              htmlFor="numberOfVisits"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              {t('calendar.numberOfVisits')}
            </label>
            <input
              type="number"
              id="numberOfVisits"
              value={numberOfVisits}
              onChange={(e) => setNumberOfVisits(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-primary py-3 px-10 text-center font-medium text-white hover:bg-opacity-90 lg:px-8 xl:px-10"
              disabled={isLoading.generating}
            >
              {isLoading.generating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                  {t('calendar.generating')}
                </>
              ) : (
                t('calendar.generateEvents')
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-stroke py-3 px-10 text-center font-medium hover:bg-opacity-90 lg:px-8 xl:px-10"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientDateModal;
