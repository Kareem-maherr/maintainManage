import React, { useState, useEffect } from 'react';
import { generateTicketsPDF } from '../PDFGenerator/TicketsPDFGenerator';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { BsFilePdf } from 'react-icons/bs';

interface PDFGeneratorModalProps {
  onClose: () => void;
}

interface PDFParams {
  startDate: string;
  endDate: string;
  status: string;
  severity: string;
  responsibleEngineer: string;
}

interface Engineer {
  id: string;
  email: string;
  name: string;
}

const PDFGeneratorModal: React.FC<PDFGeneratorModalProps> = ({ onClose }) => {
  const [pdfParams, setPdfParams] = useState<PDFParams>({
    startDate: '',
    endDate: '',
    status: 'All',
    severity: 'All',
    responsibleEngineer: 'All'
  });

  const [generating, setGenerating] = useState(false);
  const [engineers, setEngineers] = useState<Engineer[]>([]);

  useEffect(() => {
    const fetchEngineers = async () => {
      try {
        const engineersRef = collection(db, 'engineers');
        const engineersQuery = query(engineersRef, where('role', '==', 'engineer'));
        const engineersSnapshot = await getDocs(engineersQuery);
        
        const engineersList = engineersSnapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          name: doc.data().name || doc.data().email
        }));
        
        setEngineers(engineersList);
      } catch (error) {
        console.error('Error fetching engineers:', error);
      }
    };

    fetchEngineers();
  }, []);

  const handleGeneratePDF = async () => {
    try {
      setGenerating(true);
      await generateTicketsPDF(pdfParams);
      onClose();
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-40">
      <div className="relative w-full max-w-lg rounded-lg bg-white p-8 shadow-lg dark:bg-boxdark">
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
          Generate Tickets Report
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Start Date
              </label>
              <input
                type="date"
                value={pdfParams.startDate}
                onChange={(e) => setPdfParams({ ...pdfParams, startDate: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                End Date
              </label>
              <input
                type="date"
                value={pdfParams.endDate}
                onChange={(e) => setPdfParams({ ...pdfParams, endDate: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Status
              </label>
              <select
                value={pdfParams.status}
                onChange={(e) => setPdfParams({ ...pdfParams, status: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="All">All</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Severity
              </label>
              <select
                value={pdfParams.severity}
                onChange={(e) => setPdfParams({ ...pdfParams, severity: e.target.value })}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="All">All</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2.5 block text-black dark:text-white">
              Responsible Engineer
            </label>
            <select
              value={pdfParams.responsibleEngineer}
              onChange={(e) => setPdfParams({ ...pdfParams, responsibleEngineer: e.target.value })}
              className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option value="All">All Engineers</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.email}>
                  {engineer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-stroke py-2 px-6 text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={generating}
              className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-3 sm:px-6 text-white hover:bg-opacity-90 disabled:bg-opacity-50"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-5 w-5 sm:mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <BsFilePdf className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Generate PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFGeneratorModal;
