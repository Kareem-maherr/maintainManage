import { useState, useEffect } from 'react';
import Breadcrumb from "../components/Breadcrumbs/Breadcrumb"
import TeamsList from "../components/TeamsList"
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    getDocs,
    query,
    doc,
    updateDoc,
    getDoc
} from 'firebase/firestore';

interface Team {
    id: string;
    name: string;
    supervisor?: string;
    members: any[];
    createdAt?: any;
    team_engineer?: string;
}

interface Engineer {
    id: string;
    email: string;
    displayName: string;
    role: string;
}

interface EngineerBasic {
    email: string;
    displayName: string;
}

const Teams = () => {
    const { currentUser } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [engineers, setEngineers] = useState<Engineer[]>([]);
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [selectedEngineer, setSelectedEngineer] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [filterByEngineer, setFilterByEngineer] = useState<string>('');
    const [allEngineers, setAllEngineers] = useState<EngineerBasic[]>([]);

    // Check if current user is admin and get user info
    const [userEmail, setUserEmail] = useState<string>('');
    
    useEffect(() => {
        const getUserInfo = async () => {
            if (currentUser) {
                try {
                    // Get the user document from the engineers collection
                    const userDocRef = doc(db, 'engineers', currentUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        console.log('Teams Page - User Data:', userData);
                        console.log('Teams Page - User Email:', userData.email);
                        setUserEmail(userData.email);
                        
                        if (userData.role === 'admin') {
                            setIsAdmin(true);
                        }
                    }
                } catch (error) {
                    console.error('Error checking user info:', error);
                }
            }
        };

        getUserInfo();
        
        // Fetch all engineers for the filter buttons
        const fetchEngineers = async () => {
            try {
                const engineersRef = collection(db, 'engineers');
                const engineersSnapshot = await getDocs(query(engineersRef));
                const engineersData = engineersSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as Engineer[];
                
                // Extract just the email and displayName for the filter buttons
                const engineersList = engineersData.map(eng => ({
                    email: eng.email,
                    displayName: eng.displayName
                }));
                
                console.log('Engineers data for filtering:', engineersList);
                setAllEngineers(engineersList);
            } catch (error) {
                console.error('Error fetching engineers:', error);
            }
        };
        
        fetchEngineers();
    }, [currentUser]);

    // Fetch teams and engineers when modal opens
    useEffect(() => {
        if (isModalOpen) {
            const fetchTeamsAndEngineers = async () => {
                setLoading(true);
                try {
                    // Fetch teams
                    const teamsRef = collection(db, 'teams');
                    const teamsSnapshot = await getDocs(query(teamsRef));
                    const teamsData = teamsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as Team[];
                    setTeams(teamsData);

                    // Fetch engineers
                    const engineersRef = collection(db, 'engineers');
                    const engineersSnapshot = await getDocs(query(engineersRef));
                    const engineersData = engineersSnapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        })) as Engineer[];
                    setEngineers(engineersData);
                } catch (error) {
                    console.error('Error fetching data:', error);
                } finally {
                    setLoading(false);
                }
            };

            fetchTeamsAndEngineers();
        }
    }, [isModalOpen]);

    const handleTeamCheckboxChange = (teamId: string) => {
        setSelectedTeams(prev => {
            if (prev.includes(teamId)) {
                return prev.filter(id => id !== teamId);
            } else {
                return [...prev, teamId];
            }
        });
    };

    const handleEngineerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedEngineer(event.target.value);
    };

    const handleAssignTeams = async () => {
        if (selectedTeams.length === 0 || !selectedEngineer) return;

        setLoading(true);
        try {
            // Get the engineer's email
            const selectedEngineerData = engineers.find(eng => eng.id === selectedEngineer);
            if (!selectedEngineerData) {
                console.error('Selected engineer not found');
                return;
            }

            // Update each selected team with the engineer's email
            const updatePromises = selectedTeams.map(teamId => {
                const teamDocRef = doc(db, 'teams', teamId);
                return updateDoc(teamDocRef, {
                    team_engineer: selectedEngineerData.email
                });
            });

            await Promise.all(updatePromises);
            
            // Close modal and reset selections
            setIsModalOpen(false);
            setSelectedTeams([]);
            setSelectedEngineer('');
        } catch (error) {
            console.error('Error assigning teams to engineer:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle engineer filter selection
    const handleFilterByEngineer = (engineerEmail: string) => {
        if (filterByEngineer === engineerEmail) {
            // If clicking the same engineer, clear the filter
            setFilterByEngineer('');
        } else {
            // Otherwise set the filter to the selected engineer
            setFilterByEngineer(engineerEmail);
        }
    };

    return (
        <>
            <Breadcrumb pageName="Teams" />

            <div className="flex flex-col gap-10">
                {isAdmin && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90"
                        >
                            Assign Teams to Engineers
                        </button>
                    </div>
                )}
                
                {/* Engineer filter buttons */}
                {isAdmin && allEngineers.length > 0 && (
                    <div className="bg-white dark:bg-boxdark rounded-sm border border-stroke shadow-default p-4">
                        <h4 className="text-lg font-medium text-black dark:text-white mb-3">Filter Teams by Engineer</h4>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilterByEngineer('')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                    filterByEngineer === '' 
                                        ? 'bg-primary text-white' 
                                        : 'bg-gray-100 dark:bg-boxdark-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-opacity-90'
                                }`}
                            >
                                All Teams
                            </button>
                            {allEngineers.map((engineer) => (
                                <button
                                    key={engineer.email}
                                    onClick={() => handleFilterByEngineer(engineer.email)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                        filterByEngineer === engineer.email 
                                            ? 'bg-primary text-white' 
                                            : 'bg-gray-100 dark:bg-boxdark-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-opacity-90'
                                    }`}
                                >
                                    {engineer.displayName}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <TeamsList isAdmin={isAdmin} userEmail={userEmail} filterByEngineer={filterByEngineer} />
            </div>

            {/* Assign Teams to Engineers Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white dark:bg-boxdark p-6 rounded-lg w-[500px] max-h-[80vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-4 text-black dark:text-white">Assign Teams to Engineers</h3>
                        
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Teams List with Checkboxes */}
                                <div>
                                    <h4 className="text-md font-medium mb-2 text-black dark:text-white">Select Teams</h4>
                                    <div className="max-h-60 overflow-y-auto border border-stroke dark:border-strokedark rounded-sm p-2">
                                        {teams.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 p-2">No teams available</p>
                                        ) : (
                                            teams.map((team) => (
                                                <div key={team.id} className="flex items-center mb-2 last:mb-0">
                                                    <input
                                                        type="checkbox"
                                                        id={`team-${team.id}`}
                                                        checked={selectedTeams.includes(team.id)}
                                                        onChange={() => handleTeamCheckboxChange(team.id)}
                                                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                                    />
                                                    <label
                                                        htmlFor={`team-${team.id}`}
                                                        className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300 flex-1"
                                                    >
                                                        {team.name}
                                                        {team.team_engineer && (
                                                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                                (Currently assigned to: {team.team_engineer})
                                                            </span>
                                                        )}
                                                    </label>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Engineers Dropdown */}
                                <div>
                                    <h4 className="text-md font-medium mb-2 text-black dark:text-white">Select Engineer</h4>
                                    <select
                                        value={selectedEngineer}
                                        onChange={handleEngineerChange}
                                        className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                                    >
                                        <option value="">Select an engineer</option>
                                        {engineers.map((engineer) => (
                                            <option key={engineer.id} value={engineer.id}>
                                                {engineer.displayName} ({engineer.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-4 mt-6">
                                    <button
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            setSelectedTeams([]);
                                            setSelectedEngineer('');
                                        }}
                                        className="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:bg-opacity-90 dark:border-strokedark dark:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAssignTeams}
                                        disabled={selectedTeams.length === 0 || !selectedEngineer}
                                        className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Assign
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
};

export default Teams;
