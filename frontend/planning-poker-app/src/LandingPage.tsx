import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import Axios

const LandingPage: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [error, setError] = useState({ roomCode: '', memberName: '', general: '' });
  const navigate = useNavigate();

  // Set the default title
  useEffect(() => {
    document.title = 'Planning Poker';
  }, []);

  const handleCreateRoom = async () => {
    try {
      const response = await axios.post('http://localhost:3000/create-room');
      const data = response.data;
      if (data.success) {
        navigate(`/room/${data.RoomCode}`, { state: { isScrumMaster: true, memberName: 'Scrum Master' } });
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      setError((prev) => ({ ...prev, general: 'Failed to create room. Please try again.' }));
    }
  };

  const handleJoinRoom = async () => {
    // Clear errors before checking validations
    setError({ roomCode: '', memberName: '', general: '' });

    if (!roomCode) {
      setError((prev) => ({ ...prev, roomCode: 'Room Code is required' }));
    }

    if (!memberName) {
      setError((prev) => ({ ...prev, memberName: 'Member Name is required' }));
    }

    // Check for valid room code format (e.g., at least 8 characters)
    if (roomCode && roomCode.length < 8) {
      setError((prev) => ({ ...prev, roomCode: 'Room Code must be at least 8 characters long' }));
      return;
    }

    if (roomCode && memberName) {
      try {
        const response = await axios.post('http://localhost:3000/join-room', {
          RoomCode: roomCode,
          MemberName: memberName,
        });
        const data = response.data;
        if (data.success) {
          navigate(`/room/${roomCode}`, { state: { memberName } });
        } else {
          setError((prev) => ({ ...prev, general: 'Room not found. Please check the Room Code.' }));
        }
      } catch (error) {
        console.error('Error:', error);
        setError((prev) => ({ ...prev, general: 'Failed to join room. Please try again.' }));
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Planning Poker</h1>

        {error.general && <p className="text-red-500 mb-4 text-center">{error.general}</p>}

        <div className="flex flex-col space-y-4">
          <button
            onClick={handleCreateRoom}
            className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded transition duration-300"
          >
            Create Room
          </button>

          {/* Room Code Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">
              Room Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className={`border border-gray-300 py-3 px-4 rounded w-full ${
                error.roomCode ? 'border-red-500' : ''
              } focus:outline-none focus:border-blue-500`}
            />
            {error.roomCode && <p className="text-red-500 text-sm mt-1">{error.roomCode}</p>}
          </div>

          {/* Member Name Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Your Name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className={`border border-gray-300 py-3 px-4 rounded w-full ${
                error.memberName ? 'border-red-500' : ''
              } focus:outline-none focus:border-blue-500`}
            />
            {error.memberName && <p className="text-red-500 text-sm mt-1">{error.memberName}</p>}
          </div>

          <button
            onClick={handleJoinRoom}
            className="bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded transition duration-300"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
