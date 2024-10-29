import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import Axios

interface Member {
  MemberId: string;
  MemberName: string;
  IsDone: boolean;
}

const VotingScreen: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;
  const memberId = location.state?.memberId;
  const navigate = useNavigate();

  const [textVote, setTextVote] = useState<string>(''); 
  const [revealVotes, setRevealVotes] = useState<boolean>(false);
  const [castedVote, setCastedVote] = useState<string | number | null>(null);  
  const [error, setError] = useState<string>('');  
  const inputRef = useRef<HTMLInputElement | null>(null); 
  const [members, setMembers] = useState<{ name: string; isDone: boolean }[]>([]);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [allMembersDone, setAllMembersDone] = useState<boolean>(false);

  useEffect(() => {
    if (isScrumMaster) {
      document.title = `Planning Poker - Scrum Master`;
    } else {
      document.title = `Planning Poker - Member: ${memberName}`;
    }
  }, [isScrumMaster, memberName]);

  // Function to cast a vote
  const handleVote = async (voteValue: number) => {
    try {
      const response = await axios.post('http://localhost:3000/cast-vote', {
        RoomCode: roomCode,
        MemberId: memberId,
        VoteValue: voteValue,
      });
      const data = response.data;
      if (data.success) {
        setCastedVote(voteValue); 
        setTextVote('');
        setError('');
      } else {
        console.error('Failed to cast vote:', data.message);
      }
    } catch (error) {
      console.error('Error casting vote:', error);
    }
  };

  // Function to handle text vote
  const handleTextVote = async () => {
    if (!textVote) {
      setError('Text vote cannot be empty!');
      return;
    }

    if (!/^\d+$/.test(textVote)) {
      setError('Please enter a valid number.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:3000/cast-vote', {
        RoomCode: roomCode,
        MemberId: memberId,
        VoteValue: textVote,
      });
      const data = response.data;
      if (data.success) {
        setCastedVote(textVote); 
        inputRef.current?.blur();
        setError('');
      } else {
        console.error('Failed to cast vote:', data.message);
      }
    } catch (error) {
      console.error('Error casting vote:', error);
    }
  };

  // Function to reveal votes
  const handleRevealVotes = async () => {
    setRevealVotes(true);
  };

  const handleEndSession = async () => {
    //const roomCode = localStorage.getItem('CurrentRoomCode'); // Assume this is set when the room is created
  
    try {

      localStorage.removeItem('ScrumMasterSession'); // Clear using the same exact key
    

      // Call the backend to end the session by setting IsActive to 0
      await axios.post('http://localhost:3000/end-session', { roomCode });
  
      // Redirect to the landing page
      navigate('/');
    } catch (error) {
      console.error('Failed to end session:', error);
      alert('Error ending the session. Please try again.');
    }
  };

  useEffect(() => {
    const checkRoomStatus = async () => {
      try {
        const response = await axios.get('http://localhost:3000/check-room-status', {
          params: { roomCode },
        });
        if (response.data && !response.data.isActive) {
          alert('This session has ended.');
          navigate('/'); // Redirect to the landing page
          // Clear local storage
          localStorage.removeItem(`MemberName_${roomCode}`);
          localStorage.removeItem(`MemberId_${roomCode}`);
        }
      } catch (error) {
        console.error('Error checking room status:', error);
      }
    };
  
    const interval = setInterval(checkRoomStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval); // Cleanup on unmount
  }, [roomCode, navigate]);
  
  useEffect(() => {
    const fetchVoteAndDoneStatus = async () => {
      try {
        const response = await axios.get('http://localhost:3000/get-casted-vote', {
          params: { RoomCode: roomCode, MemberId: memberId },
        });
        const data = response.data;
  
        if (data.success && data.castedVote !== null) {
          const voteValue = data.castedVote;
  
          // Check if the voteValue matches any static option
          if ([1, 2, 3, 5, 8, 13].includes(voteValue)) {
            setCastedVote(voteValue); // For static options
            setTextVote(''); // Clear the text box
          } else {
            setTextVote(voteValue); // Restore text vote
            setCastedVote(voteValue); // Clear static options
          }
  
          // Set the done status
          setIsDone(data.isDone); // Update "done" status from the database
        }
      } catch (error) {
        console.error('Error fetching the vote and done status:', error);
      }
    };
  
    fetchVoteAndDoneStatus();
  }, [roomCode, memberId]);
  
  

  // Poll the backend to check if the session is frozen and redirect members to results page if votes are revealed
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get('http://localhost:3000/voting-freeze-status', {
          params: { RoomCode: roomCode },
        });
        const data = response.data;
        if (data.success && data.VotingFrozen) {
          setRevealVotes(true); // Update revealVotes to trigger useEffect below
        }
      } catch (error) {
        console.error('Failed to fetch freeze status:', error);
      }
    }, 2000);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [roomCode]);

  // Redirect members to results page once votes are revealed
  useEffect(() => {
    if (revealVotes) {
      navigate(`/results/${roomCode}`, { state: { memberName, isScrumMaster, memberId } });
    }
  }, [revealVotes, navigate, roomCode, memberName, isScrumMaster, memberId]);

  const handleToggleDone = async () => {
    if (isDone) {
      // Call the API to unmark as done
      try {
        const response = await axios.post('http://localhost:3000/unmark-done', {
          RoomCode: roomCode,
          MemberId: memberId,
        });

        if (response.data.success) {
          setIsDone(false);  // Set `isDone` to false
        } else {
          console.error('Failed to unmark as done:', response.data.message);
        }
      } catch (error) {
        console.error('Error unmarking as done:', error);
      }
    } else {
      // Call the API to mark as done
      try {
        const response = await axios.post('http://localhost:3000/mark-done', {
          RoomCode: roomCode,
          MemberId: memberId,
        });

        if (response.data.success) {
          setIsDone(true);  // Set `isDone` to true
        } else {
          console.error('Failed to mark as done:', response.data.message);
        }
      } catch (error) {
        console.error('Error marking as done:', error);
      }
    }
  };

  // Poll members' done status every 2 seconds
