import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface Engineer {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface TransferRequestModalProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
}

const TransferRequestModal = ({ ticket, isOpen, onClose }: TransferRequestModalProps) => {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEngineers();
    }
  }, [isOpen]);

  const fetchEngineers = async () => {
    setLoading(true);
    try {
      const engineersSnapshot = await getDocs(collection(db, 'engineers'));
      const engineersData = engineersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((engineer: any) => engineer.role === 'engineer') as Engineer[];
      
      setEngineers(engineersData);
    } catch (error) {
      console.error('Error fetching engineers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedEngineer) {
      alert('Please select an engineer to transfer the ticket to.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        transfer_engineer: selectedEngineer,
        updatedAt: serverTimestamp(),
        status: 'Transferred' // Optional: update status to indicate transfer
      });

      alert('Ticket transferred successfully!');
      onClose();
    } catch (error) {
      console.error('Error transferring ticket:', error);
      alert('Error transferring ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedEngineer('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full backdrop-blur-sm transition-opacity flex items-center justify-center z-50">
      <div className="relative mx-auto p-6 border w-[500px] shadow-xl rounded-xl bg-white transition-all transform">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Transfer Ticket
            </h2>
            <p className="text-sm text-gray-600">
              Transfer ticket "{ticket.title}" to another engineer
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Engineer
          </label>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-gray-600">Loading engineers...</span>
            </div>
          ) : (
            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-4 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
            >
              <option value="">Select an engineer...</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.email}>
                  {engineer.name || engineer.email} ({engineer.email})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Current Assignment Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Current Assignment</h3>
          <p className="text-sm text-gray-600">
            Currently assigned to: {ticket.responsible_engineer || 'Unassigned'}
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedEngineer || isSubmitting}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Transferring...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Transfer Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferRequestModal;
