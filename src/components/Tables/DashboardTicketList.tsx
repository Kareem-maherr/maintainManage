import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../config/firebase';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import noTicketsIcon from '../../images/empty-state/no-tickets.svg';

interface Ticket {
  id: string;
  title: string;
  sender: string;
  company: string;
  location: string;
  date: string;
  time: string;
  severity: string;
  status: string;
  notes: string;
  createdAt: Timestamp;
  hasUnreadMessages: boolean;
  responsible_engineer?: string;
  readableId?: string;
}

const priorityStyles: { [key: string]: string } = {
  'Critical': 'bg-red-100 text-red-800',
  'High': 'bg-orange-100 text-orange-800',
  'Medium': 'bg-yellow-100 text-yellow-800',
  'Low': 'bg-green-100 text-green-800'
};

const statusStyles: { [key: string]: string } = {
  'Open': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-purple-100 text-purple-800',
  'Resolved': 'bg-green-100 text-green-800'
};

interface TableOneProps {
  onViewMore?: () => void;
}

const DashboardTicketList = ({ onViewMore }: TableOneProps) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userCompanies, setUserCompanies] = useState<{ [key: string]: string }>({});
  const auth = getAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchUserRoleAndTickets = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // Get user document
        const userDoc = await getDoc(doc(db, 'engineers', currentUser.uid));
        const userData = userDoc.data();

        // Check if user is admin based on role
        const isAdmin = userData?.role === 'admin';

        // Base query parameters
        const queryParams = [
          where('status', '==', 'Open'),
          orderBy('createdAt', 'desc'),
          limit(5)
        ];

        // If engineer (and not admin), only show their tickets
        if (userData?.role === 'engineer' && !isAdmin) {
          queryParams.unshift(where('responsible_engineer', '==', currentUser.email));
        }

        // Create and execute query
        const unsubscribeTickets = onSnapshot(
          query(collection(db, 'tickets'), ...queryParams),
          (snapshot) => {
            const ticketData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                // Convert Firestore timestamp to formatted date string
                date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : '',
                time: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString() : '',
                createdAt: data.createdAt,
                readableId: data.readableId || 'Unknown'
              } as Ticket;
            });
            setTickets(ticketData);

            // Fetch company information for each unique sender
            const uniqueSenders = [...new Set(ticketData.map(ticket => ticket.sender))];
            uniqueSenders.forEach(sender => {
              if (sender && !userCompanies[sender]) {
                fetchUserCompany(sender);
              }
            });
          }
        );

        return () => {
          unsubscribeTickets();
        };
      } catch (error) {
        console.error('Error fetching user role and tickets:', error);
      }
    };

    fetchUserRoleAndTickets();
  }, []);

  const fetchUserCompany = async (email: string) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          setUserCompanies(prev => ({
            ...prev,
            [email]: userData.company || 'N/A'
          }));
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching user company:', error);
      return () => {};
    }
  };

  return (
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      <div className="mb-6 flex items-center justify-between">
        <h4 className="text-xl font-semibold text-black dark:text-white">
          {t('dashboard.tickets.recentOpenTickets')}
        </h4>
        <NavLink to="/tables">
        <button
          onClick={onViewMore}
          className="inline-flex items-center justify-center rounded-md border border-primary py-2 px-6 text-center font-medium text-primary hover:bg-opacity-90"
        >
          {t('dashboard.tickets.viewMore')}
        </button>
        </NavLink>
      </div>

      <div className="flex flex-col">
        {tickets.length > 0 ? (
          <>
            <div className="grid grid-cols-3 rounded-sm bg-gray-2 dark:bg-meta-4 sm:grid-cols-7">
              <div className="p-2.5 xl:p-5">
                <h5 className="text-sm font-medium uppercase xsm:text-base">ID</h5>
              </div>
              <div className="p-2.5 xl:p-5">
                <h5 className="text-sm font-medium uppercase xsm:text-base">{t('dashboard.tickets.table.title')}</h5>
              </div>
              <div className="p-2.5 text-center xl:p-5">
                <h5 className="text-sm font-medium uppercase xsm:text-base">{t('dashboard.tickets.table.company')}</h5>
              </div>
              <div className="p-2.5 text-center xl:p-5">
                <h5 className="text-sm font-medium uppercase xsm:text-base">{t('dashboard.tickets.table.location')}</h5>
              </div>
              <div className="hidden p-2.5 text-center sm:block xl:p-5">
                <h5 className="text-sm font-medium uppercase xsm:text-base">{t('dashboard.tickets.table.date')}</h5>
              </div>
              <div className="hidden p-2.5 text-center sm:block xl:p-5">
                <h5 className="text-sm font-medium uppercase xsm:text-base">{t('dashboard.tickets.table.severity')}</h5>
              </div>
              <div className="hidden p-2.5 text-center sm:block xl:p-5">
                <h5 className="text-sm font-medium uppercase xsm:text-base">{t('dashboard.tickets.table.status')}</h5>
              </div>
            </div>

            {tickets.map((ticket, key) => (
              <div
                className={`grid grid-cols-3 sm:grid-cols-7 ${
                  key === tickets.length - 1
                    ? ''
                    : 'border-b border-stroke dark:border-strokedark'
                }`}
                key={ticket.id}
              >
                <div className="flex items-center gap-3 p-2.5 xl:p-5">
                  <p className="text-meta-5">
                    {ticket.readableId}
                  </p>
                </div>
                <div className="flex items-center gap-3 p-2.5 xl:p-5">
                  <p className="text-black dark:text-white">
                    {ticket.title}
                  </p>
                </div>
                <div className="flex items-center justify-center p-2.5 xl:p-5">
                  <p className="text-black dark:text-white">
                    {ticket.company}
                  </p>
                </div>
                <div className="flex items-center justify-center p-2.5 xl:p-5">
                  <p className="text-black dark:text-white">
                    {ticket.location}
                  </p>
                </div>
                <div className="hidden items-center justify-center p-2.5 sm:flex xl:p-5">
                  <p className="text-black dark:text-white">
                    {ticket.date}
                  </p>
                </div>
                <div className="hidden items-center justify-center p-2.5 sm:flex xl:p-5">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${priorityStyles[ticket.severity]}`}>
                    {ticket.severity}
                  </span>
                </div>
                <div className="hidden items-center justify-center p-2.5 sm:flex xl:p-5">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusStyles[ticket.status]}`}>
                    {ticket.status}
                  </span>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <img src={noTicketsIcon} alt="No tickets" className="w-24 h-24 mb-4" />
            <p className="text-lg font-medium text-black dark:text-white">
              {t('dashboard.tickets.noRecentOpenTickets') || 'No recent open tickets'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardTicketList;
