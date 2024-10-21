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
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-xl">
        <h1 className="text-4xl font-bold text-center mb-8">Room Code: {roomCode}</h1>

        <div className="bg-gray-100 p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Members in Room:</h2>
          <ul className="space-y-4">
            {members.map((member, index) => (
              <li key={index} className="text-lg text-gray-800">{member}</li>
            ))}
          </ul>
        </div>

        {isScrumMaster ? (
          <div className="text-center">
            <p className="text-green-500 mb-4 text-xl ">You are the Scrum Master</p>
            <button
              onClick={handleStartVoting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition duration-300 shadow-md"
            >
              Start Voting
            </button>
          </div>
        ) : (
          <p className="text-xl text-blue-600 text-center">You are a member: {memberName}</p>
        )}
      </div>
    </div>
  );
};

export default RoomLobby;
