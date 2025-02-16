import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import UsersList from '../components/Tables/TableTwo';

const Profile = () => {
  return (
    <>
      <Breadcrumb pageName="Client List" />

      <div className="flex flex-col gap-10">
      
        <UsersList />
      </div>
    </>
  );
};

export default Profile;
