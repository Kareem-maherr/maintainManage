import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  type: string;
  ticketId?: string;
}

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(notification => 
        updateDoc(doc(db, 'notifications', notification.id), {
          read: true
        })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative flex h-8.5 w-8.5 items-center justify-center rounded-full border-[0.5px] border-stroke bg-gray hover:text-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
      >
        <svg
          className="fill-current duration-300 ease-in-out"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16.1999 14.9343L15.6374 14.0624C15.5249 13.8937 15.4687 13.7249 15.4687 13.528V7.67803C15.4687 6.01865 14.7655 4.47178 13.4718 3.31865C12.4312 2.39053 11.0812 1.7999 9.64678 1.6874V1.1249C9.64678 0.787402 9.36553 0.478027 8.9999 0.478027C8.6624 0.478027 8.35303 0.759277 8.35303 1.1249V1.65928C4.97178 1.96865 2.4749 4.82178 2.4749 8.23115V13.528C2.4749 13.7249 2.41865 13.8937 2.30615 14.0343L1.7999 14.9343C1.63115 15.2155 1.63115 15.553 1.7999 15.8343C1.96865 16.0874 2.27803 16.2562 2.64365 16.2562H15.3562C15.7218 16.2562 16.0312 16.0874 16.1999 15.8343C16.3687 15.553 16.3687 15.2155 16.1999 14.9343ZM3.23428 14.9905L3.43115 14.653C3.5999 14.3718 3.68428 14.0343 3.68428 13.6968V8.23115C3.68428 5.17803 6.1499 2.74053 9.17490 2.74053C10.8749 2.74053 12.4312 3.42803 13.6218 4.64678C14.7843 5.83740 15.4687 7.36553 15.4687 8.98115V13.6968C15.4687 14.0343 15.553 14.3718 15.7218 14.653L15.9187 14.9905H3.23428Z"
            fill=""
          />
          <path
            d="M8.9999 16.8094C9.83115 16.8094 10.553 16.1437 10.553 15.2562H7.4749C7.4749 16.1437 8.16865 16.8094 8.9999 16.8094Z"
            fill=""
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-meta-1 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute -right-27 mt-2.5 flex h-90 w-75 flex-col rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark sm:right-0 sm:w-80">
          <div className="px-4.5 py-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-bodydark2">Notifications</h5>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs hover:text-primary"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          <ul className="flex h-auto flex-col overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="flex flex-col gap-2.5 border-t border-stroke px-4.5 py-3 hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4">
                <p className="text-sm">No notifications</p>
              </li>
            ) : (
              notifications.map((notification) => (
                <li
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`flex flex-col gap-2.5 border-t border-stroke px-4.5 py-3 hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4 ${
                    !notification.read ? 'bg-gray-1 dark:bg-meta-3' : ''
                  }`}
                >
                  <p className="text-sm">
                    <span className="font-medium text-black dark:text-white">
                      {notification.title}
                    </span>{' '}
                    {notification.message}
                  </p>
                  <p className="text-xs">
                    {notification.createdAt?.toDate().toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
