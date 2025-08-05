import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, Query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import TicketDetailsModal from '../Modals/TicketDetailsModal';
import NewTicketModal from '../Modals/NewTicketModal';
import { BsPlusLg, BsXLg } from 'react-icons/bs';

interface FullTicket {
  id: string;
  title: string;
  company: string;
  location: string;
  createdAt: any;
  severity: string;
  status: string;
}

interface FilterOptions {
  startDate: string;
  endDate: string;
  company: string;
  severity: string;
  status: string;
  location: string;
}

const FullTicketList = () => {
  const [tickets, setTickets] = useState<FullTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<FullTicket | null>(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: '',
    endDate: '',
    company: '',
    severity: '',
    status: '',
    location: ''
  });
  const [companies, setCompanies] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const severityOptions = ['All', 'Critical', 'High', 'Medium', 'Low'];
  const statusOptions = ['All', 'Open', 'In Progress', 'Resolved'];

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        let ticketsQuery = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
        
        // Apply filters
        if (filters.startDate) {
          const startTimestamp = Timestamp.fromDate(new Date(filters.startDate));
          ticketsQuery = query(ticketsQuery, where('createdAt', '>=', startTimestamp));
        }
        
        if (filters.endDate) {
          const endTimestamp = Timestamp.fromDate(new Date(filters.endDate + 'T23:59:59'));
          ticketsQuery = query(ticketsQuery, where('createdAt', '<=', endTimestamp));
        }
        
        if (filters.company && filters.company !== 'All') {
          ticketsQuery = query(ticketsQuery, where('company', '==', filters.company));
        }
        
        if (filters.severity && filters.severity !== 'All') {
          ticketsQuery = query(ticketsQuery, where('severity', '==', filters.severity));
        }
        
        if (filters.status && filters.status !== 'All') {
          ticketsQuery = query(ticketsQuery, where('status', '==', filters.status));
        }
        
        if (filters.location && filters.location !== 'All') {
          ticketsQuery = query(ticketsQuery, where('location', '==', filters.location));
        }

        const unsubscribe = onSnapshot(ticketsQuery, (querySnapshot) => {
          const ticketData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || '',
              company: data.company || data.companyName || 'N/A',
              location: data.location || '',
              createdAt: data.createdAt,
              severity: data.severity || 'Low',
              status: data.status || 'Open'
            } as FullTicket;
          });
          
          // Update unique companies and locations for filters
          const uniqueCompanies = [...new Set(ticketData.map(ticket => ticket.company))];
          const uniqueLocations = [...new Set(ticketData.map(ticket => ticket.location))];
          setCompanies(['All', ...uniqueCompanies]);
          setLocations(['All', ...uniqueLocations]);
          
          setTickets(ticketData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up ticket listener:', error);
        setLoading(false);
      }
    };

    fetchTickets();
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      company: '',
      severity: '',
      status: '',
      location: ''
    });
  };

  if (loading) {
    return (
      <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      {showNewTicketModal && (
        <NewTicketModal onClose={() => setShowNewTicketModal(false)} />
      )}
      
      {/* Filter Controls */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="mb-2.5 block text-black dark:text-white">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">End Date</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">Company</label>
          <select
            name="company"
            value={filters.company}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {companies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">Severity</label>
          <select
            name="severity"
            value={filters.severity}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {severityOptions.map(severity => (
              <option key={severity} value={severity}>{severity}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">Status</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2.5 block text-black dark:text-white">Location</label>
          <select
            name="location"
            value={filters.location}
            onChange={handleFilterChange}
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={() => setShowNewTicketModal(true)}
          className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-3 sm:px-6 text-white hover:bg-opacity-90"
        >
          <BsPlusLg className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Create New Ticket</span>
        </button>
        <button
          onClick={clearFilters}
          className="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-3 sm:px-6 text-center font-medium text-black hover:bg-opacity-90 dark:border-strokedark dark:text-white"
        >
          <BsXLg className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Clear Filters</span>
        </button>
      </div>

      {/* Ticket Table */}
      <div className="max-w-full overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-2 text-left dark:bg-meta-4">
              <th className="min-w-[220px] py-4 px-4 font-medium text-black dark:text-white xl:pl-11">
                Title
              </th>
              <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                Company
              </th>
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                Location
              </th>
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                Date
              </th>
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                Severity
              </th>
              <th className="py-4 px-4 font-medium text-black dark:text-white">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr 
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-meta-4"
              >
                <td className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11">
                  <h5 className="font-medium text-black dark:text-white">
                    {ticket.title}
                  </h5>
                </td>
                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                  <p className="text-black dark:text-white">{ticket.company}</p>
                </td>
                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                  <p className="text-black dark:text-white">{ticket.location}</p>
                </td>
                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                  <p className="text-black dark:text-white">
                    {ticket.createdAt?.toDate().toLocaleDateString()}
                  </p>
                </td>
                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                  <p className={getSeverityColor(ticket.severity)}>
                    {ticket.severity}
                  </p>
                </td>
                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                  <p className={`inline-flex rounded-full py-1 px-3 text-sm font-medium ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-green-500';
    default:
      return 'text-black dark:text-white';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'open':
      return 'bg-blue-100 text-blue-800';
    case 'in progress':
      return 'bg-purple-100 text-purple-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default FullTicketList;