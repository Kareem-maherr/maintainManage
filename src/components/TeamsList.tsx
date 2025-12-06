import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../config/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  updateDoc,
  doc,
  where,
} from 'firebase/firestore';
import { Cog6ToothIcon, UserGroupIcon, CalendarDaysIcon, MapPinIcon, BuildingOfficeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

interface TeamMember {
  name: string;
  email?: string;
  role?: string;
}

interface ScheduledTicket {
  id: string;
  title: string;
  company: string;
  location: string;
  severity: string;
  status: string;
  noteStatus?: string;
}

interface ScheduledEvent {
  id: string;
  title: string;
  teamName: string;
  startDate: any;
  endDate: any;
  location: string;
  projectName: string;
  ticketCount: number;
  tickets: ScheduledTicket[];
  ticketIds: string[];
}

interface Team {
  id: string;
  name: string;
  supervisor?: string;
  members: TeamMember[];
  createdAt?: any;
  team_engineer?: string;
}

interface TeamsListProps {
  isAdmin: boolean;
  userEmail: string;
  filterByEngineer?: string;
}

const TeamsList = ({ isAdmin, userEmail, filterByEngineer = '' }: TeamsListProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [engineers, setEngineers] = useState<{id: string; email: string; displayName: string}[]>([]);
  const [memberCount, setMemberCount] = useState('');
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [supervisor, setSupervisor] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('TeamsList - User Email:', userEmail);
    console.log('TeamsList - Is Admin:', isAdmin);
    console.log('TeamsList - Filter By Engineer:', filterByEngineer);
    
    const teamsRef = collection(db, 'teams');
    
    // Query logic based on user role and filter
    let q;
    
    if (!isAdmin) {
      // If not admin, only show teams assigned to the user
      q = query(teamsRef, where('team_engineer', '==', userEmail));
      console.log('TeamsList - Query Condition: Non-admin, teams assigned to user');
    } else if (filterByEngineer && filterByEngineer.trim() !== '') {
      // If admin and filter is active, show teams for that engineer
      q = query(teamsRef, where('team_engineer', '==', filterByEngineer));
      console.log(`TeamsList - Query Condition: Admin, filtered by engineer ${filterByEngineer}`);
    } else {
      // If admin and no filter, show all teams
      q = query(teamsRef);
      console.log('TeamsList - Query Condition: Admin, all teams');
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log('TeamsList - Team Data:', doc.id, data);
        return {
          id: doc.id,
          ...data,
        };
      }) as Team[];

      console.log('TeamsList - Teams Count:', teamsData.length);
      console.log('TeamsList - Teams Data:', teamsData);
      setTeams(teamsData);
      setLoading(false);
    });
    
    // Clean up subscription when component unmounts
    return () => {
      unsubscribe();
    };
  }, [isAdmin, userEmail, filterByEngineer]);
  
  // Separate useEffect for engineers data
  useEffect(() => {
    // Fetch engineers for cross-referencing emails with displayNames
    const engineersRef = collection(db, 'engineers');
    const engineersUnsubscribe = onSnapshot(query(engineersRef), (snapshot) => {
      const engineersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log('TeamsList - Engineers data:', engineersData);
      setEngineers(engineersData as any);
    });

    // Clean up subscription when component unmounts
    return () => {
      engineersUnsubscribe();
    };
  }, []);

  // Fetch scheduled events for selected team
  useEffect(() => {
    if (!selectedTeam) {
      setScheduledEvents([]);
      return;
    }

    setLoadingEvents(true);
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('teamName', '==', selectedTeam.name));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ScheduledEvent[];
      
      // Sort by start date (upcoming first)
      eventsData.sort((a, b) => {
        const dateA = a.startDate?.toDate?.() || new Date(a.startDate);
        const dateB = b.startDate?.toDate?.() || new Date(b.startDate);
        return dateA.getTime() - dateB.getTime();
      });
      
      setScheduledEvents(eventsData);
      setLoadingEvents(false);
    });

    return () => unsubscribe();
  }, [selectedTeam]);

  // Handle team selection
  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(selectedTeam?.id === team.id ? null : team);
  };

  const handleCreateTeam = async () => {
    if (memberNames.length === 0 || !supervisor.trim()) return;

    try {
      const newTeam = {
        name: `${supervisor.trim()}'s Team`,
        members: memberNames.map((name) => ({
          name: name.trim(),
          email: '',
          role: 'member',
        })),
        supervisor: supervisor.trim(),
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'teams'), newTeam);
      setIsModalOpen(false);
      setMemberCount('');
      setMemberNames([]);
      setSupervisor('');
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const handleOpenEditPanel = (team: Team, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingTeamId === team.id) {
      // Close if clicking the same team
      setEditingTeamId(null);
    } else {
      setEditingTeamId(team.id);
      setEditTeamName(team.name);
      setSupervisor(team.supervisor || '');
      setMemberNames(team.members.map((member) => member.name));
    }
  };

  const handleCloseEditPanel = () => {
    setEditingTeamId(null);
    setEditTeamName('');
    setSupervisor('');
    setMemberNames([]);
  };

  const handleUpdateTeamName = async (teamId: string) => {
    if (!editTeamName.trim()) return;
    try {
      const teamDocRef = doc(db, 'teams', teamId);
      await updateDoc(teamDocRef, { name: editTeamName.trim() });
    } catch (error) {
      console.error('Error updating team name:', error);
    }
  };

  const handleUpdateSupervisor = async (teamId: string) => {
    if (!supervisor.trim()) return;
    try {
      const teamDocRef = doc(db, 'teams', teamId);
      await updateDoc(teamDocRef, { supervisor: supervisor.trim() });
    } catch (error) {
      console.error('Error updating supervisor:', error);
    }
  };

  const handleAddMember = async (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    const newMembers = [...team.members, { name: '', email: '', role: 'member' }];
    setMemberNames(newMembers.map(m => m.name));
    
    try {
      const teamDocRef = doc(db, 'teams', teamId);
      await updateDoc(teamDocRef, { members: newMembers });
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleUpdateMember = async (teamId: string, memberIndex: number, newName: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    const updatedMembers = team.members.map((member, idx) => 
      idx === memberIndex ? { ...member, name: newName } : member
    );
    
    try {
      const teamDocRef = doc(db, 'teams', teamId);
      await updateDoc(teamDocRef, { members: updatedMembers });
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  const handleRemoveMember = async (teamId: string, memberIndex: number) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    const updatedMembers = team.members.filter((_, idx) => idx !== memberIndex);
    setMemberNames(updatedMembers.map(m => m.name));
    
    try {
      const teamDocRef = doc(db, 'teams', teamId);
      await updateDoc(teamDocRef, { members: updatedMembers });
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Helper function to format date
  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date.toDate?.() || new Date(date);
    return d.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-6"
      >
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {filterByEngineer ? `Teams Assigned to ${engineers.find(eng => eng.email === filterByEngineer)?.displayName || filterByEngineer}` : 'Teams'}
        </h2>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 px-6 text-center font-medium text-white hover:bg-opacity-90 transition-all"
        >
          <UserGroupIcon className="w-5 h-5" />
          Create Team
        </motion.button>
      </motion.div>

      {/* Split Panel Layout */}
      <div className="flex gap-6 h-[calc(100vh-200px)] relative">
        {/* Left Panel - Team List */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-1/3 min-w-[300px] bg-white dark:bg-boxdark rounded-xl shadow-sm flex flex-col relative z-10"
        >
          <div className="p-4 border-b border-gray-200 dark:border-strokedark">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              All Teams ({teams.length})
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {teams.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center h-full p-4"
                >
                  <p className="text-gray-500 dark:text-gray-400 text-center">
                    {isAdmin ? "No teams found." : "You don't have any teams assigned to you."}
                  </p>
                </motion.div>
              ) : (
                teams.map((team, index) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="relative"
                  >
                    <div
                      onClick={() => handleSelectTeam(team)}
                      className={`
                        border-b border-gray-200 dark:border-strokedark p-4 cursor-pointer transition-all
                        ${selectedTeam?.id === team.id 
                          ? 'bg-primary/10 border-l-4 border-l-primary' 
                          : 'hover:bg-gray-50 dark:hover:bg-meta-4'}
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 dark:text-white truncate">
                              {team.name}
                            </h4>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => handleOpenEditPanel(team, e)}
                              className={`p-1 rounded-md transition-colors ${
                                editingTeamId === team.id 
                                  ? 'bg-primary text-white' 
                                  : 'text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-meta-4'
                              }`}
                            >
                              <Cog6ToothIcon className="h-4 w-4" />
                            </motion.button>
                          </div>
                          {team.supervisor && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              Supervisor: {team.supervisor}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {team.members?.length || 0} members
                            </span>
                            {team.team_engineer && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                Assigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right Panel - Team Details & Scheduled Tickets */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 bg-white dark:bg-boxdark rounded-xl shadow-sm overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {selectedTeam ? (
              <motion.div
                key={selectedTeam.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="h-full overflow-y-auto p-8"
              >
                {/* Team Header */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6 pb-6 border-b border-gray-200 dark:border-strokedark"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {selectedTeam.name}
                      </h2>
                      {selectedTeam.supervisor && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Supervisor: {selectedTeam.supervisor}
                        </p>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => handleOpenEditPanel(selectedTeam, e)}
                      className={`p-2 rounded-lg transition-colors ${
                        editingTeamId === selectedTeam.id
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 dark:bg-meta-4 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <Cog6ToothIcon className="h-5 w-5" />
                    </motion.button>
                  </div>
                </motion.div>

                {/* Team Details */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-6"
                >
                  {/* Team Info Section */}
                  <div className="bg-gray-50 dark:bg-meta-4 rounded-lg p-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <UserGroupIcon className="w-5 h-5 text-primary" />
                      Team Members ({selectedTeam.members?.length || 0})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedTeam.members?.map((member, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          className="flex items-center gap-3 p-3 bg-white dark:bg-boxdark rounded-lg"
                        >
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                            {member.role && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {selectedTeam.team_engineer && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-strokedark">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Assigned Engineer:</span>{' '}
                          {engineers.find(eng => eng.email === selectedTeam.team_engineer)?.displayName || selectedTeam.team_engineer}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Scheduled Tickets Section */}
                  <div className="bg-blue-50 dark:bg-boxdark-2 rounded-lg p-5 border-l-4 border-primary">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <CalendarDaysIcon className="w-5 h-5 text-primary" />
                      Scheduled Events ({scheduledEvents.length})
                    </h3>
                    
                    {loadingEvents ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : scheduledEvents.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        No scheduled events for this team
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {scheduledEvents.map((event, eventIndex) => (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: eventIndex * 0.05 }}
                            className="bg-white dark:bg-meta-4 rounded-lg p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  {event.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                  <CalendarDaysIcon className="w-4 h-4" />
                                  <span>{formatDate(event.startDate)}</span>
                                </div>
                              </div>
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                {event.ticketCount || event.tickets?.length || 0} ticket(s)
                              </span>
                            </div>

                            {event.location && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <MapPinIcon className="w-4 h-4" />
                                <span>{event.location}</span>
                              </div>
                            )}

                            {event.projectName && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                                <BuildingOfficeIcon className="w-4 h-4" />
                                <span>{event.projectName}</span>
                              </div>
                            )}

                            {/* Tickets in event */}
                            {event.tickets && event.tickets.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-strokedark">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                  Tickets
                                </p>
                                <div className="space-y-2">
                                  {event.tickets.map((ticket, ticketIndex) => (
                                    <div
                                      key={ticket.id || ticketIndex}
                                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-boxdark rounded"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                          {ticket.title}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                          {ticket.company} • {ticket.location}
                                        </p>
                                      </div>
                                      <div className="flex gap-1 ml-2">
                                        <span className={`
                                          px-1.5 py-0.5 text-xs font-medium rounded
                                          ${ticket.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                                            ticket.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                                            ticket.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-green-100 text-green-800'}
                                        `}>
                                          {ticket.severity}
                                        </span>
                                        <span className={`
                                          px-1.5 py-0.5 text-xs font-medium rounded
                                          ${ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                            ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                            'bg-yellow-100 text-yellow-800'}
                                        `}>
                                          {ticket.status}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full flex items-center justify-center"
              >
                <div className="text-center">
                  <UserGroupIcon className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select a Team</h3>
                  <p className="text-gray-500 dark:text-gray-400">Click on a team from the list to view details and scheduled tickets</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Edit Team Sidebar Panel */}
      <AnimatePresence>
        {editingTeamId && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseEditPanel}
              className="fixed inset-0 bg-black/20 z-40"
            />
            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 320 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-boxdark shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-strokedark">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PencilIcon className="w-5 h-5 text-primary" />
                    Edit Team
                  </h4>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleCloseEditPanel}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-meta-4"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </motion.button>
                </div>

                {(() => {
                  const team = teams.find(t => t.id === editingTeamId);
                  if (!team) return null;
                  
                  return (
                    <div className="space-y-6">
                      {/* Team Name */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Team Name
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editTeamName}
                            onChange={(e) => setEditTeamName(e.target.value)}
                            className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input text-gray-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Team name"
                          />
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleUpdateTeamName(team.id)}
                            className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-opacity-90"
                          >
                            Save
                          </motion.button>
                        </div>
                      </div>

                      {/* Supervisor */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Supervisor
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={supervisor}
                            onChange={(e) => setSupervisor(e.target.value)}
                            className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-strokedark bg-white dark:bg-form-input text-gray-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Supervisor name"
                          />
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleUpdateSupervisor(team.id)}
                            className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-opacity-90"
                          >
                            Save
                          </motion.button>
                        </div>
                      </div>

                      {/* Members */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Members ({team.members?.length || 0})
                          </label>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleAddMember(team.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-opacity-90 transition-colors"
                          >
                            <PlusIcon className="w-4 h-4" />
                            Add Member
                          </motion.button>
                        </div>
                        <div className="space-y-2">
                          {team.members?.map((member, memberIndex) => (
                            <div key={memberIndex} className="flex items-center gap-2 group">
                              <input
                                type="text"
                                defaultValue={member.name}
                                onBlur={(e) => handleUpdateMember(team.id, memberIndex, e.target.value)}
                                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-strokedark bg-gray-50 dark:bg-meta-4 text-gray-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-form-input outline-none transition-colors"
                                placeholder={`Member ${memberIndex + 1}`}
                              />
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleRemoveMember(team.id, memberIndex)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </motion.button>
                            </div>
                          ))}
                          {(!team.members || team.members.length === 0) && (
                            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4 bg-gray-50 dark:bg-meta-4 rounded-lg">
                              No members yet. Click "Add Member" to add one.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Assigned Engineer Info */}
                      {team.team_engineer && (
                        <div className="pt-4 border-t border-gray-200 dark:border-strokedark">
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Assigned Engineer
                          </label>
                          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                              <UserGroupIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-sm font-medium text-green-800 dark:text-green-300">
                              {engineers.find(eng => eng.email === team.team_engineer)?.displayName || team.team_engineer}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-boxdark p-6 rounded-lg w-96">
            <h3 className="text-xl font-semibold mb-4">Create New Team</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Supervisor
                </label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  placeholder="Enter supervisor name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of Members
                </label>
                <input
                  type="number"
                  value={memberCount}
                  onChange={(e) => {
                    setMemberCount(e.target.value);
                    setMemberNames(
                      new Array(parseInt(e.target.value) || 0).fill(''),
                    );
                  }}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              {memberNames.map((name, index) => (
                <div key={index} className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Member Name {index + 1}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const newNames = [...memberNames];
                      newNames[index] = e.target.value;
                      setMemberNames(newNames);
                    }}
                    className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  />
                </div>
              ))}

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSupervisor('');
                    setMemberCount('');
                    setMemberNames([]);
                  }}
                  className="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:bg-opacity-90 dark:border-strokedark dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={
                    !supervisor.trim() ||
                    memberNames.length === 0 ||
                    memberNames.some((name) => !name.trim())
                  }
                  className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamsList;
