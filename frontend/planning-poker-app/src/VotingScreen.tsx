import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import Axios

const VotingScreen: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;
  const navigate = useNavigate();

  const [textVote, setTextVote] = useState<string>(''); 
  const [revealVotes, setRevealVotes] = useState<boolean>(false);
  const [castedVote, setCastedVote] = useState<string | number | null>(null);  
  const [error, setError] = useState<string>('');  
  const inputRef = useRef<HTMLInputElement | null>(null); 

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
        MemberName: memberName,
        VoteValue: voteValue,
      });
      const data = response.data;
      if (data.success) {
        setCastedVote(voteValue); 
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

    try {
      const response = await axios.post('http://localhost:3000/cast-vote', {
        RoomCode: roomCode,
        MemberName: memberName,
        VoteValue: textVote,
      });
      const data = response.data;
      if (data.success) {
        setCastedVote(textVote);
        setTextVote(''); 
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
      // Only redirect members, Scrum Master will stay on the voting screen
      navigate(`/results/${roomCode}`, { state: { memberName, isScrumMaster } });
    }
  }, [revealVotes, navigate, roomCode, memberName, isScrumMaster]);

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
            {isScrumMaster ? (
              <button
                onClick={handleRevealVotes}
                className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 w-full rounded-lg transition duration-300 shadow-md"
              >
                Reveal Votes
              </button>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">Cast Your Vote</h2>
                <div className="flex justify-around space-x-4">
                  {[1, 2, 3, 5, 8, 13].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleVote(value)}
                      className={`py-3 px-5 rounded-lg transition duration-300 ${
                        castedVote === value ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                      }`}
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
                    placeholder="Enter text vote"
                    className="border border-gray-300 py-3 px-4 rounded-lg w-full focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleTextVote}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 text-sm rounded-md transition duration-300 whitespace-nowrap"
                  >
                    Submit Text Vote
                  </button>
                </div>
                {error && <p className="text-red-500 mt-2 text-center">{error}</p>}
                {castedVote && <p className="text-green-500 font-semibold mt-2 text-center">You voted: {castedVote}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingScreen;
