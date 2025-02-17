import { useState } from 'react';
import { Team } from '../TeamsList';

interface Project {
  id: string;
  name: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  selectedDate: Date;
  onSave: (teamId: string, projectId: string, startDate: Date, endDate: Date) => void;
}

const mockProjects: Project[] = [
  { id: '1', name: 'Al Shaee3 Group' },
  { id: '2', name: 'Dr. Suliman Al Habib' },
  { id: '3', name: 'SAB Bank' },
  { id: '4', name: 'ALInma Bank' },
  { id: '5', name: 'LUCID' },
];

const EventModal = ({ isOpen, onClose, teams, selectedDate, onSave }: EventModalProps) => {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const handleSubmit = () => {
    if (selectedTeam && selectedProject && startDate && endDate) {
      onSave(
        selectedTeam,
        selectedProject,
        new Date(startDate),
        new Date(endDate)
      );
      setSelectedTeam('');
      setSelectedProject('');
      setStartDate('');
      setEndDate('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black bg-opacity-40">
      <div className="rounded-sm bg-white p-8 dark:bg-boxdark w-96">
        <h4 className="mb-6 text-xl font-semibold text-black dark:text-white">
          Schedule Event
        </h4>

        <div className="mb-4">
          <label className="mb-2.5 block text-black dark:text-white">
            Select Project
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full rounded border border-stroke bg-transparent py-3 px-5 text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
          >
            <option value="">Select a project</option>
            {mockProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-2.5 block text-black dark:text-white">
            Select Team
          </label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full rounded border border-stroke bg-transparent py-3 px-5 text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
          >
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-2.5 block text-black dark:text-white">
            Start Date & Time
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-stroke bg-transparent py-3 px-5 text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2.5 block text-black dark:text-white">
            End Date & Time
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded border border-stroke bg-transparent py-3 px-5 text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
          />
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:bg-opacity-90 dark:border-strokedark dark:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedTeam || !selectedProject || !startDate || !endDate}
            className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
