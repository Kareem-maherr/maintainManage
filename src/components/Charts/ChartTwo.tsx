import { ApexOptions } from 'apexcharts';
import { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useLanguage } from '../../contexts/LanguageContext';

const ChartTwo: React.FC = () => {
  const { t } = useLanguage();
  const [series, setSeries] = useState([
    {
      name: t('dashboard.charts.openTickets'),
      data: [0, 0, 0, 0, 0, 0, 0],
    },
    {
      name: t('dashboard.charts.closedTickets'),
      data: [0, 0, 0, 0, 0, 0, 0],
    },
  ]);
  
  const [isEngineer, setIsEngineer] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [chartTitle, setChartTitle] = useState<string>(t('dashboard.charts.ticketsThisWeek'));
  const [weekFilter, setWeekFilter] = useState<string>('thisWeek');
  
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
            setChartTitle(t('dashboard.charts.yourTicketsThisWeek'));
          } else {
            setChartTitle(t('dashboard.charts.ticketsThisWeek'));
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };

    checkUserRole();
  }, [t]);
  
  // Fetch weekly ticket data
  useEffect(() => {
    const fetchWeeklyData = async () => {
      if (userEmail === null) return;
      
      try {
        // Get current week's dates
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        
        // Calculate start and end of week
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - daysFromMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        // If last week is selected, adjust dates
        if (weekFilter === 'lastWeek') {
          startOfWeek.setDate(startOfWeek.getDate() - 7);
          endOfWeek.setDate(endOfWeek.getDate() - 7);
        }
        
        // Initialize data arrays for each day of the week
        const openTickets = [0, 0, 0, 0, 0, 0, 0]; // Mon to Sun
        const resolvedTickets = [0, 0, 0, 0, 0, 0, 0];
        
        // Query tickets
        const ticketsRef = collection(db, 'tickets');
        let ticketsQuery;
        
        if (isEngineer && userEmail) {
          // Engineer sees only assigned tickets
          ticketsQuery = query(ticketsRef, where('responsible_engineer', '==', userEmail));
        } else {
          // Admin sees all tickets
          ticketsQuery = query(ticketsRef);
        }
        
        const querySnapshot = await getDocs(ticketsQuery);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.createdAt) {
            const ticketDate = data.createdAt.toDate();
            
            // Check if ticket is within the selected week
            if (ticketDate >= startOfWeek && ticketDate <= endOfWeek) {
              // Get day of week (0 = Monday in our array)
              const dayOfWeek = ticketDate.getDay() === 0 ? 6 : ticketDate.getDay() - 1;
              
              // Count by status
              if (data.status === 'Resolved') {
                resolvedTickets[dayOfWeek]++;
              } else {
                openTickets[dayOfWeek]++;
              }
            }
          }
        });
        
        // Update chart data
        setSeries([
          {
            name: t('dashboard.charts.openTickets'),
            data: openTickets,
          },
          {
            name: t('dashboard.charts.closedTickets'),
            data: resolvedTickets,
          },
        ]);
        
      } catch (error) {
        console.error('Error fetching weekly ticket data:', error);
      }
    };
    
    fetchWeeklyData();
  }, [isEngineer, userEmail, weekFilter, t]);

  const options: ApexOptions = {
    colors: ['#3C50E0', '#80CAEE'],
    chart: {
      fontFamily: 'Satoshi, sans-serif',
      type: 'bar',
      height: 335,
      stacked: true,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },
    responsive: [
      {
        breakpoint: 1536,
        options: {
          plotOptions: {
            bar: {
              borderRadius: 0,
              columnWidth: '25%',
            },
          },
        },
      },
    ],
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 0,
        columnWidth: '25%',
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'last',
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      fontFamily: 'Satoshi',
      fontWeight: 500,
      fontSize: '14px',
      markers: {
        radius: 99,
      },
    },
    fill: {
      opacity: 1,
    },
  };

  return (
    <div className="col-span-12 rounded-sm border border-stroke bg-white p-7.5 shadow-default dark:border-strokedark dark:bg-boxdark xl:col-span-4">
      <div className="mb-4 justify-between gap-4 sm:flex">
        <div>
          <h4 className="text-xl font-semibold text-black dark:text-white">
            {chartTitle}
          </h4>
        </div>
        <div>
          <div className="relative z-20 inline-block">
            <select
              name="weekFilter"
              id="weekFilter"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="relative z-20 inline-flex appearance-none bg-transparent py-1 pl-3 pr-8 text-sm font-medium outline-none"
            >
              <option value="thisWeek" className='dark:bg-boxdark'>{t('dashboard.charts.timeFilter.thisWeek')}</option>
              <option value="lastWeek" className='dark:bg-boxdark'>{t('dashboard.charts.timeFilter.lastWeek')}</option>
            </select>
            <span className="absolute top-1/2 right-3 z-10 -translate-y-1/2">
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.47072 1.08816C0.47072 1.02932 0.500141 0.955772 0.54427 0.911642C0.647241 0.808672 0.809051 0.808672 0.912022 0.896932L4.85431 4.60386C4.92785 4.67741 5.06025 4.67741 5.14851 4.60386L9.09079 0.896932C9.19376 0.793962 9.35557 0.808672 9.45854 0.911642C9.56151 1.01461 9.5468 1.17642 9.44383 1.27939L5.50155 4.98632C5.22206 5.23639 4.78076 5.23639 4.51598 4.98632L0.558981 1.27939C0.50014 1.22055 0.47072 1.16171 0.47072 1.08816Z"
                  fill="#637381"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M1.22659 0.546578L5.00141 4.09604L8.76422 0.557869C9.08459 0.244537 9.54201 0.329403 9.79139 0.578788C10.112 0.899434 10.0277 1.36122 9.77668 1.61224L9.76644 1.62248L5.81552 5.33722C5.36257 5.74249 4.6445 5.7544 4.19352 5.32924C4.19327 5.32901 4.19377 5.32948 4.19352 5.32924L0.225953 1.61241C0.102762 1.48922 -4.20186e-08 1.31674 -3.20269e-08 1.08816C-2.40601e-08 0.905899 0.0780105 0.712197 0.211421 0.578787C0.494701 0.295506 0.935574 0.297138 1.21836 0.539529L1.22659 0.546578ZM4.51598 4.98632C4.78076 5.23639 5.22206 5.23639 5.50155 4.98632L9.44383 1.27939C9.5468 1.17642 9.56151 1.01461 9.45854 0.911642C9.35557 0.808672 9.19376 0.793962 9.09079 0.896932L5.14851 4.60386C5.06025 4.67741 4.92785 4.67741 4.85431 4.60386L0.912022 0.896932C0.809051 0.808672 0.647241 0.808672 0.54427 0.911642C0.500141 0.955772 0.47072 1.02932 0.47072 1.08816C0.47072 1.16171 0.50014 1.22055 0.558981 1.27939L4.51598 4.98632Z"
                  fill="#637381"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div>
        <div id="chartTwo" className="-ml-5 -mb-9">
          <ReactApexChart
            options={options}
            series={series}
            type="bar"
            height={350}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartTwo;
