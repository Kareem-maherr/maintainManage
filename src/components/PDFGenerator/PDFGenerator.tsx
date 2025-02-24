import { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PDFGeneratorProps {
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
  filters: {
    status: string;
    engineer: string;
  };
}

const PDFGenerator = ({ events, filters }: PDFGeneratorProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    if (!contentRef.current) return;

    try {
      // Create canvas from the content
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        logging: false,
        useCORS: true
      });

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imageData = canvas.toDataURL('image/png');

      // Add title and filters info
      pdf.setFontSize(16);
      pdf.text('Calendar Events Report', 105, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.text(`Status Filter: ${filters.status}`, 20, 25);
      pdf.text(`Engineer Filter: ${filters.engineer}`, 20, 30);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 35);

      // Add the main content
      pdf.addImage(imageData, 'PNG', 0, 40, imgWidth, imgHeight);

      // Save the PDF
      pdf.save('calendar-events-report.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
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

  return (
    <div>

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
  );
};

export default PDFGenerator;
