import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import Axios

const RoomLobby: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;
  const navigate = useNavigate();

  const [members, setMembers] = useState<string[]>([]);
  const [votingStarted, setVotingStarted] = useState<boolean>(false);

  useEffect(() => {
    if (isScrumMaster) {
      document.title = `Planning Poker - Scrum Master`;
    } else {
      document.title = `Planning Poker - Member: ${memberName}`;
    }
  }, [isScrumMaster, memberName]);

  useEffect(() => {
    if (!roomCode) return;

    const fetchMembers = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/room-members`, {
          params: { RoomCode: roomCode },
        });
        const data = response.data;
        if (data.success) {
          setMembers(data.members);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      }
    };

    fetchMembers();
    const intervalId = setInterval(fetchMembers, 2000);
    return () => clearInterval(intervalId);
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    const pollVotingStatus = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/voting-status`, {
          params: { RoomCode: roomCode },
        });
        const data = response.data;
        if (data.votingStarted) {
          setVotingStarted(true);
        }
      } catch (error) {
        console.error('Failed to fetch voting status:', error);
      }
    };

    pollVotingStatus();
    const intervalId = setInterval(pollVotingStatus, 2000);
    return () => clearInterval(intervalId);
  }, [roomCode]);

  useEffect(() => {
    if (votingStarted) {
      navigate(`/voting/${roomCode}`, { state: { isScrumMaster, memberName } });
    }
  }, [votingStarted, navigate, roomCode, isScrumMaster, memberName]);

  const handleStartVoting = async () => {
    try {
      const response = await axios.post('http://localhost:3000/start-voting', {
        RoomCode: roomCode,
      });
      const data = response.data;
      if (data.success) {
        navigate(`/voting/${roomCode}`, { state: { isScrumMaster, memberName } });
      } else {
        console.error('Failed to start voting session:', data.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-xl">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Room Code: {roomCode}</h1>

        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Members in Room</h2>
          <ul className="space-y-2">
            {members.map((member, index) => (
              <li key={index} className="text-lg text-gray-800">{member}</li>
            ))}
          </ul>
        </div>

        {isScrumMaster ? (
          <div>
            <p className="text-green-500 mb-4">You are the Scrum Master!</p>
            <button
              onClick={handleStartVoting}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded transition duration-300"
            >
              Start Voting
            </button>
          </div>
        ) : (
          <p className="text-blue-600">You are: {memberName}</p>
        )}
      </div>
    </div>
  );
};

export default RoomLobby;
