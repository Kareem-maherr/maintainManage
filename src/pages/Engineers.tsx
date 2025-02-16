import { useEffect } from 'react';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import EngineersList from '../components/EngineersList';

const Engineers = () => {
  useEffect(() => {
    document.title = 'Engineers | Arab Emergency Management';
  }, []);

  return (
    <>
      <Breadcrumb pageName="Engineers" />
      <div className="gap-9 sm:grid-cols-2">
        <div className="flex flex-col gap-9">
          <EngineersList />
        </div>
      </div>
    </>
  );
};

export default Engineers;
