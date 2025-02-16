import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

interface NotificationData {
  title: string;
  message: string;
  type: 'ticket' | 'system' | 'info';
  ticketId?: string;
}

export const addNotification = async (data: NotificationData) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      ...data,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding notification:', error);
  }
};

export const notifyNewTicket = async (ticketId: string, ticketTitle: string) => {
  await addNotification({
    title: 'New Ticket Created',
    message: `A new ticket "${ticketTitle}" has been created`,
    type: 'ticket',
    ticketId
  });
};

export const notifyTicketUpdated = async (ticketId: string, ticketTitle: string, updateType: string) => {
  await addNotification({
    title: 'Ticket Updated',
    message: `Ticket "${ticketTitle}" has been ${updateType}`,
    type: 'ticket',
    ticketId
  });
};

export const notifySystemMessage = async (title: string, message: string) => {
  await addNotification({
    title,
    message,
    type: 'system'
  });
};

export const notifyInfoMessage = async (title: string, message: string) => {
  await addNotification({
    title,
    message,
    type: 'info'
  });
};
