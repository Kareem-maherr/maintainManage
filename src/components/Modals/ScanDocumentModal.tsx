import { useState } from 'react';
import { read, utils } from 'xlsx';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface ScanDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScanDocumentModal = ({ isOpen, onClose }: ScanDocumentModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  const processExcelFile = async (file: File) => {
    setIsProcessing(true);
    setError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet);

      // Process each row and add to Firestore
      for (const row of jsonData) {
        const event = row as any;
        
        // Validate required fields
        if (!event.title || !event.startDate || !event.endDate) {
          throw new Error('Missing required fields: title, startDate, endDate');
        }

        // Convert Excel dates (they're in serial number format) to JavaScript dates
        const startDate = new Date(Date.UTC(1899, 11, 30 + (event.startDate as number)));
        const endDate = new Date(Date.UTC(1899, 11, 30 + (event.endDate as number)));

        // Create the event object
        const eventData = {
          title: event.title,
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
          teamName: event.teamName || '',
          location: event.location || 'Remote',
          responsibleEngineer: event.responsibleEngineer || '',
          projectName: event.projectName || '',
          createdAt: Timestamp.now(),
          resolved: false
        };

        // Add to Firestore
        await addDoc(collection(db, 'events'), eventData);
      }

      onClose();
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Error processing file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!validTypes.includes(file.type)) {
      setError('Please upload only Excel files (.xlsx or .xls)');
      return;
    }

    processExcelFile(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black bg-opacity-40">
      <div className="rounded-sm bg-white p-8 dark:bg-boxdark w-full max-w-md">
        <h4 className="mb-6 text-xl font-semibold text-black dark:text-white">
          Upload Excel Document
        </h4>
        
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Upload an Excel file (.xlsx or .xls) containing event data. The file should have the following columns:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-500 dark:text-gray-400 mb-4">
            <li>title (required)</li>
            <li>startDate (required)</li>
            <li>endDate (required)</li>
            <li>teamName (optional)</li>
            <li>location (optional)</li>
            <li>responsibleEngineer (optional)</li>
            <li>projectName (optional)</li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium hover:bg-opacity-90 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {isProcessing && (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
              <span>Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanDocumentModal;
