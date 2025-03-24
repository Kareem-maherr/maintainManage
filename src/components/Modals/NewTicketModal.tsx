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
      } catch (err) {
        console.error('Error fetching engineers:', err);
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
    } catch (err) {
      console.error('Error creating ticket:', err);
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
    <div className="fixed inset-0 z-999999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-40" dir="rtl">
      <div className="relative w-full max-w-lg rounded-lg bg-white p-8 shadow-lg dark:bg-boxdark" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button
          onClick={onClose}
          className="absolute left-4 top-4 text-gray-500 hover:text-gray-700"
          aria-label="إغلاق"
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
          إنشاء تذكرة جديدة
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              الموضوع
            </label>
            <input
              type="text"
              value={ticketData.title}
              onChange={(e) => setTicketData({ ...ticketData, title: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
              placeholder="أدخل موضوع التذكرة"
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              المرسل
            </label>
            <input
              type="text"
              value={ticketData.sender}
              onChange={(e) => setTicketData({ ...ticketData, sender: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
              placeholder="اسم المرسل"
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              الشركة
            </label>
            <input
              type="text"
              value={ticketData.company}
              onChange={(e) => setTicketData({ ...ticketData, company: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
              placeholder="اسم الشركة"
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              الموقع
            </label>
            <input
              type="text"
              value={ticketData.location}
              onChange={(e) => setTicketData({ ...ticketData, location: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
              placeholder="موقع المشكلة"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                رقم المشروع
              </label>
              <input
                type="text"
                value={ticketData.projectNumber}
                onChange={(e) => setTicketData({ ...ticketData, projectNumber: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                placeholder="رقم المشروع"
              />
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                رقم الاتصال
              </label>
              <input
                type="text"
                value={ticketData.contactNumber}
                onChange={(e) => setTicketData({ ...ticketData, contactNumber: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                placeholder="رقم الاتصال"
              />
            </div>
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              الأولوية
            </label>
            <select
              value={ticketData.severity}
              onChange={(e) => setTicketData({ ...ticketData, severity: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option value="Low">منخفضة</option>
              <option value="Medium">متوسطة</option>
              <option value="High">عالية</option>
              <option value="Critical">حرجة</option>
            </select>
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              المهندس المسؤول
            </label>
            <select
              value={ticketData.responsibleEngineer}
              onChange={(e) => setTicketData({ ...ticketData, responsibleEngineer: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option value="">اختر المهندس المسؤول</option>
              {responsibleEngineers.map((engineer) => (
                <option key={engineer.id} value={engineer.email}>
                  {engineer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              تفاصيل التذكرة
            </label>
            <textarea
              value={ticketData.ticketDetails}
              onChange={(e) => setTicketData({ ...ticketData, ticketDetails: e.target.value })}
              className="h-32 w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              required
              placeholder="اكتب تفاصيل المشكلة هنا..."
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              ملاحظات إضافية
            </label>
            <textarea
              value={ticketData.notes}
              onChange={(e) => setTicketData({ ...ticketData, notes: e.target.value })}
              className="h-24 w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              المرفقات
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              accept="image/*,.pdf,.doc,.docx"
            />
            {ticketData.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {ticketData.attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-stroke px-6 py-2 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90 disabled:bg-opacity-50"
            >
              {submitting ? 'جاري الإنشاء...' : 'إنشاء التذكرة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewTicketModal;
