import { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';

interface FilterTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: { status: string; engineer: string }) => void;
  events: Array<{
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    teamName: string;
    projectName: string;
    responsibleEngineer?: string;
    resolved?: boolean;
  }>;
}

const FilterTicketsModal = ({ isOpen, onClose, onApplyFilters, events }: FilterTicketsModalProps) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedEngineer, setSelectedEngineer] = useState<string>('all');
  const [engineers, setEngineers] = useState<Array<{ id: string; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEngineers = async () => {
      try {
        const engineersRef = collection(db, 'engineers');
        const engineersSnapshot = await getDocs(engineersRef);
        const engineersList = engineersSnapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email
        }));
        setEngineers(engineersList);
      } catch (error) {
        console.error('Error fetching engineers:', error);
      }
    };

    if (isOpen) {
      fetchEngineers();
    }
  }, [isOpen]);

  const handleApply = async () => {
    onApplyFilters({
      status: selectedStatus,
      engineer: selectedEngineer
    });
    await generatePDF();
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const generatePDF = async () => {
    try {
      setLoading(true);

      // Filter events based on selected filters
      let filteredEvents = [...events];
      
      if (selectedStatus !== 'all') {
        const isResolved = selectedStatus === 'Resolved';
        filteredEvents = filteredEvents.filter(event => event.resolved === isResolved);
      }
      
      if (selectedEngineer !== 'all') {
        filteredEvents = filteredEvents.filter(event => event.responsibleEngineer === selectedEngineer);
      }

      // Create PDF content
      const content = document.createElement('div');
      content.style.padding = '20px';
      content.style.fontFamily = 'Arial, sans-serif';

      // Add header
      const header = document.createElement('div');
      header.innerHTML = `
        <h1 style="color: #1E40AF; margin-bottom: 20px; text-align: center;">Calendar Events Report</h1>
        <div style="margin-bottom: 20px; color: #4B5563;">
          <p><strong>Status Filter:</strong> ${selectedStatus}</p>
          <p><strong>Engineer:</strong> ${selectedEngineer === 'all' ? 'All Engineers' : selectedEngineer}</p>
          <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Total Events:</strong> ${filteredEvents.length}</p>
        </div>
      `;
      content.appendChild(header);

      // Create table
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginBottom = '20px';

      // Add table header
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr style="background-color: #1E40AF; color: white;">
          <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Event Title</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Date & Time</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Team</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Project</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Engineer</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Status</th>
        </tr>
      `;
      table.appendChild(thead);

      // Add table body
      const tbody = document.createElement('tbody');
      filteredEvents.forEach((event, index) => {
        const tr = document.createElement('tr');
        tr.style.backgroundColor = index % 2 === 0 ? '#F9FAFB' : 'white';
        
        tr.innerHTML = `
          <td style="padding: 10px; border: 1px solid #E5E7EB;">${event.title}</td>
          <td style="padding: 10px; border: 1px solid #E5E7EB;">${formatDate(event.startDate)}</td>
          <td style="padding: 10px; border: 1px solid #E5E7EB;">${event.teamName}</td>
          <td style="padding: 10px; border: 1px solid #E5E7EB;">${event.projectName}</td>
          <td style="padding: 10px; border: 1px solid #E5E7EB;">${event.responsibleEngineer || 'N/A'}</td>
          <td style="padding: 10px; border: 1px solid #E5E7EB;">
            <span style="
              padding: 4px 8px;
              border-radius: 4px;
              background-color: ${event.resolved ? '#e9d5ff' : '#dbeafe'};
              color: ${event.resolved ? '#6b21a8' : '#1e40af'};
            ">
              ${event.resolved ? 'Resolved' : 'Open'}
            </span>
          </td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      content.appendChild(table);

      // Generate PDF
      const opt = {
        margin: 1,
        filename: `calendar_events_report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(content).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-lg dark:bg-boxdark">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
            Filter Tickets & Generate Report
          </h3>
          
          <div className="mb-4">
            <label className="mb-2.5 block text-black dark:text-white">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-2.5 block text-black dark:text-white">
              Responsible Engineer
            </label>
            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            >
              <option value="all">All Engineers</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.email}>
                  {engineer.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className="rounded border border-stroke py-2 px-6 text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={loading}
              className="inline-flex items-center justify-center rounded bg-primary py-2 px-6 text-white hover:bg-opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : null}
              {loading ? 'Generating...' : 'Apply & Generate PDF'}
            </button>
          </div>
        </div>

        {/* Hidden content for PDF generation */}
        <div 
          ref={contentRef} 
          className="hidden"
          style={{
            width: '1000px',
            padding: '20px',
            background: 'white'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Event Title</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date & Time</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Team</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Engineer</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => (
                <tr 
                  key={event.id}
                  style={{ 
                    borderBottom: index === events.length - 1 ? 'none' : '1px solid #e5e7eb'
                  }}
                >
                  <td style={{ padding: '12px' }}>{event.title}</td>
                  <td style={{ padding: '12px' }}>{formatDate(event.startDate)}</td>
                  <td style={{ padding: '12px' }}>{event.teamName}</td>
                  <td style={{ padding: '12px' }}>{event.projectName}</td>
                  <td style={{ padding: '12px' }}>{event.responsibleEngineer || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: event.resolved ? '#e9d5ff' : '#dbeafe',
                      color: event.resolved ? '#6b21a8' : '#1e40af',
                    }}>
                      {event.resolved ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FilterTicketsModal;
