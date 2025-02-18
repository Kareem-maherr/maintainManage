import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { notifyTicketUpdated } from '../../utils/notifications';
import SetDateModal from './SetDateModal';

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: any;
  isAdmin: boolean;
}

interface TicketDetailsModalProps {
  ticket: any;
  onClose: () => void;
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

const TicketDetailsModal = ({ ticket, onClose }: TicketDetailsModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTicket, setEditedTicket] = useState(ticket);
  const [localTicket, setLocalTicket] = useState(ticket);
  const [isSetDateModalOpen, setIsSetDateModalOpen] = useState(false);

  useEffect(() => {
    // Mark messages as read when modal opens
    const ticketRef = doc(db, "tickets", ticket.id);
    updateDoc(ticketRef, {
      lastReadTimestamp: serverTimestamp()
    });

    // Set up ticket listener
    const unsubscribeTicket = onSnapshot(doc(db, "tickets", ticket.id), (doc) => {
      if (doc.exists()) {
        const updatedTicket = { id: doc.id, ...doc.data() };
        setLocalTicket(updatedTicket);
        setEditedTicket(updatedTicket);
      }
    });

    // Set up messages listener
    const messagesRef = collection(db, "tickets", ticket.id, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const messageData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(messageData);
    });

    return () => {
      unsubscribeTicket();
      unsubscribeMessages();
    };
  }, [ticket.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const messagesRef = collection(db, 'tickets', ticket.id, 'messages');
      await addDoc(messagesRef, {
        content: newMessage,
        sender: 'Admin', // Replace with actual user email
        isAdmin: true,
        timestamp: serverTimestamp(),
      });

      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleUpdateTicket = async () => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        ...editedTicket,
        updatedAt: serverTimestamp()
      });
      await notifyTicketUpdated(ticket.id, ticket.title, `updated`);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setLocalTicket(prev => ({ ...prev, status: newStatus }));
      await notifyTicketUpdated(ticket.id, ticket.title, `status changed to ${newStatus}`);
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        severity: newPriority,
        updatedAt: serverTimestamp()
      });
      setLocalTicket(prev => ({ ...prev, severity: newPriority }));
      await notifyTicketUpdated(ticket.id, ticket.title, `priority changed to ${newPriority}`);
    } catch (error) {
      console.error('Error updating ticket priority:', error);
    }
  };

  const handleAssignToUser = async (userId: string, userEmail: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        ownerId: userId,
        ownerEmail: userEmail
      });
      await notifyTicketUpdated(ticket.id, ticket.title, `assigned to ${userEmail}`);
    } catch (error) {
      console.error('Error assigning ticket:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-40">
      <div className="relative w-full max-w-xl rounded-lg bg-white p-8 shadow-lg dark:bg-boxdark">
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

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black dark:text-white">
            {isEditing ? (
              <input
                type="text"
                value={editedTicket.title}
                onChange={(e) =>
                  setEditedTicket({ ...editedTicket, title: e.target.value })
                }
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            ) : (
              ticket.title
            )}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Company</p>
            <p className="font-medium text-black dark:text-white">
              {ticket.company}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Location</p>
            <p className="font-medium text-black dark:text-white">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTicket.location}
                  onChange={(e) =>
                    setEditedTicket({ ...editedTicket, location: e.target.value })
                  }
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              ) : (
                localTicket.location
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Severity</p>
            <p className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${severityStyles[localTicket.severity as keyof typeof severityStyles]}`}>
              {isEditing ? (
                <select
                  value={editedTicket.severity}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              ) : (
                localTicket.severity
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
            <p className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusStyles[localTicket.status as keyof typeof statusStyles]}`}>
              {isEditing ? (
                <select
                  value={editedTicket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              ) : (
                localTicket.status
              )}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold text-black dark:text-white">
            Messages
          </h3>
          <div className="max-h-60 overflow-y-auto rounded border border-stroke p-4 dark:border-strokedark">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 rounded-lg p-3 ${
                  message.isAdmin
                    ? "bg-primary bg-opacity-10 ml-auto"
                    : "bg-gray-100 dark:bg-meta-4"
                }`}
              >
                <p className="text-sm font-medium text-black dark:text-white">
                  {message.sender}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {message.content}
                </p>
                <p className="text-xs text-gray-400">
                  {message.timestamp?.toDate().toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSendMessage} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-white hover:bg-opacity-90"
            >
              Send
            </button>
          </div>
        </form>

        <div className="flex justify-between">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center justify-center rounded-md border border-primary bg-white px-6 py-2 text-center font-medium text-primary hover:bg-opacity-90 dark:border-primary dark:bg-primary dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTicket}
                className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-white hover:bg-opacity-90"
              >
                Save Changes
              </button>
            </>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={() => setIsSetDateModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-primary bg-primary px-6 py-2 text-center font-medium text-white hover:bg-opacity-90"
              >
                Set Date
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-white hover:bg-opacity-90"
              >
                Edit Ticket
              </button>
            </div>
          )}
        </div>

        {/* Set Date Modal */}
        <SetDateModal
          isOpen={isSetDateModalOpen}
          onClose={() => setIsSetDateModalOpen(false)}
          ticket={ticket}
        />
      </div>
    </div>
  );
};

export default TicketDetailsModal;
