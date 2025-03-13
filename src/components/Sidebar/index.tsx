import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Logo from '../../../public/trace.svg';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faGrip,
  faCalendarDays,
  faTicket,
  faUsers,
  faTable,
  faUser,
  faUsersGear,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (arg: boolean) => void;
}

const Sidebar = ({ sidebarOpen, setSidebarOpen }: SidebarProps) => {
  const location = useLocation();
  const { pathname } = location;
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);

  const trigger = useRef<any>(null);
  const sidebar = useRef<any>(null);

  const storedSidebarExpanded = localStorage.getItem('sidebar-expanded');
  const [sidebarExpanded, setSidebarExpanded] = useState(
    storedSidebarExpanded === null ? false : storedSidebarExpanded === 'true',
  );

  const handleSidebarExpanded = () => {
    setSidebarExpanded(prev => !prev);
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (currentUser?.uid) {
        const engineerDoc = await getDoc(doc(db, 'engineers', currentUser.uid));
        setIsAdmin(engineerDoc.data()?.role === 'admin');
      }
    };
    checkAdminStatus();
  }, [currentUser]);

  // close on click outside
  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (!sidebar.current || !trigger.current) return;
      if (
        !sidebarOpen ||
        sidebar.current.contains(target) ||
        trigger.current.contains(target)
      )
        return;
      setSidebarOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }: KeyboardEvent) => {
      if (!sidebarOpen || keyCode !== 27) return;
      setSidebarOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  });

  useEffect(() => {
    localStorage.setItem('sidebar-expanded', sidebarExpanded.toString());
    if (sidebarExpanded) {
      document.querySelector('body')?.classList.add('sidebar-expanded');
    } else {
      document.querySelector('body')?.classList.remove('sidebar-expanded');
    }
  }, [sidebarExpanded]);

  return (
    <aside
      ref={sidebar}
      className={`absolute left-0 top-0 z-9999 flex h-screen w-72.5 flex-col overflow-y-hidden bg-black duration-300 ease-linear dark:bg-boxdark lg:static lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* <!-- SIDEBAR HEADER --> */}
      <div className="flex items-center justify-between gap-2 px-6 pt-5">
        <NavLink to="/" className="flex items-center gap-2">
          <img src={Logo} alt="Trace Logo" width={154} height={32} />
        </NavLink>

        <button
          ref={trigger}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-controls="sidebar"
          aria-expanded={sidebarOpen}
          className="block lg:hidden"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5 text-white" />
        </button>
      </div>
      {/* <!-- SIDEBAR HEADER --> */}

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        {/* <!-- Sidebar Menu --> */}
        <nav className="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
          {/* <!-- Menu Group --> */}
          <div>
            <h3 className="mb-4 ml-4 text-sm font-semibold text-bodydark2">
              {t('navigation.menu')}
            </h3>

            <ul className="mb-6 flex flex-col gap-1.5">
              {/* <!-- Menu Item Dashboard --> */}
              <li>
                <NavLink
                  to="/"
                  className={`group relative flex items-center gap-2.5 rounded-sm px-4 py-2 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                    pathname === '/' && 'bg-graydark dark:bg-meta-4'
                  }`}
                >
                  <FontAwesomeIcon icon={faGrip} className="h-5 w-5" />
                  {t('navigation.dashboard')}
                </NavLink>
              </li>

              <li className="my-3 h-px bg-gray-700"></li>

              <li>
                <NavLink
                  to="/calendar"
                  className={`group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                    pathname === '/calendar' && 'bg-graydark dark:bg-meta-4'
                  }`}
                >
                  <FontAwesomeIcon icon={faCalendarDays} className="h-5 w-5" />
                  {t('navigation.calendar')}
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/calendar-tickets"
                  className={`group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                    pathname === '/calendar-tickets' &&
                    'bg-graydark dark:bg-meta-4'
                  }`}
                >
                  <FontAwesomeIcon icon={faTicket} className="h-5 w-5" />
                  {t('navigation.scheduledTickets')}
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/tables"
                  className={`group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                    pathname.includes('tables') && 'bg-graydark dark:bg-meta-4'
                  }`}
                >
                  <FontAwesomeIcon icon={faTable} className="h-5 w-5" />
                  {t('navigation.emergencyTickets')}
                </NavLink>
              </li>

              <li className="my-3 h-px bg-gray-700"></li>

              <li>
                <NavLink
                  to="/profile"
                  className={`group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                    pathname.includes('profile') && 'bg-graydark dark:bg-meta-4'
                  }`}
                >
                  <FontAwesomeIcon icon={faUser} className="h-5 w-5" />
                  {t('navigation.clientList')}
                </NavLink>
              </li>

              {isAdmin && (
                <>
                  <li className="my-3 h-px bg-gray-700"></li>

                  <li>
                    <NavLink
                      to="/teams"
                      className={`group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                        pathname.includes('teams') && 'bg-graydark dark:bg-meta-4'
                      }`}
                    >
                      <FontAwesomeIcon icon={faUsers} className="h-5 w-5" />
                      {t('navigation.teams')}
                    </NavLink>
                  </li>

                  <li>
                    <NavLink
                      to="/engineers"
                      className={`group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                        pathname.includes('engineers') &&
                        'bg-graydark dark:bg-meta-4'
                      }`}
                    >
                      <FontAwesomeIcon icon={faUsersGear} className="h-5 w-5" />
                      {t('navigation.engineers')}
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>
        {/* <!-- Sidebar Menu --> */}
      </div>
    </aside>
  );
};

export default Sidebar;
