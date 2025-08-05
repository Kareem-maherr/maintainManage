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
      // First, get all tickets and log their structure
      const ticketsSnapshot = await getDocs(collection(db, 'tickets'));
      const allTickets = ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('All tickets count:', allTickets.length);
      
      // Log all ticket fields to understand their structure
      if (allTickets.length > 0) {
        console.log('First ticket full structure:', JSON.stringify(allTickets[0], null, 2));
        
        // Log all field names from all tickets to find the project reference field
        const allFields = new Set();
        allTickets.forEach(ticket => {
          Object.keys(ticket).forEach(key => allFields.add(key));
        });
        console.log('All field names found in tickets:', Array.from(allFields));
        
        // Check what fields might contain project references
        allTickets.forEach((ticket, index) => {
          console.log(`Ticket ${index} potential project references:`, {
            id: ticket.id,
            title: (ticket as any).title,
            projectId: (ticket as any).projectId,
            project_id: (ticket as any).project_id,
            project: (ticket as any).project,
            companyId: (ticket as any).companyId,
            company: (ticket as any).company,
            company_id: (ticket as any).company_id
          });
        });
      }
      
      const projectsWithTickets = await Promise.all(
        (engineer.assignedProjects || []).map(async (project) => {
          console.log('Processing project:', { id: project.id, companyName: project.companyName });
          
          // Try all possible matching strategies
          const tickets = allTickets.filter(ticket => {
            // For debugging, log all potential matching fields for this ticket
            const matchingFields = {
              projectId: (ticket as any).projectId,
              project_id: (ticket as any).project_id,
              project: (ticket as any).project,
              companyId: (ticket as any).companyId,
              company: (ticket as any).company,
              company_id: (ticket as any).company_id
            };
            
            // Try to match by any field
            const isMatch = 
              matchingFields.projectId === project.id ||
              matchingFields.project_id === project.id ||
              matchingFields.project === project.id ||
              matchingFields.companyId === project.id ||
              matchingFields.company_id === project.id ||
              matchingFields.company === project.companyName;
              
            if (isMatch) {
              console.log('MATCH FOUND for ticket:', ticket.id, 'with project:', project.companyName);
            }
            
            return isMatch;
          });
          
          console.log(`Tickets for project ${project.id} (${project.companyName}):`, tickets.length);
          
          // For this project, manually assign tickets if none were found
          if (tickets.length === 0 && allTickets.length > 0) {
            console.log('No tickets matched automatically. Checking if we can match by company name in ticket title or description');
            
            // Try matching by company name in title or description as fallback
            const fallbackTickets = allTickets.filter(ticket => {
              const title = String((ticket as any).title || '').toLowerCase();
              const description = String((ticket as any).description || '').toLowerCase();
              const companyNameLower = project.companyName.toLowerCase();
              
              return title.includes(companyNameLower) || description.includes(companyNameLower);
            });
            
            if (fallbackTickets.length > 0) {
              console.log('Found tickets by company name in title/description:', fallbackTickets.length);
              // Use these tickets instead
              tickets.push(...fallbackTickets);
            }
          }
          
          const openTickets = tickets.filter(ticket => !(ticket as any).resolved);
          const resolvedTickets = tickets.filter(ticket => (ticket as any).resolved);
          
          console.log(`Open tickets for ${project.companyName}:`, openTickets.length);
          console.log(`Resolved tickets for ${project.companyName}:`, resolvedTickets.length);

          return {
            ...project,
            tickets: {
              open: openTickets,
              resolved: resolvedTickets
            }
          };
        })
      );
      
      console.log('Projects with tickets:', projectsWithTickets);
      const totalOpenTickets = projectsWithTickets.reduce((acc, project) => acc + project.tickets.open.length, 0);
      const totalResolvedTickets = projectsWithTickets.reduce((acc, project) => acc + project.tickets.resolved.length, 0);

      const content = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${engineer.displayName} - ${t('engineers.projectReport')}</title>
          <style>
            /* Import the desired font from Google fonts. 
            */
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');

            /* Define all colors used in this template 
            */
            :root{
              --font-color: black;
              --highlight-color: #007BFF; /* A more modern blue */
              --header-bg-color: #F8F9FA; /* Lighter header background */
              --footer-bg-color: #E9ECEF; /* Lighter footer background */
              --table-row-separator-color: #DEE2E6;
            }

            @page{
              size:A4;
              /* This margin creates space for the running header and footer */
              margin: 6.5cm 0 3cm 0;

              @top-left{
                content:element(header);
              }

              @bottom-left{
                content:element(footer);
              }
            }

            body{
              /* REMOVED padding from body to fix header gap */
              margin:0;
              color:var(--font-color);
              font-family: 'Montserrat', sans-serif;
              font-size:10pt;
            }

            a{
              color:inherit;
              text-decoration:none;
            }

            hr{
              margin:1cm 0;
              height:0;
              border:0;
              border-top:1mm solid var(--highlight-color);
            }

            header{
              /* Adjusted height to match the new @page margin */
              height:6.5cm;
              padding: 1cm 2cm 0 2cm;
              position:running(header);
              background-color:var(--header-bg-color);
            }

            header .headerSection{
              display:flex;
              justify-content:space-between;
            }
            
            header .headerSection div:last-child{
              width:45%;
            }

            header h1, header h2, header h3, header p{
              margin:0;
            }

            header h2, header h3{
              text-transform:uppercase;
            }
            
            header .report-title h2 {
              font-size: 1.8rem;
              font-weight: 700;
            }

            header .issuedTo h3{
              margin:0 .75cm 0 0;
              color:var(--highlight-color);
            }
            
            header .issuedTo {
              display:flex;
            }

            header hr{
              margin:.75cm 0 .5cm 0;
            }

            /* ADDED horizontal padding to main content area */
            main {
                padding: 0 2cm;
            }
            
            /* NEW: This class forces a page break for each project */
            .project-page {
                page-break-before: always;
            }
            
            /* Prevents a page break before the very first element */
            .project-page:first-of-type {
                page-break-before: avoid;
            }

            main .project-title {
                padding-top: 1cm; /* Gives space at the top of the new page */
                margin-bottom: 0.5cm;
                font-size: 1.5rem;
                color: var(--highlight-color);
                border-bottom: 1px solid var(--highlight-color);
                padding-bottom: 0.25cm;
            }
            
            main .ticket-type-header {
                font-size: 1.2rem;
                font-weight: bold;
                margin-top: 1cm;
                margin-bottom: 0.5cm;
            }

            main table{
              width:100%;
              border-collapse:collapse;
            }

            main table thead th{
              height:1cm;
              color:var(--highlight-color);
              text-align:left;
              font-size: 9pt;
            }

            main table tbody td{
              padding:4mm 4px;
              border-bottom:0.5mm solid var(--table-row-separator-color);
              font-size: 9pt;
            }
            
            main table tbody td .description {
              font-size: 8pt;
              color: #555;
            }

            main table.summary{
              width:calc(45% + 2cm);
              margin-left:55%;
              margin-top:1cm;
            }

            main table.summary tr.total{
              font-weight:bold;
              background-color:var(--highlight-color);
              color: white;
            }

            main table.summary th{
              padding:4mm 0 4mm 1cm;
              border-bottom:0;
              text-align:left;
            }

            main table.summary td{
              padding:4mm 2cm 4mm 0;
              border-bottom:0;
              text-align:right;
            }

            aside{
              -prince-float: bottom;
              padding:0 2cm .5cm 2cm;
            }

            aside p{
              margin:0;
            }

            footer{
              height:3cm;
              line-height:3cm;
              padding:0 2cm;
              position:running(footer);
              background-color:var(--footer-bg-color);
              font-size:8pt;
              display:flex;
              align-items:baseline;
              justify-content:space-between;
            }

          </style>
        </head>
        <body>
          <header>
            <div class="headerSection">
              <div>
                <h1>${engineer.displayName}</h1>
              </div>
              <div class="report-title">
                <h2>${t('engineers.projectReport')}</h2>
                <p>
                  <b>${t('engineers.reportDate')}:</b> ${new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <hr />
            <div class="headerSection">
              <div class="issuedTo">
                <h3>${t('engineers.engineerDetails')}</h3>
                <p>
                  <b>${getTranslatedRole(engineer.role)}</b>
                  <br />
                  ${engineer.email}
                  ${engineer.specialties ? `<br /><b>${t('engineers.specialties')}:</b> ${engineer.specialties.join(', ')}` : ''}
                </p>
              </div>
            </div>
          </header>

          <footer>
              <span><b>${engineer.displayName}</b> | ${t('engineers.projectReport')}</span>
              <span>${t('engineers.generatedOn')} ${new Date().toLocaleString()}</span>
          </footer>

          <main>
            ${projectsWithTickets.map(project => `
              <div class="project-page">
                <h2 class="project-title">${project.companyName}</h2>
                
                <div class="ticket-type-header">${t('engineers.tickets.open')} (${project.tickets.open.length})</div>
                ${project.tickets.open.length > 0 ? `
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 45%;">${t('engineers.tickets.title')}</th>
                        <th style="width: 15%;">${t('engineers.tickets.priority')}</th>
                        <th style="width: 20%;">${t('engineers.tickets.created')}</th>
                        <th style="width: 20%;">${t('engineers.tickets.due')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${project.tickets.open.map(ticket => `
                        <tr>
                          <td>
                            <b>#${ticket.id.substring(0,12)}... - ${ticket.title}</b>
                            ${ticket.description ? `<br/><span class="description">${ticket.description}</span>` : ''}
                          </td>
                          <td>${ticket.priority || 'N/A'}</td>
                          <td>${new Date(ticket.createdAt?.seconds * 1000).toLocaleDateString()}</td>
                          <td>${ticket.dueDate ? new Date(ticket.dueDate?.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : `<p>${t('engineers.tickets.noOpen')}</p>`}

                <div class="ticket-type-header">${t('engineers.tickets.resolved')} (${project.tickets.resolved.length})</div>
                 ${project.tickets.resolved.length > 0 ? `
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 45%;">${t('engineers.tickets.title')}</th>
                        <th style="width: 15%;">${t('engineers.tickets.priority')}</th>
                        <th style="width: 20%;">${t('engineers.tickets.created')}</th>
                        <th style="width: 20%;">${t('engineers.tickets.resolvedDate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${project.tickets.resolved.map(ticket => `
                        <tr>
                          <td>
                            <b>#${ticket.id.substring(0,12)}... - ${ticket.title}</b>
                             ${ticket.resolution ? `<br/><span class="description">${t('engineers.tickets.resolution')}: ${ticket.resolution}</span>` : ''}
                          </td>
                          <td>${ticket.priority || 'N/A'}</td>
                          <td>${new Date(ticket.createdAt?.seconds * 1000).toLocaleDateString()}</td>
                          <td>${ticket.resolvedAt ? new Date(ticket.resolvedAt?.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : `<p>${t('engineers.tickets.noResolved')}</p>`}
              </div>
            `).join('')}
            
            ${projectsWithTickets.length > 0 ? `
                <table class="summary">
                  <tr>
                    <th>${t('engineers.totalProjects')}</th>
                    <td>${projectsWithTickets.length}</td>
                  </tr>
                  <tr>
                    <th>${t('engineers.totalOpenTickets')}</th>
                    <td>${totalOpenTickets}</td>
                  </tr>
                  <tr class="total">
                    <th>${t('engineers.totalResolvedTickets')}</th>
                    <td>${totalResolvedTickets}</td>
                  </tr>
                </table>
            ` : `<p>${t('engineers.noProjects')}</p>`}
            
          </main>
          
          <aside>
            <hr />
            <p>
              <b>${t('engineers.endOfReport')}</b>
            </p>
          </aside>
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

        // Filter out admins and only keep engineers
        const engineersOnly = engineersData.filter(engineer => engineer.role.toLowerCase() === 'engineer');
        
        const engineersWithProjects = await Promise.all(
          engineersOnly.map(async (engineer) => {
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