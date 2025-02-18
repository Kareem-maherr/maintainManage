import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../config/firebase';

interface UserStats {
  uid: string;
  company: string;
  contactName: string;
  email: string;
  phoneNumber: string;
  ticketCount: number;
}

const UsersList = () => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsersAndTickets = async () => {
      try {
        // Get all tickets to count per company
        const ticketsRef = collection(db, 'tickets');
        const ticketsSnapshot = await getDocs(ticketsRef);
        const ticketCounts: { [key: string]: number } = {};

        ticketsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.company) {
            ticketCounts[data.company] = (ticketCounts[data.company] || 0) + 1;
          }
        });

        // Get all users from the users collection who are clients
        const usersRef = collection(db, 'users');
        const clientsQuery = query(usersRef, where('role', '==', 'client'));
        const usersSnapshot = await getDocs(clientsQuery);

        const userData: UserStats[] = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            uid: doc.id,
            company: data.company || 'N/A',
            contactName: data.name || 'N/A',
            email: data.email || 'N/A',
            phoneNumber: data.phoneNumber || 'N/A',
            ticketCount: ticketCounts[data.company] || 0
          };
        });

        // Sort users by company name
        userData.sort((a, b) => a.company.localeCompare(b.company));

        setUsers(userData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching clients and tickets:', error);
        setLoading(false);
      }
    };

    fetchUsersAndTickets();
  }, []);

  if (loading) {
    return (
      <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="py-6 px-4 md:px-6 xl:px-7.5">
        <h4 className="text-xl font-semibold text-black dark:text-white">
          Client List
        </h4>
      </div>

      <div className="grid grid-cols-12 border-t border-stroke py-4.5 px-4 dark:border-strokedark md:px-6 2xl:px-7.5">
        <div className="col-span-3 flex items-center">
          <p className="font-medium font-semibold">Company</p>
        </div>
        <div className="col-span-2 flex items-center">
          <p className="font-medium font-semibold">Contact Name</p>
        </div>
        <div className="col-span-3 flex items-center">
          <p className="font-medium font-semibold">Email</p>
        </div>
        <div className="col-span-2 flex items-center">
          <p className="font-medium font-semibold">Phone Number</p>
        </div>
        <div className="col-span-2 flex items-center">
          <p className="font-medium font-semibold">Tickets Created</p>
        </div>
      </div>

      {users.map((user) => (
        <div
          className="grid grid-cols-12 border-t border-stroke py-4.5 px-4 dark:border-strokedark md:px-6 2xl:px-7.5"
          key={user.uid}
        >
          <div className="col-span-3 flex items-center">
            <p className="text-sm text-black dark:text-white">{user.company}</p>
          </div>
          <div className="col-span-2 flex items-center">
            <p className="text-sm text-black dark:text-white">{user.contactName}</p>
          </div>
          <div className="col-span-3 flex items-center">
            <p className="text-sm text-black dark:text-white">{user.email}</p>
          </div>
          <div className="col-span-2 flex items-center">
            <p className="text-sm text-black dark:text-white">{user.phoneNumber}</p>
          </div>
          <div className="col-span-2 flex items-center">
            <p className="text-sm text-meta-3">{user.ticketCount}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UsersList;
