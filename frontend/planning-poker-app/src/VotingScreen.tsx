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

  useEffect(() => {
    // Fetch votes from the backend
    const fetchVotes = async () => {
      try {
        const response = await fetch(`http://localhost:3000/votes?RoomCode=${roomCode}`);
        const data = await response.json();
        if (data.success) {
          setVotes(data.votes);
          setRevealVotes(data.revealVotes);
        }
      } catch (error) {
        console.error('Failed to fetch votes:', error);
      }
    };

    fetchVotes();
  }, [roomCode]);

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
        setVote(voteValue);
      } else {
        console.error('Failed to cast vote:', data.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

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
      if (data.success) {
        setRevealVotes(true);
        setVotes(data.votes);
      } else {
        console.error('Failed to reveal votes:', data.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

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
