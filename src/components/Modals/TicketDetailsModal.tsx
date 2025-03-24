import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import { auth } from '../../config/firebase';

interface TicketDetailsModalProps {
  ticket: any;
  onClose: () => void;
}

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: any;
  isAdmin: boolean;
}

const severityStyles = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Low: "bg-green-100 text-green-800",
};

const statusStyles = {
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-purple-100 text-purple-800",
  Resolved: "bg-green-100 text-green-800",
};

const severityLabels = {
  Critical: "حرج",
  High: "عالي",
  Medium: "متوسط",
  Low: "منخفض"
} as const;

const statusLabels = {
  Open: "مفتوح",
  "In Progress": "قيد التنفيذ",
  Resolved: "تم الحل"
} as const;

const TicketDetailsModal = ({ ticket, onClose }: TicketDetailsModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTicket, setEditedTicket] = useState(ticket);

  const handlePriorityChange = (value: keyof typeof severityLabels) => {
    setEditedTicket({ ...editedTicket, severity: value });
  };

  const handleStatusChange = (value: keyof typeof statusLabels) => {
    setEditedTicket({ ...editedTicket, status: value });
  };

  useEffect(() => {
    const messagesRef = collection(db, 'tickets', ticket.id, 'messages');
    const q = query(messagesRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData: Message[] = [];
      snapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(messagesData.sort((a, b) => a.timestamp?.toDate() - b.timestamp?.toDate()));
    });

    return () => unsubscribe();
  }, [ticket.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      const messagesRef = collection(db, 'tickets', ticket.id, 'messages');
      await addDoc(messagesRef, {
        content: newMessage,
        sender: user.displayName || user.email,
        timestamp: serverTimestamp(),
        isAdmin: true
      });
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleUpdateTicket = async () => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        ...editedTicket,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating ticket:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full backdrop-blur-sm transition-opacity flex items-center justify-center">
      <div className="relative mx-auto p-6 border w-[800px] shadow-xl rounded-xl bg-white transition-all transform">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTicket.title}
                  onChange={(e) =>
                    setEditedTicket({ ...editedTicket, title: e.target.value })
                  }
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-2 px-4 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                  placeholder="عنوان التذكرة"
                />
              ) : (
                <span className="hover:text-primary transition-colors">{ticket.title}</span>
              )}
            </h2>
            <p className="text-sm text-gray-500">رقم التذكرة: #{ticket.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="إغلاق"
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

        {/* Status and Severity */}
        <div className="flex items-center space-x-4 mb-6">
          {isEditing ? (
            <>
              <select
                value={editedTicket.severity}
                onChange={(e) => handlePriorityChange(e.target.value as keyof typeof severityLabels)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="Low">منخفضة</option>
                <option value="Medium">متوسطة</option>
                <option value="High">عالية</option>
                <option value="Critical">حرجة</option>
              </select>
              <select
                value={editedTicket.status}
                onChange={(e) => handleStatusChange(e.target.value as keyof typeof statusLabels)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="Open">مفتوح</option>
                <option value="In Progress">قيد التنفيذ</option>
                <option value="Resolved">تم الحل</option>
              </select>
            </>
          ) : (
            <>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${severityStyles[editedTicket.severity as keyof typeof severityStyles]}`}>
                {severityLabels[editedTicket.severity as keyof typeof severityLabels]}
              </span>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusStyles[editedTicket.status as keyof typeof statusStyles]}`}>
                {statusLabels[editedTicket.status as keyof typeof statusLabels]}
              </span>
            </>
          )}
        </div>

        {/* Details Section */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">تفاصيل التذكرة</h3>
            {isEditing ? (
              <textarea
                value={editedTicket.description}
                onChange={(e) =>
                  setEditedTicket({ ...editedTicket, description: e.target.value })
                }
                className="w-full h-32 rounded-lg border-[1.5px] border-stroke bg-transparent py-2 px-4 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                placeholder="أدخل تفاصيل التذكرة"
              />
            ) : (
              <p className="text-gray-600">{ticket.description}</p>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">معلومات إضافية</h3>
            <div className="space-y-2">
              <p><span className="font-medium">المسؤول:</span> {ticket.assignedTo}</p>
              <p><span className="font-medium">تاريخ الإنشاء:</span> {new Date(ticket.createdAt?.toDate()).toLocaleDateString('ar-SA')}</p>
              <p><span className="font-medium">آخر تحديث:</span> {new Date(ticket.updatedAt?.toDate()).toLocaleDateString('ar-SA')}</p>
            </div>
          </div>
        </div>

        {/* Messages Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">الرسائل</h3>
          <div className="space-y-4 max-h-60 overflow-y-auto mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isAdmin ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.isAdmin ? 'bg-primary text-white' : 'bg-gray-100'
                }`}>
                  <p className="text-sm">{message.content}</p>
                  <span className="text-xs opacity-75">
                    {message.sender} - {new Date(message.timestamp?.toDate()).toLocaleTimeString('ar-SA')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 rounded-lg border-[1.5px] border-stroke bg-transparent py-2 px-4 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              placeholder="اكتب رسالتك هنا..."
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-white hover:bg-opacity-90"
            >
              إرسال
            </button>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end mt-6 space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleUpdateTicket}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-opacity-90"
              >
                حفظ التغييرات
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-primary hover:text-opacity-90"
            >
              تعديل التذكرة
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