useEffect(() => {
  const fetchMembersDoneStatus = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/members-done-status?RoomCode=${roomCode}`);

      if (response.data.success) {
        const updatedMembers = response.data.members.map((member: Member) => ({
          name: member.MemberName,
          isDone: member.IsDone,
        }));

        setMembers(updatedMembers);

        // Fixing the property reference here
        const allDone = updatedMembers.every((member: { isDone: boolean }) => member.isDone);
        setAllMembersDone(allDone);
      } else {
        console.error('Failed to fetch members done status:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching members done status:', error);
    }
  };

  const interval = setInterval(fetchMembersDoneStatus, 2000);
  return () => clearInterval(interval);
}, [roomCode]);


  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8">Voting Room: {roomCode}</h1>

        {isScrumMaster ? (
          <p className="text-xl text-green-500 mb-6 text-center">You are the Scrum Master</p>
        ) : (
          <p className="text-xl text-blue-500 mb-6 text-center">You are a Member: {memberName}</p>
        )}

        {!revealVotes && (
          <div className="mb-6">
            {isScrumMaster && (
              <button
                onClick={handleRevealVotes}
                disabled={!allMembersDone} 
                className={`py-3 px-6 w-full rounded-lg transition duration-300 shadow-md 
                  ${!allMembersDone ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white '}`}
              >
                Reveal Votes
              </button>
            )}
            {isScrumMaster && (
              <div className="bg-gray-100 p-6 rounded-lg mb-6 shadow-md mt-8"> {/* Added margin-top (mt-8) */}
              <h2 className="text-2xl font-bold mb-4 text-gray-700">Members Done Status</h2>
              
              <ul className="space-y-3">
                {members.map((member, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm"
                  >
                    {/* Member name */}
                    <span className="text-lg font-medium text-gray-800">{member.name}</span>
            
                    {/* Status with simple color coding */}
                    {member.isDone ? (
                      <span className="text-green-600 font-bold">Done</span>
                    ) : (
                      <span className="text-red-600 font-bold">Not Done</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            )}
            {isScrumMaster && (
              <div>
                <button
                  onClick={handleEndSession}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition duration-300 shadow-md w-full"
                >
                  End Session
                </button>
              </div>
            )}
            {!isScrumMaster && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">Cast Your Vote</h2>
                <div className="flex justify-around space-x-4">
                  {[1, 2, 3, 5, 8, 13].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleVote(value)}
                      disabled={isDone} // Disable when done
                      className={`flex justify-center items-center w-16 h-12 py-2 rounded-lg transition duration-300 text-xl font-semibold
                        ${castedVote === value ? 'bg-blue-500 text-white' : 'bg-gray-300 hover:bg-gray-300'}
                        ${isDone ? 'bg-gray-200 cursor-not-allowed' : ''}`}                        
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={textVote}
                    onChange={(e) => setTextVote(e.target.value)}
                    disabled={isDone} // Disable when done
                    placeholder="Enter text vote (only numbers)"
                    className={`border-4 py-2 px-4 rounded-lg focus:outline-none transition duration-300 w-full text-2xl font-semibold text-center
                      ${castedVote === textVote ? 'border-blue-600' : 'border-gray-400 focus:border-green-500'}
                      ${isDone ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                  />
                  <button
                    onClick={handleTextVote}
                    disabled={isDone} // Disable when done
                    className={` py-2 px-4 text-sm rounded-md transition duration-300 whitespace-nowrap 
                      ${isDone ? 'bg-gray-200 cursor-not-allowed' : 'bg-green-500 hover:bg-green-700 text-white'}`}
                  >
                    Submit Text Vote
                  </button>
                </div>
                {error && <p className="text-red-500 mt-2 text-center">{error}</p>}
                {castedVote && (
                  <div className="mt-4 p-2 bg-green-100 rounded-lg shadow-md text-center">
                    <p className="text-green-700 font-bold text-2xl">
                      You voted: <span className="text-green-900">{castedVote}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col items-center space-y-3 mt-4">
      {!isScrumMaster && (
        <button
          onClick={handleToggleDone}
          className={`py-2 px-5 rounded-md transition duration-200 text-base font-medium ${
            isDone ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isDone ? 'Unmark as Done' : 'Mark as Done'}
        </button>
      )}
    </div>
    </div>
  );
};

export default VotingScreen;
