import { FC } from 'react';

interface TicketDetailsExpandedModalProps {
  ticketDetails: string;
  onClose: () => void;
}

const TicketDetailsExpandedModal: FC<TicketDetailsExpandedModalProps> = ({ ticketDetails, onClose }) => {
  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-40">
      <div className="relative w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg dark:bg-boxdark" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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

        <h2 className="mb-6 text-2xl font-bold text-black dark:text-white">
          Ticket Details
        </h2>

        <div className="bg-gray-50 p-6 rounded-lg dark:bg-meta-4">
          <div className="whitespace-pre-wrap text-black dark:text-white">
            {ticketDetails || 'No details provided for this ticket.'}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-primary py-2 px-6 font-medium text-white hover:shadow-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsExpandedModal;
