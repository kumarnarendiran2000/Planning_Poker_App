import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    try {
      const response = await fetch('http://localhost:3000/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        navigate(`/room/${data.RoomCode}`, { state: { isScrumMaster: true } });
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const handleJoinRoom = async () => {
    if (roomCode && memberName) {
      try {
        const response = await fetch('http://localhost:3000/join-room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ RoomCode: roomCode, MemberName: memberName }),
        });
        const data = await response.json();
        if (data.success) {
          navigate(`/room/${roomCode}`, { state: { memberName } });
        } else {
          console.error('Failed to join room:', data.message);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };
  

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Planning Poker</h1>
      <div className="flex space-x-4">
        <button
          onClick={handleCreateRoom}
          className="bg-blue-500 text-white py-2 px-4 rounded"
        >
          Create Room
        </button>
        <input
          type="text"
          placeholder="Enter Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          className="border border-gray-400 py-2 px-4 rounded"
        />
        <input
          type="text"
          placeholder="Your Name"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          className="border border-gray-400 py-2 px-4 rounded"
        />
        <button
          onClick={handleJoinRoom}
          className="bg-green-500 text-white py-2 px-4 rounded"
        >
          Join Room
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
