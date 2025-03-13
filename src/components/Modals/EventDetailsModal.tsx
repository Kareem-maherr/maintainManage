import { useLanguage } from '../../contexts/LanguageContext';

interface TeamMember {
  name: string;
}

interface ProjectDetails {
  title: string;
  projectManager: string;
  leadEngineer?: string;
  responsibleEngineer?: string;
  location: string;
  email: string;
  phone: string;
  startDate: Date;
  endDate: Date;
  teamName: string;
  projectName: string;
  teamMembers?: TeamMember[];
}

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ProjectDetails;
}

const EventDetailsModal = ({ isOpen, onClose, event }: EventDetailsModalProps) => {
  const { t } = useLanguage();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black bg-opacity-40">
      <div className="rounded-sm bg-white p-8 dark:bg-boxdark w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-xl font-semibold text-black dark:text-white">
            {event.title}
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <h5 className="text-lg font-semibold text-black dark:text-white mb-4">
              {event.projectName}
            </h5>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.project')}
              </label>
              <p className="text-black dark:text-white">{event.projectManager}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.location')}
              </label>
              <p className="text-black dark:text-white">{event.location}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.team')}
              </label>
              <p className="text-black dark:text-white">{event.teamName}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.contact.email')}
              </label>
              <p className="text-black dark:text-white">{event.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.contact.phone')}
              </label>
              <p className="text-black dark:text-white">{event.phone}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.time.start')} - {t('calendar.time.end')}
              </label>
              <p className="text-black dark:text-white">
                {event.startDate.toLocaleDateString()} - {event.endDate.toLocaleDateString()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('calendar.details.responsible')}
              </label>
              <p className="text-black dark:text-white">{event.responsibleEngineer || 'Not assigned'}</p>
            </div>
          </div>

          {/* Team Members Section */}
          <div className="col-span-2 mt-6">
            <h6 className="text-md font-semibold text-black dark:text-white mb-4">
              {t('calendar.details.team')}
            </h6>
            <div className="grid grid-cols-2 gap-4">
              {event.leadEngineer && (
                <div
                  className="flex items-center space-x-3 p-3 rounded-sm border border-stroke bg-primary/5 dark:border-strokedark dark:bg-meta-4"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-lg font-semibold">
                        {event.leadEngineer.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-primary mb-0.5">{t('calendar.details.responsible')}</p>
                    <p className="text-sm font-medium text-black dark:text-white">
                      {event.leadEngineer}
                    </p>
                  </div>
                </div>
              )}
              {event.teamMembers && event.teamMembers.length > 0 ? (
                event.teamMembers.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 rounded-sm border border-stroke bg-gray-50 dark:border-strokedark dark:bg-meta-4"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary text-lg font-semibold">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white">
                        {member.name}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="col-span-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('calendar.details.noTeamMembers')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-6 py-2 text-white hover:bg-opacity-90"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;
