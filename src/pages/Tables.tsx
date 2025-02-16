import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import FullTicketList from '../components/Tables/FullTicketList';

const Tables = () => {
  return (
    <>
      <Breadcrumb pageName="Ticket List" />

      <div className="flex flex-col gap-10">
        <FullTicketList />
      </div>
    </>
  );
};

export default Tables;
