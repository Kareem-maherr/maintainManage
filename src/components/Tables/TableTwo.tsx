import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../config/firebase';

interface UserStats {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  ticketCount: number;
  lastLogin: Date | null;
  company: string;
}

const UsersList = () => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsersAndTickets = async () => {
      try {
        // Get all tickets to count per user
        const ticketsRef = collection(db, 'tickets');
        const ticketsSnapshot = await getDocs(ticketsRef);
        const ticketCounts: { [key: string]: number } = {};

        ticketsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.createdBy) {
            ticketCounts[data.createdBy] =
              (ticketCounts[data.createdBy] || 0) + 1;
          }
        });

        // Get all users from the users collection
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);

        const userData: UserStats[] = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            uid: doc.id,
            email: data.email || 'N/A',
            displayName: data.displayName || 'Anonymous User',
            photoURL: data.photoURL || null,
            ticketCount: ticketCounts[doc.id] || 0,
            lastLogin: data.lastLogin
              ? new Date(data.lastLogin.toDate())
              : null,
            company: data.company || 'Not Assigned',
          };
        });

        // Sort users by ticket count (highest first)
        userData.sort((a, b) => b.ticketCount - a.ticketCount);

        setUsers(userData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users and tickets:', error);
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
          System Users
        </h4>
      </div>

      <div className="grid grid-cols-7 border-t border-stroke py-4.5 px-4 dark:border-strokedark sm:grid-cols-8 md:px-6 2xl:px-7.5">
        <div className="col-span-3 flex items-center">
          <p className="font-medium">User</p>
        </div>
        <div className="col-span-2 hidden items-center sm:flex">
          <p className="font-medium">Company</p>
        </div>
        <div className="col-span-1 flex items-center">
          <p className="font-medium">Tickets</p>
        </div>
        <div className="col-span-2 flex items-center">
          <p className="font-medium">Last Login</p>
        </div>
      </div>

      {users.map((user, key) => (
        <div
          className="grid grid-cols-7 border-t border-stroke py-4.5 px-4 dark:border-strokedark sm:grid-cols-8 md:px-6 2xl:px-7.5"
          key={user.uid}
        >
          <div className="col-span-3 flex items-center">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-12.5 w-12.5 rounded-full">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4">
                    {user.displayName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
              </div>
              <p className="text-sm text-black dark:text-white">
                {user.displayName}
              </p>
            </div>
          </div>
          <div className="col-span-2 hidden items-center sm:flex">
            <p className="text-sm text-black dark:text-white">{user.company}</p>
          </div>
          <div className="col-span-1 flex items-center">
            <p className="text-sm text-meta-3">{user.ticketCount}</p>
          </div>
          <div className="col-span-2 flex items-center">
            <p className="text-sm text-black dark:text-white">
              {user.lastLogin ? user.lastLogin.toLocaleDateString() : 'Never'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UsersList;
