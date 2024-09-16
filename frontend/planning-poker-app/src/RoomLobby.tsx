import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';

const RoomLobby: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;  // Access memberName
  const navigate = useNavigate();

  const [members, setMembers] = useState<string[]>([]);
  const [votingStarted, setVotingStarted] = useState<boolean>(false);

  // Fetch members from the backend and update the state
  useEffect(() => {
    if (!roomCode) return;

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

    fetchMembers(); // Initial fetch

    const intervalId = setInterval(fetchMembers, 2000); // Poll every 2 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [roomCode]);

  // Poll the voting status from the backend and update the state
  useEffect(() => {
    if (!roomCode) return;

    const pollVotingStatus = async () => {
      try {
        const response = await fetch(`http://localhost:3000/voting-status?RoomCode=${roomCode}`);
        const data = await response.json();
        if (data.votingStarted) {
          setVotingStarted(true);
        }
      } catch (error) {
        console.error('Failed to fetch voting status:', error);
      }
    };

    pollVotingStatus(); // Initial check

    const intervalId = setInterval(pollVotingStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [roomCode]);

  // Handle navigation to the voting screen when voting starts
  useEffect(() => {
    if (votingStarted) {
      navigate(`/voting/${roomCode}`, { state: { isScrumMaster, memberName } });
    }
  }, [votingStarted, navigate, roomCode, isScrumMaster, memberName]);

  // Function to handle starting the voting session
  const handleStartVoting = async () => {
    try {
      const response = await fetch('http://localhost:3000/start-voting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ RoomCode: roomCode }),
      });
      const data = await response.json();
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
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Room: {roomCode}</h1>
      <div className="bg-white shadow-md rounded p-4 w-1/2">
        <h2 className="text-xl font-semibold mb-2">Members</h2>
        <ul>
          {members.map((member, index) => (
            <li key={index} className="mb-1">{member}</li>
          ))}
        </ul>
        {isScrumMaster ? (
          <div className="mt-4">
            <p className="text-green-500">You are the Scrum Master!</p>
            <button
              onClick={handleStartVoting}
              className="bg-blue-500 text-white py-2 px-4 mt-4 rounded"
            >
              Start Voting
            </button>
          </div>
        ) : (
          <p className="mt-4 text-blue-600">You are: {memberName}</p>
        )}
      </div>
    </div>
  );
};

export default RoomLobby;
