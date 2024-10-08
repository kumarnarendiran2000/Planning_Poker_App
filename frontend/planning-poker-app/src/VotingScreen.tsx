import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';

const VotingScreen: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;
  const navigate = useNavigate();

  const [textVote, setTextVote] = useState<string>(''); 
  const [votes, setVotes] = useState<{ MemberName: string, VoteValue: number | string }[]>([]);
  const [revealVotes, setRevealVotes] = useState<boolean>(false);
  const [castedVote, setCastedVote] = useState<string | number | null>(null); 
  const [voteStats, setVoteStats] = useState<{ AverageVote: number; MinVote: number; MaxVote: number; TotalVotes: number } | null>(null); 
  const [error, setError] = useState<string>(''); 
  const inputRef = useRef<HTMLInputElement | null>(null); 

  // Function to cast a vote
  const handleVote = async (voteValue: number) => {
    try {
      const response = await fetch('http://localhost:3000/cast-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RoomCode: roomCode, MemberName: memberName, VoteValue: voteValue }),
      });
      const data = await response.json();
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
      const voteValue = textVote;
      const response = await fetch('http://localhost:3000/cast-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RoomCode: roomCode, MemberName: memberName, VoteValue: voteValue }),
      });
      const data = await response.json();
      if (data.success) {
        setCastedVote(voteValue);
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
    try {
      const response = await fetch('http://localhost:3000/reveal-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RoomCode: roomCode }),
      });
      const data = await response.json();
      if (data.success) {
        setRevealVotes(true);
        setVotes(data.votes);
        const statsResponse = await fetch(`http://localhost:3000/voting-stats?RoomCode=${roomCode}`);
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setVoteStats(statsData.stats);
        }
      } else {
        console.error('Failed to reveal votes:', data.message);
      }
    } catch (error) {
      console.error('Error revealing votes:', error);
    }
  };

  // Function to handle revote
  const handleRevote = async () => {
    try {
      const response = await fetch('http://localhost:3000/revote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RoomCode: roomCode }),
      });
      const data = await response.json();
      if (data.success) {
        // Reset state for revote
        setRevealVotes(false);
        setVotes([]);
        setCastedVote(null);
        setVoteStats(null);
        
        // Redirect everyone back to their voting pages
        navigate(`/voting/${roomCode}`, { state: { isScrumMaster, memberName } });
      } else {
        console.error('Failed to initiate revote:', data.message);
      }
    } catch (error) {
      console.error('Error initiating revote:', error);
    }
  };

  // Poll the backend to check if the session is frozen and redirect members to results page if votes are revealed
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3000/voting-freeze-status?RoomCode=${roomCode}`);
        const data = await response.json();

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
    if (revealVotes && !isScrumMaster) {
      // Only redirect members, Scrum Master will stay on the voting screen
      navigate(`/results/${roomCode}`, { state: { votes, voteStats, memberName } });
    }
  }, [revealVotes, navigate, roomCode, votes, voteStats, memberName, isScrumMaster]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Voting Room: {roomCode}</h1>
        {isScrumMaster ? (
          <p className="text-green-500 mb-4 text-center">You are the Scrum Master</p>
        ) : (
          <p className="text-blue-500 mb-4 text-center">You are a Member: {memberName}</p>
        )}

        {!revealVotes ? (
          <div className="mb-6">
            {isScrumMaster ? (
              <>
                <button
                  onClick={handleRevealVotes}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 w-full rounded transition duration-300"
                >
                  Reveal Votes
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Cast Your Vote</h2>
                <div className="flex justify-around">
                  {[1, 2, 3, 5, 8, 13].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleVote(value)}
                      className={`py-3 px-5 rounded transition duration-300 ${castedVote === value ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
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
                    className="border border-gray-300 py-2 px-4 rounded focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleTextVote}
                    className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition duration-300"
                  >
                    Submit Text Vote
                  </button>
                </div>
                {error && <p className="text-red-500">{error}</p>}
                {castedVote && <p className="text-green-500 font-semibold mt-2">You voted: {castedVote}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-100 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Votes</h2>
            <ul className="space-y-2">
              {votes.map((v, index) => (
                <li key={index} className="text-lg text-gray-800">{v.MemberName}: {v.VoteValue}</li>
              ))}
            </ul>
            {voteStats && (
              <div className="mt-4 bg-gray-100 p-4 rounded">
                <h2 className="text-xl font-semibold mb-2">Voting Statistics</h2>
                <p>Average Vote: {voteStats.AverageVote}</p>
                <p>Minimum Vote: {voteStats.MinVote}</p>
                <p>Maximum Vote: {voteStats.MaxVote}</p>
                <p>Total Votes: {voteStats.TotalVotes}</p>
              </div>
            )}
            {isScrumMaster && (
              <button
                onClick={handleRevote}
                className="bg-red-500 hover:bg-red-600 text-white py-3 px-4 w-full rounded transition duration-300 mt-4"
              >
                Revote
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingScreen;
