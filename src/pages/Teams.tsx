import Breadcrumb from "../components/Breadcrumbs/Breadcrumb"
import TeamsList from "../components/TeamsList"

const Teams = () => {
    return (
        <>
            <Breadcrumb pageName="Teams" />

            <div className="flex flex-col gap-10">
                <TeamsList />
            </div>
        </>
    )
};

export default Teams;
