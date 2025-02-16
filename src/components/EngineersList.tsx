import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

interface Engineer {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: any;
}

const EngineersList = () => {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const engineersRef = collection(db, 'engineers');
    const q = query(engineersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const engineersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Engineer[];
      
      setEngineers(engineersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      <div className="flex justify-between mb-6">
        <h4 className="text-xl font-semibold text-black dark:text-white">Engineers</h4>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3 2xl:gap-7.5">
        {engineers.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            No engineers found.
          </div>
        ) : (
          engineers.map((engineer) => (
            <div key={engineer.id} className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="flex justify-between items-center mb-4">
                <h5 className="text-lg font-medium text-black dark:text-white">
                  {engineer.displayName}
                </h5>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 text-sm rounded-full ${
                    engineer.role === 'engineer' ? 'bg-meta-3 text-white' : 'bg-meta-6 text-white'
                  }`}>
                    {engineer.role}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                    {engineer.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-black dark:text-white">{engineer.email}</span>
                    <span className="text-xs text-gray-500">
                      Joined {new Date(engineer.createdAt?.seconds * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EngineersList;