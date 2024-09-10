import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';

const VotingScreen: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;

  const [vote, setVote] = useState<number | null>(null);
  const [votes, setVotes] = useState<{ member: string, vote: number }[]>([]);
  const [revealVotes, setRevealVotes] = useState<boolean>(false);

  // Handle voting by members
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
              {[1, 2, 3, 5, 8, 13].map((value) => (
                <button
                  key={value}
                  onClick={() => handleVote(value)}
                  className={`py-2 px-4 m-2 rounded ${vote === value ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {revealVotes && (
        <div className="bg-white shadow-md rounded p-4 w-1/2">
          <h2 className="text-xl font-semibold mb-2">Votes</h2>
          <ul>
            {votes.map((v, index) => (
              <li key={index} className="mb-1">{v.member}: {v.vote}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default VotingScreen;
