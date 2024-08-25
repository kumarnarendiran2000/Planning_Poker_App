import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';

const RoomLobby: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    // Fetch members from the backend
    const fetchMembers = async () => {
      try {
        const response = await fetch(`http://localhost:3000/room-members?RoomCode=${roomCode}`);
        const data = await response.json();
        if (data.success) {
          setMembers(data.members);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      }
    };

    fetchMembers();
  }, [roomCode]);

  const handleStartVoting = () => {
    // Logic to start voting session
    console.log('Start voting session');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Room: {roomCode}</h1>
      <div className="bg-white shadow-md rounded p-4 w-1/2">
        <h2 className="text-xl font-semibold mb-2">Members</h2>
        <ul>
          {members.map((member, index) => (
            <li key={index} className="mb-1">{member}</li>
          ))}
        </ul>
        {isScrumMaster && (
          <button
            onClick={handleStartVoting}
            className="bg-blue-500 text-white py-2 px-4 mt-4 rounded"
          >
            Start Voting
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomLobby;
