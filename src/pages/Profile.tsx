import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import ClientList from '../components/Cards/ClientList';

const Profile = () => {
  return (
    <>
      <Breadcrumb pageName="Client List" />

      <div className="flex flex-col gap-10">
      
        <ClientList />
      </div>
    </>
  );
};

export default Profile;
