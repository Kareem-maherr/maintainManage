import { ApexOptions } from 'apexcharts';
import { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useLanguage } from '../../contexts/LanguageContext';

interface Ticket {
  id: string;
  status: string;
  createdAt: any;
  responsible_engineer?: string;
}

const ChartOne = () => {
  const { t } = useLanguage();
  const [series, setSeries] = useState([
    {
      name: t('dashboard.charts.openTickets'),
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Last 12 months
    },
    {
      name: t('dashboard.charts.resolvedTickets'),
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Last 12 months
    },
  ]);
  
  const [isEngineer, setIsEngineer] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [chartTitle, setChartTitle] = useState<string>(t('dashboard.charts.ticketsLastYear'));

  // Check user role
  useEffect(() => {
    const checkUserRole = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      setUserEmail(currentUser.email);

      try {
        // Get user document to check role
        const userDocRef = doc(db, 'engineers', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userRole = userData?.role;
          const isUserEngineer = userRole === 'engineer';
          setIsEngineer(isUserEngineer);
          
          // Set chart title based on role
          if (isUserEngineer) {
            setChartTitle(t('dashboard.charts.yourTicketsLastYear'));
          } else {
            setChartTitle(t('dashboard.charts.ticketsLastYear'));
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };

    checkUserRole();
  }, [t]);

  // Fetch tickets based on user role
  useEffect(() => {
    if (userEmail === null) return; // Wait until user email is set
    
    let ticketsQuery;
    
    if (isEngineer && userEmail) {
      // Engineer sees only assigned tickets
      ticketsQuery = query(
        collection(db, 'tickets'),
        where('responsible_engineer', '==', userEmail),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Admin sees all tickets
      ticketsQuery = query(
        collection(db, 'tickets'),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const ticketsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Ticket[];

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
      ticketsData.forEach((ticket) => {
        const ticketDate = ticket.createdAt.toDate();
        const monthIndex = months.findIndex(
          (month) =>
            month.getMonth() === ticketDate.getMonth() &&
            month.getFullYear() === ticketDate.getFullYear(),
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
          name: t('dashboard.charts.openTickets'),
          data: openTickets,
        },
        {
          name: t('dashboard.charts.resolvedTickets'),
          data: resolvedTickets,
        },
      ]);
    });

    return () => unsubscribe();
  }, [isEngineer, userEmail]);

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
        text: t('dashboard.charts.numberOfTickets'),
      },
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
        <div>
          <h4 className="text-xl font-semibold text-black dark:text-white">
            {chartTitle}
          </h4>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:gap-5">
          <div className="flex min-w-47.5">
            <span className="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-primary">
              <span className="block h-2.5 w-full max-w-2.5 rounded-full bg-primary"></span>
            </span>
            <div className="w-full">
              <p className="font-semibold text-primary">{t('dashboard.charts.openTickets')}</p>
              <p className="text-sm font-medium">{t('dashboard.charts.last12Months')}</p>
            </div>
          </div>
          <div className="flex min-w-47.5">
            <span className="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-secondary">
              <span className="block h-2.5 w-full max-w-2.5 rounded-full bg-secondary"></span>
            </span>
            <div className="w-full">
              <p className="font-semibold text-secondary">{t('dashboard.charts.resolvedTickets')}</p>
              <p className="text-sm font-medium">{t('dashboard.charts.last12Months')}</p>
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
