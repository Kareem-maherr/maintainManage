import { useState } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../config/firebase';
import SetDateModal from './SetDateModal';

interface TransferTicketDetailsModalProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
}

const TransferTicketDetailsModal = ({ ticket, isOpen, onClose }: TransferTicketDetailsModalProps) => {
  const [isSetDateModalOpen, setIsSetDateModalOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  if (!isOpen) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in progress':
      case 'inprogress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'transferred':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRejectTransfer = async () => {
    if (!ticket.id) return;
    
    setIsRejecting(true);
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        transfer_engineer: deleteField()
      });
      
      // Close modal after successful rejection
      onClose();
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      alert('Failed to reject transfer. Please try again.');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full backdrop-blur-sm transition-opacity flex items-center justify-center z-50">
        <div className="relative mx-auto p-6 border w-[700px] shadow-xl rounded-xl bg-white transition-all transform">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Transfer Request Details
              </h2>
              <p className="text-sm text-gray-500">
                Ticket ID: {ticket.ticketId ? (
                  <span className="font-medium">{ticket.ticketId}</span>
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
            <span
              className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${getSeverityColor(ticket.severity)}`}
            >
              {ticket.severity}
            </span>
            <span
              className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${getStatusColor(ticket.status)}`}
            >
              {ticket.status}
            </span>
          </div>

          {/* Ticket Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Ticket Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-gray-700 mr-2">Title:</span>
                  <span className="text-gray-900">{ticket.title}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium text-gray-700 mr-2">Email:</span>
                  <span className="text-gray-900">{ticket.email}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-medium text-gray-700 mr-2">Company:</span>
                  <span className="text-gray-900">{ticket.company}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium text-gray-700 mr-2">Location:</span>
                  <span className="text-gray-900">{ticket.location}</span>
                </div>
                {ticket.projectNumber && (
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="font-medium text-gray-700 mr-2">Project #:</span>
                    <span className="text-gray-900">{ticket.projectNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Transfer Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span className="font-medium text-gray-700 mr-2">Transferred To:</span>
                  <span className="text-gray-900">{ticket.transfer_engineer || 'Not assigned'}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium text-gray-700 mr-2">Original Engineer:</span>
                  <span className="text-gray-900">{ticket.responsible_engineer || 'Not assigned'}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-gray-700 mr-2">Created:</span>
                  <span className="text-gray-900">
                    {ticket.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Details
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {ticket.ticketDetails || ticket.details || 'No details provided'}
            </p>
          </div>

          {/* Notes Section */}
          {ticket.notes && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Notes
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {ticket.notes}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleRejectTransfer}
              disabled={isRejecting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {isRejecting ? 'Rejecting...' : 'Reject Transfer'}
            </button>
            <button
              onClick={() => setIsSetDateModalOpen(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Set Date
            </button>
          </div>
        </div>
      </div>

      {/* SetDateModal */}
      {isSetDateModalOpen && (
        <SetDateModal
          isOpen={isSetDateModalOpen}
          tickets={[ticket]}
          onClose={() => setIsSetDateModalOpen(false)}
        />
      )}
    </>
  );
};

export default TransferTicketDetailsModal;
