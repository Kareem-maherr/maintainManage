import { useState, useEffect } from 'react';
import { Team } from '../TeamsList';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  onSave: (
    teamId: string,
    projectId: string,
    eventTitle: string,
    startDate: Date,
    endDate: Date,
    responsibleEngineer?: string,
  ) => void;
  selectedDate: Date;
}

const mockProjects: Project[] = [
  { id: '1', name: 'Al Shaee3 Group' },
  { id: '2', name: 'Dr. Suliman Al Habib' },
  { id: '3', name: 'SAB Bank' },
  { id: '4', name: 'ALInma Bank' },
  { id: '5', name: 'LUCID' },
];

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  teams,
  onSave,
  selectedDate,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(selectedDate);
  const [endDate, setEndDate] = useState<Date>(selectedDate);
  const [responsibleEngineer, setResponsibleEngineer] = useState('');
  const [eventTitle, setEventTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
      setSelectedTeam('');
      setSelectedProject('');
      setResponsibleEngineer('');
      setEventTitle('');
    }
  }, [isOpen, selectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(selectedTeam, selectedProject, startDate, endDate, responsibleEngineer, eventTitle);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black bg-opacity-40">
      <div className="rounded-sm bg-white p-8 dark:bg-boxdark">
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
                required
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="project"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Project
            </label>
            <div className="relative z-20 bg-transparent dark:bg-form-input">
              <select
                id="project"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                required
              >
                <option value="">Select Project</option>
                {mockProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="responsibleEngineer"
              className="mb-2.5 block font-medium text-black dark:text-white"
            >
              Responsible Engineer
            </label>
            <input
              type="text"
              id="responsibleEngineer"
              value={responsibleEngineer}
              onChange={(e) => setResponsibleEngineer(e.target.value)}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              placeholder="Enter responsible engineer name"
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
