import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

interface TeamMember {
  name: string;
  email?: string;
  role?: string;
}

interface Team {
  id: string;
  supervisor?: string;
  members: TeamMember[];
  createdAt?: any;
}

const TeamsList = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [memberCount, setMemberCount] = useState('');
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [supervisor, setSupervisor] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const teamsRef = collection(db, 'teams');
    const q = query(teamsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      
      setTeams(teamsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateTeam = async () => {
    if (memberNames.length === 0 || !supervisor.trim()) return;

    try {
      const newTeam = {
        name: `${supervisor.trim()}'s Team`,
        members: memberNames.map(name => ({ 
          name: name.trim(),
          email: '',
          role: 'member'
        })),
        supervisor: supervisor.trim(),
        createdAt: new Date()
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

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setSupervisor(team.supervisor || '');
    setMemberNames(team.members.map(member => member.name));
    setIsEditModalOpen(true);
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;

    try {
      const updatedTeam = {
        name: `${supervisor.trim()}'s Team`,
        members: memberNames.map(name => ({ 
          name: name.trim(),
          email: '',
          role: 'member'
        })),
        supervisor: supervisor.trim()
      };

      const teamDocRef = doc(db, 'teams', editingTeam.id);
      await updateDoc(teamDocRef, updatedTeam);
      setIsEditModalOpen(false);
      setEditingTeam(null);
    } catch (error) {
      console.error('Error updating team:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      <div className="flex justify-between mb-6">
        <h4 className="text-xl font-semibold text-black dark:text-white">Teams</h4>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90"
        >
          Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3 2xl:gap-7.5">
        {teams.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            No teams created yet. Click "Create Team" to create your first team.
          </div>
        ) : (
          teams.map((team) => (
            <div key={team.id} className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="flex justify-between items-center mb-4">
                <h5 className="text-lg font-medium text-black dark:text-white">{team.name}</h5>
                <Cog6ToothIcon
                  className="h-5 w-5 text-gray-500 hover:text-primary cursor-pointer"
                  onClick={() => handleEditTeam(team)}
                />
              </div>
              {team.supervisor && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Supervisor: {team.supervisor}
                </p>
              )}
              <div className="space-y-2">
                {team.members.map((member, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-black dark:text-white">{member.name}</span>
                      {member.role && (
                        <span className="text-xs text-gray-500">{member.role}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-boxdark p-6 rounded-lg w-96">
            <h3 className="text-xl font-semibold mb-4">إنشاء فريق جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">المشرف</label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  placeholder="أدخل اسم المشرف"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">عدد الأعضاء</label>
                <input
                  type="number"
                  value={memberCount}
                  onChange={(e) => {
                    setMemberCount(e.target.value);
                    setMemberNames(new Array(parseInt(e.target.value) || 0).fill(''));
                  }}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              {memberNames.map((name, index) => (
                <div key={index} className="mb-4">
                  <label className="block text-sm font-medium mb-1">اسم العضو {index + 1}</label>
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
                  إلغاء
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={!supervisor.trim() || memberNames.length === 0 || memberNames.some(name => !name.trim())}
                  className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  إنشاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg p-6 bg-white rounded-md shadow-lg">
            <h3 className="mb-4 text-lg font-medium text-black">تعديل الفريق</h3>
            <input
              type="text"
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              placeholder="المشرف"
              className="w-full mb-4 p-2 border border-gray-300 rounded"
            />
            <textarea
              value={memberNames.join(', ')}
              onChange={(e) => setMemberNames(e.target.value.split(',').map(name => name.trim()))}
              placeholder="أسماء الأعضاء (مفصولة بفواصل)"
              className="w-full mb-4 p-2 border border-gray-300 rounded"
            />
            <div className="flex justify-end">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="mr-2 inline-flex items-center justify-center rounded-md bg-gray-300 py-2 px-4 text-center font-medium text-black hover:bg-opacity-90"
              >
                إلغاء
              </button>
              <button
                onClick={handleUpdateTeam}
                className="inline-flex items-center justify-center rounded-md bg-primary py-2 px-4 text-center font-medium text-white hover:bg-opacity-90"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsList;