import { useState, useEffect } from 'react';
import Breadcrumb from "../components/Breadcrumbs/Breadcrumb"
import TeamsList from "../components/TeamsList"
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    doc,
    getDoc
} from 'firebase/firestore';

const Teams = () => {
    const { currentUser } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [filterByEngineer, setFilterByEngineer] = useState<string>('');

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
    }, [currentUser]);

    return (
        <>
            <Breadcrumb pageName="" />

            <div className="flex flex-col gap-10">
                <TeamsList
                    isAdmin={isAdmin}
                    userEmail={userEmail}
                    filterByEngineer={filterByEngineer}
                    onFilterByEngineerChange={(email) => setFilterByEngineer(email)}
                />
            </div>
        </>
    )
};

export default Teams;
