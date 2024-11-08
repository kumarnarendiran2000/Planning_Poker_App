import React, { useState, useEffect } from 'react';
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
        // Clear any old Scrum Master session
        localStorage.removeItem('ScrumMasterSession');
  
        // Store the new Scrum Master session data
        localStorage.setItem(
          'ScrumMasterSession',
          JSON.stringify({ roomCode: data.RoomCode, scrumMasterId: data.ScrumMasterId, isScrumMaster: true })
        );
  
        // Navigate to the room lobby
        navigate(`/room/${data.RoomCode}`, { state: { isScrumMaster: true, scrumMasterId: data.ScrumMasterId } });
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  useEffect(() => {
    const savedScrumMasterSession = localStorage.getItem('ScrumMasterSession');
    
    if (savedScrumMasterSession) {
      const sessionData = JSON.parse(savedScrumMasterSession);
      
      if (sessionData && sessionData.isScrumMaster) {
        navigate(`/room/${sessionData.roomCode}`, {
          state: {
            roomCode: sessionData.RoomCode,
            scrumMasterId: sessionData.scrumMasterId,
            isScrumMaster: true,
          },
        });
      }
    }
  }, [navigate]);  
  

  const handleJoinRoom = async () => {
    // Clear errors before checking validations
    setError({ roomCode: '', memberName: '', general: '' });

    if (!roomCode || roomCode.length < 8) {
      setError((prev) => ({ ...prev, roomCode: 'Valid Room Code is required' }));
      return;
    }

    if (!memberName) {
      setError((prev) => ({ ...prev, memberName: 'Member Name is required' }));
      return;
    }

    const response1 = await axios.get('http://localhost:3000/check-room-status', { params: { roomCode } });
    
    if (response1.data && !response1.data.isActive) {
      setError((prev) => ({ ...prev, general: 'This room has ended. Please contact the Scrum Master or create a new room.' }));
      return;
    }

    // Check if MemberId exists in localStorage
    const storedMemberId = localStorage.getItem(`MemberId_${roomCode}`);
    const storedMemberName = localStorage.getItem(`MemberName_${roomCode}`)
    if (storedMemberId && storedMemberName === memberName) {
      // Use existing member session
      navigate(`/room/${roomCode}`, { state: { memberId: storedMemberId, memberName } });
    }else if(storedMemberId && storedMemberName !== memberName){
      // MemberId exists but the name has changed, update the name in the database
      try {
        const response = await axios.post('http://localhost:3000/update-member-name', {
          MemberId: storedMemberId,
          MemberName: memberName,  // New name to update
        });
        if (response.data.success) {
          // Update local storage with the new name
          localStorage.setItem(`MemberName_${roomCode}`, memberName);
    
          // Continue to the room with updated member info
          navigate(`/room/${roomCode}`, { state: { memberId: storedMemberId, memberName } });
        } else {
          setError((prev) => ({ ...prev, general: 'Failed to update member name.' }));
        }
      } catch (error) {
        console.error('Error:', error);
        setError((prev) => ({ ...prev, general: 'Failed to update member name. Please try again.' }));
      }
    } else {
      try {
        const response = await axios.post('http://localhost:3000/join-room', {
          RoomCode: roomCode,
          MemberName: memberName,
        });
        const data = response.data;
        if (data.success) {
          // Store MemberId in localStorage
          localStorage.setItem(`MemberName_${roomCode}`, memberName);
          localStorage.setItem(`MemberId_${roomCode}`, data.memberId);
          navigate(`/room/${roomCode}`, { state: { memberId: data.memberId, memberName } });
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
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full">
        <h1 className="text-4xl font-extrabold text-center text-blue-600 mb-10">PLANNING POKER</h1>

        {error.general && <p className="text-red-500 text-center mb-6">{error.general}</p>}

        <div className="flex flex-col space-y-6">
          <button
            onClick={handleCreateRoom}
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-5 text-lg rounded-lg transition duration-300 shadow-lg"
          >
            Create Room
          </button>

          <div className="relative">
            <label className="block text-xl font-semibold text-gray-800 mb-2">Room Code <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Enter Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className={`border border-gray-400 py-3 px-5 rounded-lg w-full text-lg focus:outline-none ${
                error.roomCode ? 'border-red-500' : 'focus:border-blue-500'
              }`}
            />
            {error.roomCode && <p className="text-red-500 text-sm mt-2">{error.roomCode}</p>}
          </div>

          <div className="relative">
            <label className="block text-xl font-semibold text-gray-800 mb-2">Your Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Enter Your Name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className={`border border-gray-400 py-3 px-5 rounded-lg w-full text-lg focus:outline-none ${
                error.memberName ? 'border-red-500' : 'focus:border-blue-500'
              }`}
            />
            {error.memberName && <p className="text-red-500 text-sm mt-2">{error.memberName}</p>}
          </div>

          <button
            onClick={handleJoinRoom}
            className="bg-green-500 hover:bg-green-600 text-white py-3 px-5 text-lg rounded-lg transition duration-300 shadow-lg"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
