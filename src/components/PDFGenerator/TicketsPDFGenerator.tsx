import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import html2pdf from 'html2pdf.js';

interface PDFParams {
  startDate: string;
  endDate: string;
  status: string;
  severity: string;
}

export const generateTicketsPDF = async (params: PDFParams) => {
  try {
    // Build query based on parameters
    let ticketsQuery = query(collection(db, 'tickets'));
    const queryConstraints = [];

    if (params.startDate) {
      const startTimestamp = Timestamp.fromDate(new Date(params.startDate));
      queryConstraints.push(where('createdAt', '>=', startTimestamp));
    }

    if (params.endDate) {
      const endTimestamp = Timestamp.fromDate(new Date(params.endDate + 'T23:59:59'));
      queryConstraints.push(where('createdAt', '<=', endTimestamp));
    }

    if (params.status && params.status !== 'All') {
      queryConstraints.push(where('status', '==', params.status));
    }

    if (params.severity && params.severity !== 'All') {
      queryConstraints.push(where('severity', '==', params.severity));
    }

    // Apply all query constraints
    ticketsQuery = query(ticketsQuery, ...queryConstraints);

    // Get tickets
    const ticketsSnapshot = await getDocs(ticketsQuery);
    const tickets = ticketsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Create PDF content
    const content = createPDFContent(tickets, params);

    // Generate PDF
    const opt = {
      margin: 1,
      filename: `tickets_report_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    await html2pdf().set(opt).from(content).save();

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

const createPDFContent = (tickets: any[], params: PDFParams) => {
  // Create a container div
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';

  // Add header
  const header = document.createElement('div');
  header.innerHTML = `
    <h1 style="color: #1E40AF; margin-bottom: 20px; text-align: center;">Tickets Report</h1>
    <div style="margin-bottom: 20px; color: #4B5563;">
      <p><strong>Date Range:</strong> ${params.startDate || 'All'} to ${params.endDate || 'All'}</p>
      <p><strong>Status:</strong> ${params.status}</p>
      <p><strong>Severity:</strong> ${params.severity}</p>
      <p><strong>Total Tickets:</strong> ${tickets.length}</p>
    </div>
  `;
  container.appendChild(header);

  // Create table
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginBottom = '20px';

  // Add table header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr style="background-color: #1E40AF; color: white;">
      <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Title</th>
      <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Company</th>
      <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Status</th>
      <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Severity</th>
      <th style="padding: 10px; text-align: left; border: 1px solid #E5E7EB;">Created</th>
    </tr>
  `;
  table.appendChild(thead);

  // Add table body
  const tbody = document.createElement('tbody');
  tickets.forEach((ticket, index) => {
    const tr = document.createElement('tr');
    tr.style.backgroundColor = index % 2 === 0 ? '#F9FAFB' : 'white';
    
    const created = ticket.createdAt?.toDate?.() || new Date();
    const formattedDate = created.toLocaleDateString();

    tr.innerHTML = `
      <td style="padding: 10px; border: 1px solid #E5E7EB;">${ticket.title}</td>
      <td style="padding: 10px; border: 1px solid #E5E7EB;">${ticket.company}</td>
      <td style="padding: 10px; border: 1px solid #E5E7EB;">${ticket.status}</td>
      <td style="padding: 10px; border: 1px solid #E5E7EB;">${ticket.severity}</td>
      <td style="padding: 10px; border: 1px solid #E5E7EB;">${formattedDate}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);

  return container;
};
