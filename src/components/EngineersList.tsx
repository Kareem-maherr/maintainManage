import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface Engineer {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: any;
  specialties?: string[];
  currentProject?: string;
  availability?: 'available' | 'busy' | 'away';
  assignedProjects?: { [key: string]: any }[];
}

const EngineersList = () => {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEngineerId, setExpandedEngineerId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const { t } = useLanguage();

  const handlePrintEngineerDetails = async (engineer: Engineer, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrinting(engineer.id);
    try {
      const ticketsRef = collection(db, 'tickets');
      const projectsWithTickets = await Promise.all(
        (engineer.assignedProjects || []).map(async (project) => {
          const ticketsQuery = query(
            ticketsRef,
            where('responsible_engineer', '==', engineer.id),
            where('project_id', '==', project.id)
          );

          const ticketsSnapshot = await getDocs(ticketsQuery);
          const tickets = ticketsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          return {
            ...project,
            tickets: {
              open: tickets.filter(ticket => !ticket.resolved),
              resolved: tickets.filter(ticket => ticket.resolved)
            }
          };
        })
      );

      const content = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${engineer.displayName} - ${t('engineers.projectReport')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { margin-bottom: 20px; }
            .project { border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
            .ticket { margin: 10px 0; padding: 10px; background: #f9f9f9; }
            .open { border-left: 4px solid #dc2626; }
            .resolved { border-left: 4px solid #059669; }
            .meta { color: #666; font-size: 0.9em; }
            @media print {
              .project { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${engineer.displayName} - ${t('engineers.projectReport')}</h1>
            <p>${t('engineers.email')}: ${engineer.email}</p>
            <p>${t('engineers.role')}: ${getTranslatedRole(engineer.role)}</p>
            ${engineer.specialties ? `<p>${t('engineers.specialties')}: ${engineer.specialties.join(', ')}</p>` : ''}
          </div>

          ${projectsWithTickets.map(project => `
            <div class="project">
              <h2>${project.companyName}</h2>
              <div class="meta">
                <p>${t('engineers.projectId')}: ${project.id}</p>
                <p>${t('engineers.contact')}: ${project.contactPerson || t('engineers.notSpecified')}</p>
                <p>${t('engineers.contactEmail')}: ${project.contactEmail || t('engineers.notSpecified')}</p>
                <p>${t('engineers.contactPhone')}: ${project.contactPhone || t('engineers.notSpecified')}</p>
              </div>

              <h3>${t('engineers.tickets.open')} (${project.tickets.open.length})</h3>
              ${project.tickets.open.length === 0 ? 
                `<p>${t('engineers.tickets.noOpen')}</p>` :
                project.tickets.open.map(ticket => `
                  <div class="ticket open">
                    <h4>#${ticket.id} - ${ticket.title}</h4>
                    <p>${ticket.description || t('engineers.tickets.noDescription')}</p>
                    <div class="meta">
                      <p>${t('engineers.tickets.priority')}: ${ticket.priority || t('engineers.notSpecified')}</p>
                      <p>${t('engineers.tickets.created')}: ${new Date(ticket.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                      ${ticket.dueDate ? `<p>${t('engineers.tickets.due')}: ${new Date(ticket.dueDate?.seconds * 1000).toLocaleDateString()}</p>` : ''}
                    </div>
                  </div>
                `).join('')
              }

              <h3>${t('engineers.tickets.resolved')} (${project.tickets.resolved.length})</h3>
              ${project.tickets.resolved.length === 0 ? 
                `<p>${t('engineers.tickets.noResolved')}</p>` :
                project.tickets.resolved.map(ticket => `
                  <div class="ticket resolved">
                    <h4>#${ticket.id} - ${ticket.title}</h4>
                    <p>${ticket.description || t('engineers.tickets.noDescription')}</p>
                    <div class="meta">
                      <p>${t('engineers.tickets.priority')}: ${ticket.priority || t('engineers.notSpecified')}</p>
                      <p>${t('engineers.tickets.created')}: ${new Date(ticket.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                      ${ticket.resolvedAt ? `<p>${t('engineers.tickets.resolvedDate')}: ${new Date(ticket.resolvedAt?.seconds * 1000).toLocaleDateString()}</p>` : ''}
                      ${ticket.resolution ? `<p>${t('engineers.tickets.resolution')}: ${ticket.resolution}</p>` : ''}
                    </div>
                  </div>
                `).join('')
              }
            </div>
          `).join('')}

          ${projectsWithTickets.length === 0 ? `<p>${t('engineers.noProjects')}</p>` : ''}
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Error generating print report:', error);
    } finally {
      setPrinting(null);
    }
  };

  const getTranslatedName = (displayName: string) => {
    const translationKey = `engineers.engineerNames.${displayName}`;
    return t(translationKey) || displayName;
  };

  const getTranslatedRole = (role: string) => {
    const translationKey = `engineers.role.${role.toLowerCase()}`;
    return t(translationKey) || role;
  };

  useEffect(() => {
    const fetchEngineersAndProjects = async () => {
      const engineersRef = collection(db, 'engineers');
      const usersRef = collection(db, 'users');

      const unsubscribeEngineers = onSnapshot(query(engineersRef), async (snapshot) => {
        const engineersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Engineer[];

        const engineersWithProjects = await Promise.all(
          engineersData.map(async (engineer) => {
            const projectsQuery = query(usersRef, where('responsible_engineer', '==', engineer.email));
            const projectsSnapshot = await getDocs(projectsQuery);
            
            return {
              ...engineer,
              assignedProjects: projectsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
            };
          })
        );

        setEngineers(engineersWithProjects);
        setLoading(false);
      });

      return () => {
        unsubscribeEngineers();
      };
    };

    fetchEngineersAndProjects();
  }, []);

  const getAvailabilityColor = (availability?: string) => {
    switch (availability) {
      case 'available':
        return 'bg-meta-3/10 text-meta-3';
      case 'busy':
        return 'bg-meta-1/10 text-meta-1';
      case 'away':
        return 'bg-meta-6/10 text-meta-6';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const EngineerCard = ({ engineer }: { engineer: Engineer }) => {
    const isExpanded = expandedEngineerId === engineer.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={`bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-sm shadow-default hover:shadow-md transition-shadow duration-300 overflow-hidden cursor-pointer`}
        onClick={() => setExpandedEngineerId(isExpanded ? null : engineer.id)}
      >
        <motion.div layout className="p-6">
          <motion.div layout className="flex items-center space-x-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-sm bg-gray-100 dark:bg-meta-4 flex items-center justify-center transform transition-transform duration-300"
            >
              <span className="text-2xl font-bold text-gray-700 dark:text-white">
                {getTranslatedName(engineer.displayName).charAt(0).toUpperCase()}
              </span>
            </motion.div>
            <div className="flex-1 min-w-0">
              <motion.h3 layout className="text-xl font-semibold text-black dark:text-white truncate">
                {getTranslatedName(engineer.displayName)}
              </motion.h3>
              <motion.div layout className="flex items-center space-x-2 mt-1">
                <span className="inline-flex rounded-sm px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-white">
                  {getTranslatedRole(engineer.role)}
                </span>
                {engineer.availability && (
                  <span className={`inline-flex rounded-sm px-2.5 py-1 text-xs font-medium ${getAvailabilityColor(engineer.availability)}`}>
                    {t(`engineers.availability.${engineer.availability}`)}
                  </span>
                )}
              </motion.div>
            </div>
          </motion.div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-6 space-y-4 text-sm border-t border-stroke dark:border-strokedark pt-4"
              >
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center text-gray-600 dark:text-gray-300"
                >
                  <svg className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2" />
                  </svg>
                  <span className="truncate">{engineer.email}</span>
                </motion.div>

                {engineer.assignedProjects && engineer.assignedProjects.length > 0 && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <svg className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="font-medium">{t('engineers.assignedProjects')}</span>
                    </div>
                    <div className="ml-7">
                      <div className="flex flex-wrap gap-2">
                        {engineer.assignedProjects.map((project) => (
                          <span
                            key={project.id}
                            className="inline-flex rounded-sm px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-white"
                          >
                            {project.companyName || t('engineers.unnamedCompany')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {engineer.specialties && engineer.specialties.length > 0 && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <svg className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="font-medium">{t('engineers.specialties')}</span>
                    </div>
                    <div className="ml-7">
                      <div className="flex flex-wrap gap-2">
                        {engineer.specialties.map((specialty, index) => (
                          <span
                            key={index}
                            className="inline-flex rounded-sm px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-white"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                <button
                  className="bg-primary text-white rounded-sm py-2.5 px-4 mt-4"
                  onClick={(e) => handlePrintEngineerDetails(engineer, e)}
                >
                  {t('engineers.printReport')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">{t('engineers.loading')}</span>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke dark:border-strokedark bg-white dark:bg-boxdark px-5 pt-6 pb-2.5 shadow-default dark:shadow-default dark:text-white">
      <div className="flex justify-between mb-6">
        <h4 className="text-xl font-semibold text-black dark:text-white">{t('engineers.title')}</h4>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3 2xl:gap-7.5">
        {engineers.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            {t('engineers.noEngineers')}
          </div>
        ) : (
          engineers.map((engineer) => (
            <EngineerCard key={engineer.id} engineer={engineer} />
          ))
        )}
      </div>
    </div>
  );
};

export default EngineersList;