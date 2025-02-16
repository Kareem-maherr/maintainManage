import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../config/firebase';

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

  useEffect(() => {
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

    const unsubscribeTickets = onSnapshot(
      query(
        collection(db, 'tickets'),
        where('status', '==', 'Open'),
        orderBy('createdAt', 'desc'),
        limit(5)
      ), 
      (snapshot) => {
        const ticketData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as Ticket);
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
  }, []);

  return (
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      <div className="mb-6 flex items-center justify-between">
        <h4 className="text-xl font-semibold text-black dark:text-white">
          Recent Open Tickets
        </h4>
        <button
          onClick={onViewMore}
          className="inline-flex items-center justify-center rounded-md border border-primary py-2 px-6 text-center font-medium text-primary hover:bg-opacity-90"
        >
          View More
        </button>
      </div>

      <div className="flex flex-col">
        <div className="grid grid-cols-3 rounded-sm bg-gray-2 dark:bg-meta-4 sm:grid-cols-6">
          <div className="p-2.5 xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Title</h5>
          </div>
          <div className="p-2.5 text-center xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Company</h5>
          </div>
          <div className="p-2.5 text-center xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Location</h5>
          </div>
          <div className="hidden p-2.5 text-center sm:block xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Date</h5>
          </div>
          <div className="hidden p-2.5 text-center sm:block xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Severity</h5>
          </div>
          <div className="hidden p-2.5 text-center sm:block xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Status</h5>
          </div>
        </div>

        {tickets.map((ticket, key) => (
          <div
            className={`grid grid-cols-3 sm:grid-cols-6 ${
              key === tickets.length - 1
                ? ''
                : 'border-b border-stroke dark:border-strokedark'
            }`}
            key={ticket.id}
          >
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
      </div>
    </div>
  );
};

export default DashboardTicketList;
