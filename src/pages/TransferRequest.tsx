import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDoc,
  doc,
  getDocs,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import TransferTicketDetailsModal from '../components/Modals/TransferTicketDetailsModal';
import NewTicketModal from '../components/Modals/NewTicketModal';
import PDFGeneratorModal from '../components/Modals/PDFGeneratorModal';
import SetDateModal from '../components/Modals/SetDateModal';
import { useLanguage } from '../contexts/LanguageContext';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';

interface TransferRequest {
  id: string;
  title: string;
  company: string;
  location: string;
  createdAt: any;
  severity: string;
  status: string;
  responsible_engineer?: string;
  transfer_engineer?: string;
  hasUnreadMessages?: boolean;
  date?: any;
  isViewed?: boolean;
  isDateSet?: boolean;
  readableId?: string;
  sender?: string;
  noteStatus?: string;
}

interface FilterOptions {
  startDate: string;
  endDate: string;
  company: string;
  severity: string;
  status: string;
  location: string;
}

const TransferRequestPage = () => {
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [showSetDateModal, setShowSetDateModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: '',
    endDate: '',
    company: '',
    severity: '',
    status: '',
    location: '',
  });
  const [companies, setCompanies] = useState<string[]>([]);
  const [isEngineer, setIsEngineer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const auth = getAuth();
  const { t } = useLanguage();

  // Handle checkbox selection
  const handleRequestSelect = (requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectedRequests.size === filteredRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(filteredRequests.map(request => request.id)));
    }
  };

  // Handle group event creation
  const handleCreateGroupEvent = () => {
    if (selectedRequests.size > 0) {
      setShowSetDateModal(true);
    }
  };

  const severityOptions = [
    t('tickets.filters.all'),
    t('tickets.severity.critical'),
    t('tickets.severity.high'),
    t('tickets.severity.medium'),
    t('tickets.severity.low'),
  ];
  const statusOptions = [
    t('tickets.filters.all'),
    t('tickets.status.open'),
    t('tickets.status.inprogress'),
    t('tickets.status.resolved'),
  ];

  useEffect(() => {
    const fetchUserRoleAndRequests = async () => {
      if (!auth.currentUser) return;

      try {
        const currentUser = auth.currentUser;

        // Get user document to check role
        const userDocRef = doc(db, 'engineers', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
        
        const isUserEngineer = userData?.role === 'engineer';
        setIsEngineer(isUserEngineer);
        setIsAdmin(userData?.role === 'admin');
        
        // Set up real-time listener for transferred tickets
        let transferRequestsQuery;
        
        if (isUserEngineer && currentUser.email) {
          // Engineers see only tickets transferred to them
          transferRequestsQuery = query(
            collection(db, 'tickets'),
            where('transfer_engineer', '==', currentUser.email),
            orderBy('createdAt', 'desc')
          );
        } else {
          // Admins see all tickets that have been transferred (have transfer_engineer field)
          transferRequestsQuery = query(
            collection(db, 'tickets'),
            where('transfer_engineer', '!=', null),
            orderBy('createdAt', 'desc')
          );
        }

        const unsubscribe = onSnapshot(transferRequestsQuery, (snapshot) => {
          const requestsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as TransferRequest[];
          
          setTransferRequests(requestsData);
          setLoading(false);

          // Extract unique companies for filters
          const uniqueCompanies = [...new Set(requestsData.map(request => request.company))];
          setCompanies(uniqueCompanies);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching user role and transfer requests:', error);
        setLoading(false);
      }
    };

    fetchUserRoleAndRequests();
  }, [auth.currentUser]);

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      company: '',
      severity: '',
      status: '',
      location: '',
    });
  };

  // Generate a request ID from sender email and random number
  const generateRequestId = (request: TransferRequest) => {
    if (!request.sender) return 'Unknown';
    
    const emailPrefix = request.sender.split('@')[0];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${emailPrefix}-${randomNum}`;
  };

  // Handle click on Unknown request ID to generate a new readable ID
  const handleGenerateRequestId = async (e: React.MouseEvent, request: TransferRequest) => {
    e.stopPropagation();
    
    if (!request.sender) {
      console.error('Cannot generate ID: no sender email');
      return;
    }

    setGeneratingId(request.id);
    
    try {
      const newId = generateRequestId(request);
      
      const existingQuery = query(
        collection(db, 'transfer_requests'),
        where('readableId', '==', newId),
        limit(1)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        const timestamp = Date.now().toString().slice(-4);
        const uniqueId = `${newId}-${timestamp}`;
        
        await updateDoc(doc(db, 'transfer_requests', request.id), {
          readableId: uniqueId
        });
      } else {
        await updateDoc(doc(db, 'transfer_requests', request.id), {
          readableId: newId
        });
      }
    } catch (error) {
      console.error('Error generating request ID:', error);
    } finally {
      setGeneratingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return transferRequests.filter((request) => {
      const requestDate = request.createdAt?.toDate?.() || new Date(request.createdAt);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;

      const dateInRange =
        (!startDate || requestDate >= startDate) &&
        (!endDate || requestDate <= endDate);

      const companyMatch =
        !filters.company ||
        filters.company === t('tickets.filters.all') ||
        request.company.toLowerCase().includes(filters.company.toLowerCase());

      const severityMatch =
        !filters.severity ||
        filters.severity === t('tickets.filters.all') ||
        t(`tickets.severity.${request.severity.toLowerCase()}`) === filters.severity;

      const statusMatch =
        !filters.status ||
        filters.status === t('tickets.filters.all') ||
        t(`tickets.status.${request.status.toLowerCase().replace(' ', '')}`) === filters.status;

      const locationMatch =
        !filters.location ||
        filters.location === t('tickets.filters.all') ||
        request.location.toLowerCase().includes(filters.location.toLowerCase());

      return dateInRange && companyMatch && severityMatch && statusMatch && locationMatch;
    });
  }, [transferRequests, filters, t]);

  const getTimeElapsed = (createdAt: any) => {
    const now = new Date();
    const createdDate = createdAt?.toDate?.() || new Date(createdAt);
    const diffInMs = now.getTime() - createdDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInDays > 0) {
      return `${diffInDays} ${diffInDays === 1 ? t('tickets.table.day') : t('tickets.table.days')} ${t('tickets.table.ago')}`;
    } else if (diffInHours > 0) {
      return `${diffInHours} ${diffInHours === 1 ? t('tickets.table.hour') : t('tickets.table.hours')} ${t('tickets.table.ago')}`;
    } else {
      return `${diffInMinutes} ${diffInMinutes === 1 ? t('tickets.table.minute') : t('tickets.table.minutes')} ${t('tickets.table.ago')}`;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Transfer Requests" />
      
      <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="mb-6 flex justify-between items-center">
          <h4 className="text-xl font-semibold text-black dark:text-white">
            Transfer Requests
          </h4>
          <div className="flex gap-3">
            {selectedRequests.size > 0 && (
              <button
                onClick={handleCreateGroupEvent}
                className="inline-flex items-center justify-center rounded-md bg-green-600 py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 lg:px-6 xl:px-8"
              >
                Create Group Event ({selectedRequests.size})
              </button>
            )}
            {(isAdmin || isEngineer) && (
              <button
                onClick={() => setShowNewRequestModal(true)}
                className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 lg:px-6 xl:px-8"
              >
                Create Transfer Request
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowPDFModal(true)}
                className="inline-flex items-center justify-center rounded-md bg-secondary py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 lg:px-6 xl:px-8"
              >
                Generate PDF
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Company
            </label>
            <select
              name="company"
              value={filters.company}
              onChange={handleFilterChange}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            >
              <option value="">{t('tickets.filters.all')}</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Severity
            </label>
            <select
              name="severity"
              value={filters.severity}
              onChange={handleFilterChange}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            >
              {severityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Status
            </label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full rounded bg-gray-500 py-3 px-5 text-white hover:bg-gray-600"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="py-4 px-4 font-medium text-black dark:text-white">
                  <input
                    type="checkbox"
                    checked={selectedRequests.size === filteredRequests.length && filteredRequests.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="min-w-[220px] py-4 px-4 font-medium text-black dark:text-white xl:pl-11">
                  Request ID
                </th>
                <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                  Title
                </th>
                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                  Company
                </th>
                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                  Location
                </th>
                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                  Created
                </th>
                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                  Severity
                </th>
                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                  Status
                </th>
                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                  Date Set
                </th>
                {isEngineer && (
                  <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                    Note Status
                  </th>
                )}
                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                  Transferred To
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id} className={selectedRequests.has(request.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                  <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                    <input
                      type="checkbox"
                      checked={selectedRequests.has(request.id)}
                      onChange={() => handleRequestSelect(request.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11 cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-center gap-3">
                      {request.hasUnreadMessages && (
                        <div className="h-2 w-2 rounded-full bg-red-500"></div>
                      )}
                      <h5 className="font-medium text-black dark:text-white">
                        {request.readableId ? (
                          request.readableId
                        ) : (
                          <span 
                            className="text-blue-500 hover:text-blue-700 cursor-pointer underline"
                            onClick={(e) => handleGenerateRequestId(e, request)}
                          >
                            {generatingId === request.id ? 'Generating...' : 'Unknown (Click to generate)'}
                          </span>
                        )}
                      </h5>
                    </div>
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p className="text-black dark:text-white">{request.title}</p>
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p className="text-black dark:text-white">{request.company}</p>
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p className="text-black dark:text-white">{request.location}</p>
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p className="text-black dark:text-white">
                      {getTimeElapsed(request.createdAt)}
                    </p>
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p
                      className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${getSeverityColor(
                        request.severity,
                      )}`}
                    >
                      {t(`tickets.severity.${request.severity.toLowerCase()}`)}
                    </p>
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p
                      className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${getStatusColor(
                        request.status,
                      )}`}
                    >
                      {t(`tickets.status.${request.status.toLowerCase().replace(' ', '')}`)}
                    </p>
                  </td>
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p
                      className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${
                        request.isDateSet
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {request.isDateSet
                        ? t('tickets.table.dateSet')
                        : t('tickets.table.dateNotSet')}
                    </p>
                  </td>
                  {isEngineer && (
                    <td 
                      className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                      onClick={() => setSelectedRequest(request)}
                    >
                      {request.noteStatus ? (
                        <p
                          className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${
                            request.noteStatus === 'Quotation Sent' ? 'bg-teal-100 text-teal-800' :
                            request.noteStatus === 'Material Not Complete' ? 'bg-yellow-100 text-yellow-800' :
                            request.noteStatus === 'Material Complete' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {request.noteStatus}
                        </p>
                      ) : (
                        <p className="text-gray-500 italic">Not set</p>
                      )}
                    </td>
                  )}
                  <td 
                    className="border-b border-[#eee] py-5 px-4 dark:border-strokedark cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <p className="text-black dark:text-white">
                      {request.transfer_engineer || t('tickets.table.unassigned')}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedRequest && (
        <TransferTicketDetailsModal
          ticket={selectedRequest}
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}

      {showNewRequestModal && (
        <NewTicketModal
          onClose={() => setShowNewRequestModal(false)}
        />
      )}

      {showPDFModal && (
        <PDFGeneratorModal
          onClose={() => setShowPDFModal(false)}
        />
      )}

      {showSetDateModal && (
        <SetDateModal
          isOpen={showSetDateModal}
          tickets={filteredRequests.filter(request => selectedRequests.has(request.id))}
          onClose={() => {
            setShowSetDateModal(false);
            setSelectedRequests(new Set());
          }}
        />
      )}
    </>
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

export default TransferRequestPage;
