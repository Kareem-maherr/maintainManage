import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { notifyTicketUpdated } from '../../utils/notifications';
import SetDateModal from './SetDateModal';
import TicketDetailsExpandedModal from './TicketDetailsExpandedModal';
import { getAuth } from 'firebase/auth';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
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

const noteStatusStyles = {
  "Quotation Sent": "bg-teal-100 text-teal-800",
  "Material Not Complete": "bg-yellow-100 text-yellow-800",
  "Material Complete": "bg-green-100 text-green-800",
};

const TicketDetailsModal = ({ ticket, onClose }: TicketDetailsModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTicket, setEditedTicket] = useState(ticket);
  const [localTicket, setLocalTicket] = useState(ticket);
  const [isSetDateModalOpen, setIsSetDateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEngineer, setIsEngineer] = useState(false);
  const auth = getAuth();
  const currentUserEmail = auth.currentUser?.email;

  useEffect(() => {
    // Check if current user is an engineer
    const checkUserRole = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userDocRef = doc(db, 'engineers', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsEngineer(userData?.role === 'engineer');
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };
    
    checkUserRole();
    
    // Mark messages as read when modal opens
    const ticketRef = doc(db, "tickets", ticket.id);
    updateDoc(ticketRef, {
      lastReadTimestamp: serverTimestamp(),
      isViewed: true
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

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('No user logged in to send message');
      return;
    }

    try {
      const messagesRef = collection(db, 'tickets', ticket.id, 'messages');
      await addDoc(messagesRef, {
        text: newMessage,
        sender: currentUser.email || 'Unknown User',
        isAdmin: !isEngineer,
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
  
  const handleNoteChange = async (noteStatus: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        noteStatus: noteStatus,
        updatedAt: serverTimestamp()
      });
      setLocalTicket(prev => ({ ...prev, noteStatus: noteStatus }));
      setEditedTicket(prev => ({ ...prev, noteStatus: noteStatus }));
      await notifyTicketUpdated(ticket.id, ticket.title, `note status changed to ${noteStatus}`);
    } catch (error) {
      console.error('Error updating note status:', error);
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
                />
              ) : (
                <span className="hover:text-primary transition-colors">{ticket.title}</span>
              )}
            </h2>
            <p className="text-sm text-gray-500">
              Ticket ID: {localTicket.ticketId ? (
                <span className="font-medium">{localTicket.ticketId}</span>
              ) : (
                <span>#{ticket.id}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
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

        {/* Status and Severity */}
        <div className="flex items-center space-x-4 mb-6">
          {isEditing ? (
            <>
              <select
                value={editedTicket.severity}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select
                value={editedTicket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
              {isEngineer && (
                <select
                  value={editedTicket.noteStatus || ''}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                >
                  <option value="">Select Note Status</option>
                  <option value="Quotation Sent">Quotation Sent</option>
                  <option value="Material Not Complete">Material Not Complete</option>
                  <option value="Material Complete">Material Complete</option>
                </select>
              )}
            </>
          ) : (
            <>
              <span
                className={`px-4 py-2 text-sm font-semibold rounded-lg ${severityStyles[localTicket.severity as keyof typeof severityStyles]} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => setIsEditing(true)}
              >
                {localTicket.severity}
              </span>
              <span
                className={`px-4 py-2 text-sm font-semibold rounded-lg ${statusStyles[localTicket.status as keyof typeof statusStyles]} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => setIsEditing(true)}
              >
                {localTicket.status}
              </span>
              {isEngineer && localTicket.noteStatus && (
                <span
                  className={`px-4 py-2 text-sm font-semibold rounded-lg ${noteStatusStyles[localTicket.noteStatus as keyof typeof noteStatusStyles]} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => setIsEditing(true)}
                >
                  {localTicket.noteStatus}
                </span>
              )}
            </>
          )}
          {isEditing ? (
            <div className="flex space-x-2 ml-auto">
              <button
                onClick={handleUpdateTicket}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedTicket(localTicket);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-primary hover:bg-primary hover:text-white border border-primary rounded-lg transition-all"
              >
                Edit Ticket
              </button>
              <button
                onClick={() => setIsSetDateModalOpen(true)}
                className="px-4 py-2 text-primary hover:bg-primary hover:text-white border border-primary rounded-lg transition-all"
              >
                Set Date
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Ticket Information */}
          <div className="col-span-1">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Ticket Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-gray-900">{ticket.email}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-900">{localTicket.location}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-gray-900">{ticket.company}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-gray-900">{localTicket.projectNumber}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Details
                </h3>
                {!isEditing && localTicket.ticketDetails && (
                  <button
                    onClick={() => setIsDetailsModalOpen(true)}
                    className="text-sm text-primary hover:text-primary/80 flex items-center"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      ></path>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      ></path>
                    </svg>
                    View Full Details
                  </button>
                )}
              </div>
              {isEditing ? (
                <textarea
                  value={editedTicket.details || ''}
                  onChange={(e) =>
                    setEditedTicket({ ...editedTicket, details: e.target.value })
                  }
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-2 px-4 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input min-h-[100px]"
                  placeholder="Enter ticket details..."
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap max-h-[100px] overflow-hidden">
                  {localTicket.ticketDetails || 'No details provided'}
                </p>
              )}
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Notes
              </h3>
              {isEditing ? (
                <textarea
                  value={editedTicket.notes || ''}
                  onChange={(e) =>
                    setEditedTicket({ ...editedTicket, notes: e.target.value })
                  }
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-2 px-4 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input min-h-[100px]"
                  placeholder="Enter ticket details..."
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {localTicket.notes || 'No Notes provided'}
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Conversation */}
          <div className="col-span-2 flex flex-col">
            <div className="bg-gray-50 p-4 rounded-lg flex-1 mb-4 max-h-[400px] overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Conversation
              </h3>
              <div className="space-y-4">
                {messages.map((message) => {
                  const isCurrentUserSender = message.sender === currentUserEmail;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUserSender ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          isCurrentUserSender
                            ? "bg-blue-100 text-blue-900"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <div className="text-xs font-medium mb-1">
                          {message.sender} •{" "}
                          {message.timestamp?.toDate().toLocaleString()}
                        </div>
                        <div className="text-sm">{message.text}</div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 text-sm">
                    No messages yet. Start the conversation!
                  </div>
                )}
              </div>
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </button>
            </form>
          </div>
        </div>

        {isSetDateModalOpen && (
          <SetDateModal
            isOpen={isSetDateModalOpen}
            ticket={localTicket}
            onClose={() => setIsSetDateModalOpen(false)}
          />
        )}
        
        {isDetailsModalOpen && (
          <TicketDetailsExpandedModal
            ticketDetails={localTicket.ticketDetails || ''}
            onClose={() => setIsDetailsModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default TicketDetailsModal;