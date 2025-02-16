import { ApexOptions } from 'apexcharts';
import React, { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface Ticket {
  id: string;
  status: string;
  createdAt: any;
}

const ChartOne = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [series, setSeries] = useState([
    {
      name: 'Open Tickets',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Last 12 months
    },
    {
      name: 'Resolved Tickets',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Last 12 months
    }
  ]);

  useEffect(() => {
    const ticketsQuery = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const ticketsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      
      setTickets(ticketsData);

      // Get last 12 months
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return d;
      }).reverse();

      // Initialize counters
      const openTickets = new Array(12).fill(0);
      const resolvedTickets = new Array(12).fill(0);

      // Count tickets by month and status
      ticketsData.forEach(ticket => {
        const ticketDate = ticket.createdAt.toDate();
        const monthIndex = months.findIndex(month => 
          month.getMonth() === ticketDate.getMonth() && 
          month.getFullYear() === ticketDate.getFullYear()
        );

        if (monthIndex !== -1) {
          if (ticket.status === 'Open') {
            openTickets[monthIndex]++;
          } else if (ticket.status === 'Resolved') {
            resolvedTickets[monthIndex]++;
          }
        }
      });

      setSeries([
        {
          name: 'Open Tickets',
          data: openTickets
        },
        {
          name: 'Resolved Tickets',
          data: resolvedTickets
        }
      ]);
    });

    return () => unsubscribe();
  }, []);

  const options: ApexOptions = {
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'left',
    },
    colors: ['#3C50E0', '#80CAEE'],
    chart: {
      fontFamily: 'Satoshi, sans-serif',
      type: 'area',
      height: 335,
      dropShadow: {
        enabled: true,
        color: '#623CEA14',
        top: 10,
        blur: 4,
        left: 0,
        opacity: 0.1,
      },
      toolbar: {
        show: false,
      },
    },
    responsive: [
      {
        breakpoint: 1024,
        options: {
          chart: {
            height: 300,
          },
        },
      },
      {
        breakpoint: 1366,
        options: {
          chart: {
            height: 350,
          },
        },
      },
    ],
    stroke: {
      width: [2, 2],
      curve: 'smooth',
    },
    grid: {
      show: true,
      strokeDashArray: 0,
      borderColor: '#e2e8f0',
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return d.toLocaleString('default', { month: 'short' });
      }),
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      title: {
        text: 'Number of Tickets'
      }
    },
    tooltip: {
      x: {
        show: true,
      },
      y: {
        formatter: function (value: number) {
          return value.toString() + ' tickets';
        },
      },
    },
  };

  return (
    <div className="col-span-12 rounded-sm border border-stroke bg-white px-5 pt-7.5 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:col-span-8">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="flex w-full flex-wrap gap-3 sm:gap-5">
          <div className="flex min-w-47.5">
            <span className="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-primary">
              <span className="block h-2.5 w-full max-w-2.5 rounded-full bg-primary"></span>
            </span>
            <div className="w-full">
              <p className="font-semibold text-primary">Open Tickets</p>
              <p className="text-sm font-medium">Last 12 months</p>
            </div>
          </div>
          <div className="flex min-w-47.5">
            <span className="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-secondary">
              <span className="block h-2.5 w-full max-w-2.5 rounded-full bg-secondary"></span>
            </span>
            <div className="w-full">
              <p className="font-semibold text-secondary">Resolved Tickets</p>
              <p className="text-sm font-medium">Last 12 months</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div id="chartOne" className="-ml-5">
          <ReactApexChart
            options={options}
            series={series}
            type="area"
            height={350}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartOne;
