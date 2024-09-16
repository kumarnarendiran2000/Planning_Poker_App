import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';

const VotingScreen: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;

  const [vote, setVote] = useState<number | null>(null);
  const [textVote, setTextVote] = useState<string>(''); // For text-based vote
  const [votes, setVotes] = useState<{ MemberName: string, VoteValue: number | string }[]>([]);
  const [revealVotes, setRevealVotes] = useState<boolean>(false);
  const [castedVote, setCastedVote] = useState<string | number | null>(null); // Store the vote casted
  const [voteStats, setVoteStats] = useState<{ AverageVote: number; MinVote: number; MaxVote: number; TotalVotes: number } | null>(null); // Vote stats state
  const inputRef = useRef<HTMLInputElement | null>(null); // Ref for focusing out

  // Handle voting by members (number-based)
  const handleVote = async (voteValue: number) => {
    try {
      const response = await fetch('http://localhost:3000/cast-vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ RoomCode: roomCode, MemberName: memberName, VoteValue: voteValue }),
      });
      const data = await response.json();
      if (data.success) {
        setVote(voteValue); // Update local state to reflect the vote
        setCastedVote(voteValue); // Set the vote casted
      } else {
        console.error('Failed to cast vote:', data.message);
      }
    } catch (error) {
      console.error('Error casting vote:', error);
    }
  };

  // Handle voting by members (text-based)
  const handleTextVote = async () => {
    try {
      const voteValue = textVote;
      const response = await fetch('http://localhost:3000/cast-vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ RoomCode: roomCode, MemberName: memberName, VoteValue: voteValue }),
      });
      const data = await response.json();
      if (data.success) {
        setCastedVote(voteValue); // Set the vote casted
        setTextVote(''); // Reset the text input
        inputRef.current?.blur(); // Remove focus after vote is cast
      } else {
        console.error('Failed to cast vote:', data.message);
      }
    } catch (error) {
      console.error('Error casting vote:', error);
    }
  };

  // Handle revealing votes (ScrumMaster)
  const handleRevealVotes = async () => {
    try {
      const response = await fetch('http://localhost:3000/reveal-votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ RoomCode: roomCode }),
      });
      const data = await response.json();
      console.log("Reveal votes response:", data); // Log the response after revealing the votes
      if (data.success) {
        setRevealVotes(true); // Mark votes as revealed
        setVotes(data.votes);  // Directly update votes with the response from reveal-votes

        // Fetch voting stats
        const statsResponse = await fetch(`http://localhost:3000/voting-stats?RoomCode=${roomCode}`);
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setVoteStats(statsData.stats); // Set voting stats after reveal
        }
      } else {
        console.error('Failed to reveal votes:', data.message);
      }
    } catch (error) {
      console.error('Error revealing votes:', error);
    }
  };

  // Poll the votes every 2 seconds to update members' screens if votes are revealed
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (revealVotes) {
        // Poll only when votes have been revealed
        fetch('http://localhost:3000/reveal-votes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ RoomCode: roomCode }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              setVotes(data.votes); // Update votes for members too
            }
          });
      }
    }, 2000); // Poll for votes every 2 seconds

    return () => clearInterval(intervalId); // Cleanup polling on unmount
  }, [roomCode, revealVotes]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Voting Room: {roomCode}</h1>

      {/* Display if the user is a Scrum Master or a Member */}
      {isScrumMaster ? (
        <p className="text-green-500 mb-4">You are the Scrum Master</p>
      ) : (
        <p className="text-blue-500 mb-4">You are a Member: {memberName}</p>
      )}

      {!revealVotes && (
        <div className="mb-4">
          {isScrumMaster ? (
            <button
              onClick={handleRevealVotes}
              className="bg-blue-500 text-white py-2 px-4 rounded"
            >
              Reveal Votes
            </button>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-2">Cast Your Vote</h2>
              <div className="flex items-center space-x-2">  {/* Horizontal Alignment */}
                {[1, 2, 3, 5, 8, 13].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleVote(value)}
                    className={`py-2 px-4 m-2 rounded ${vote === value ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}
                  >
                    {value}
                  </button>
                ))}
                <input
                  type="text"
                  value={textVote}
                  onChange={(e) => setTextVote(e.target.value)}
                  placeholder="Enter your vote"
                  className="border border-gray-400 py-2 px-4 rounded"
                  ref={inputRef}
                />
                <button
                  onClick={handleTextVote}
                  className="bg-green-500 text-white py-2 px-4 ml-2 rounded"
                >
                  Submit
                </button>
              </div>
              {castedVote && <p className="mt-4 text-lg">You casted: {castedVote}</p>}
            </div>
          )}
        </div>
      )}

      {revealVotes && (
        <div className="bg-white shadow-md rounded p-4 w-1/2">
          <h2 className="text-xl font-semibold mb-2">Votes</h2>
          <ul>
            {votes.map((v, index) => (
              <li key={index} className="mb-1">{v.MemberName}: {v.VoteValue}</li>
            ))}
          </ul>

          {/* Display voting statistics */}
          {voteStats && (
            <div className="mt-4 bg-gray-100 p-4 rounded">
              <h2 className="text-xl font-semibold mb-2">Voting Statistics</h2>
              <p>Average Vote: {voteStats.AverageVote}</p>
              <p>Minimum Vote: {voteStats.MinVote}</p>
              <p>Maximum Vote: {voteStats.MaxVote}</p>
              <p>Total Votes: {voteStats.TotalVotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VotingScreen;
