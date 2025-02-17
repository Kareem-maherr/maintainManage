import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  sender: string;
  timestamp: any;
  isAdmin: boolean;
}

interface TicketChat {
  ticketId: string;
  title: string;
  lastMessage: string;
  timestamp: any;
  unreadCount: number;
}

const ChatCard = () => {
  const [ticketChats, setTicketChats] = useState<TicketChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    const fetchTicketChats = async () => {
      try {
        console.log('Fetching tickets...');
        // Query for tickets
        const ticketsRef = collection(db, 'tickets');
        const ticketsQuery = query(
          ticketsRef,
          orderBy('createdAt', 'desc'),
          limit(6),
        );

        // Get initial tickets
        const ticketsSnapshot = await getDocs(ticketsQuery);
        console.log('Tickets found:', ticketsSnapshot.size);

        // If no tickets, set loading to false and return
        if (ticketsSnapshot.empty) {
          console.log('No tickets found');
          setLoading(false);
          return;
        }

        // Set up listeners for each ticket's messages
        ticketsSnapshot.forEach((ticketDoc) => {
          const ticketData = ticketDoc.data();
          console.log('Processing ticket:', ticketDoc.id, ticketData);
          const messagesRef = collection(
            db,
            'tickets',
            ticketDoc.id,
            'messages',
          );
          const messagesQuery = query(
            messagesRef,
            orderBy('timestamp', 'desc'),
            limit(1),
          );

          const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            // Find the last non-admin message
            const lastMessage = snapshot.docs
              .find((doc) => {
                const msgData = doc.data() as TicketMessage;
                return msgData.sender !== 'admin@arabemerge.com';
              })
              ?.data() as TicketMessage | undefined;

            // Only create chat if there's a non-admin message
            if (lastMessage) {
              const chat: TicketChat = {
                ticketId: ticketDoc.id,
                title: ticketData.title || 'Untitled Ticket',
                lastMessage: lastMessage.content,
                timestamp: lastMessage.timestamp,
                unreadCount: 0,
              };

              setTicketChats((prev) => {
                const filtered = prev.filter(
                  (c) => c.ticketId !== chat.ticketId,
                );
                return [...filtered, chat].sort(
                  (a, b) =>
                    (b.timestamp?.toMillis() || 0) -
                    (a.timestamp?.toMillis() || 0),
                );
              });
            } else {
              // Remove this ticket from the list if it has no non-admin messages
              setTicketChats((prev) =>
                prev.filter((c) => c.ticketId !== ticketDoc.id),
              );
            }
          });

          unsubscribers.push(unsubscribe);
        });

        // Set loading to false after initial setup
        setLoading(false);
      } catch (error) {
        console.error('Error fetching ticket chats:', error);
        setLoading(false);
      }
    };

    fetchTicketChats();

    // Cleanup function
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const now = new Date();
      const messageDate = timestamp.toDate();
      const diffInMinutes = Math.floor(
        (now.getTime() - messageDate.getTime()) / (1000 * 60),
      );

      if (diffInMinutes < 60) return `${diffInMinutes}m`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
      return `${Math.floor(diffInMinutes / 1440)}d`;
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="col-span-12 rounded-sm border border-stroke bg-white py-6 shadow-default dark:border-strokedark dark:bg-boxdark xl:col-span-4">
      <h4 className="mb-6 px-7.5 text-xl font-semibold text-black dark:text-white">
        Ticket Conversations
      </h4>

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : ticketChats.length > 0 ? (
          ticketChats.map((chat) => (
            <Link
              to={`/tickets/${chat.ticketId}`}
              className="flex items-center gap-5 py-3 px-7.5 hover:bg-gray-3 dark:hover:bg-meta-4"
              key={chat.ticketId}
            >
              <div className="relative h-14 w-14 rounded-full bg-gray-2 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {chat.title.substring(0, 2).toUpperCase()}
                </span>
              </div>

              <div className="flex flex-1 items-center justify-between">
                <div>
                  <h5 className="font-medium text-black dark:text-white">
                    {chat.title}
                  </h5>
                  <p>
                    <span className="text-sm text-black dark:text-white">
                      {chat.lastMessage}
                    </span>
                    <span className="text-xs">
                      {' '}
                      · {getTimeAgo(chat.timestamp)}
                    </span>
                  </p>
                </div>
                {chat.unreadCount > 0 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <span className="text-sm font-medium text-white">
                      {chat.unreadCount}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            Under Implementation
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatCard;
