import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { notifyNewTicket } from '../../utils/notifications';
import { auth } from '../../config/firebase';

interface NewTicketModalProps {
  onClose: () => void;
}

interface TicketFormData {
  title: string;
  sender: string;
  company: string;
  location: string;
  date: string;
  time: string;
  severity: string;
  status: string;
  ticketDetails: string;
  notes: string;
  createdAt: any;
  responsibleEngineer: string;
  projectNumber: string;
  contactNumber: string;
  branch: string;
  attachments: File[];
}

const NewTicketModal: React.FC<NewTicketModalProps> = ({ onClose }) => {
  const [ticketData, setTicketData] = useState<TicketFormData>({
    title: '',
    sender: '',
    company: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    severity: 'Low',
    status: 'Open',
    ticketDetails: '',
    notes: '',
    createdAt: null,
    responsibleEngineer: '',
    projectNumber: '',
    contactNumber: '',
    branch: '',
    attachments: []
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responsibleEngineers, setResponsibleEngineers] = useState<Array<{ id: string; email: string; name: string }>>([]);

  useEffect(() => {
    const fetchResponsibleEngineers = async () => {
      try {
        const engineersRef = collection(db, 'engineers');
        const engineersQuery = query(engineersRef, where('role', '==', 'engineer'));
        const engineersSnapshot = await getDocs(engineersQuery);
        
        const engineersList = engineersSnapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          name: doc.data().name || doc.data().email // Use email as fallback if name is not set
        }));
        
        setResponsibleEngineers(engineersList);
      } catch (error) {
        console.error('Error fetching engineers:', error);
        setError('Failed to load engineers list');
      }
    };

    fetchResponsibleEngineers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      const user = auth.currentUser;
      if (!user) {
        console.error('No user logged in');
        return;
      }

      const newTicket = {
        title: ticketData.title,
        company: ticketData.company,
        location: ticketData.location,
        sender: ticketData.sender,
        severity: ticketData.severity,
        ticketDetails: ticketData.ticketDetails,
        notes: ticketData.notes,
        status: 'Open',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        projectNumber: ticketData.projectNumber,
        contactNumber: ticketData.contactNumber,
        branch: ticketData.branch,
        responsible_engineer: ticketData.responsibleEngineer ? responsibleEngineers.find(eng => eng.email === ticketData.responsibleEngineer)?.email : ''
      };

      console.log('Saving ticket with data:', newTicket); 
      const docRef = await addDoc(collection(db, 'tickets'), newTicket);
      await notifyNewTicket(docRef.id, ticketData.title);

      onClose();
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      setTicketData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...fileList]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setTicketData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-40">
      <div className="relative w-full max-w-lg rounded-lg bg-white p-8 shadow-lg dark:bg-boxdark" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <svg
            className="h-6 w-6"
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

        <h2 className="mb-6 text-2xl font-bold text-black dark:text-white">
          Create New Ticket
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Subject
            </label>
            <input
              type="text"
              value={ticketData.title}
              onChange={(e) => setTicketData({ ...ticketData, title: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Sender
            </label>
            <input
              type="text"
              value={ticketData.sender}
              onChange={(e) => setTicketData({ ...ticketData, sender: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Company
            </label>
            <input
              type="text"
              value={ticketData.company}
              onChange={(e) => setTicketData({ ...ticketData, company: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Location
            </label>
            <input
              type="text"
              value={ticketData.location}
              onChange={(e) => setTicketData({ ...ticketData, location: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Date
              </label>
              <input
                type="date"
                value={ticketData.date}
                readOnly
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Time
              </label>
              <input
                type="text"
                value={ticketData.time}
                readOnly
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input bg-gray-100 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Project Number
              </label>
              <input
                type="text"
                value={ticketData.projectNumber}
                onChange={(e) => setTicketData({ ...ticketData, projectNumber: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                required
              />
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Contact Number
              </label>
              <input
                type="tel"
                value={ticketData.contactNumber}
                onChange={(e) => setTicketData({ ...ticketData, contactNumber: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Branch
            </label>
            <input
              type="text"
              value={ticketData.branch}
              onChange={(e) => setTicketData({ ...ticketData, branch: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Severity
            </label>
            <select
              value={ticketData.severity}
              onChange={(e) => setTicketData({ ...ticketData, severity: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Assign to Engineer
            </label>
            <select
              value={ticketData.responsibleEngineer}
              onChange={(e) => {
                const selectedEngineer = responsibleEngineers.find(eng => eng.id === e.target.value);
                setTicketData({ 
                  ...ticketData, 
                  responsibleEngineer: selectedEngineer ? selectedEngineer.email : '' 
                });
              }}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option value="">Select Engineer</option>
              {responsibleEngineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {engineer.name} ({engineer.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Ticket Details
            </label>
            <textarea
              value={ticketData.ticketDetails}
              onChange={(e) => setTicketData({ ...ticketData, ticketDetails: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              rows={4}
              required
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Attachments
            </label>
            <div className="flex flex-col gap-3">
              <input
                type="file"
                onChange={handleFileChange}
                multiple
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
              {ticketData.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {ticketData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-meta-4 p-2 rounded">
                      <span className="text-sm truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:bg-opacity-90 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-white hover:bg-opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewTicketModal;
