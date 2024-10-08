import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';

// Define the type for a vote
interface Vote {
  MemberName: string;
  VoteValue: number | string;
}

const ResultsScreen: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [votes, setVotes] = useState<Vote[]>([]);
  const [voteStats, setVoteStats] = useState<{ AverageVote: number; MinVote: number; MaxVote: number; TotalVotes: number } | null>(null);
  const isScrumMaster = location.state?.isScrumMaster;
  const memberName = location.state?.memberName;
  const [loading, setLoading] = useState<boolean>(true); 
  const [error, setError] = useState<string>(''); 
  const [isRevote, setIsRevote] = useState<boolean>(false); 

  // Fetch the votes and stats when the page loads
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true); 
        setError(''); 

        // Fetch votes
        const response = await fetch(`http://localhost:3000/reveal-votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ RoomCode: roomCode }),
        });

        const data = await response.json();
        if (data.success && data.votes.length > 0) {
          setVotes(data.votes);

          // Fetch voting statistics
          const statsResponse = await fetch(`http://localhost:3000/voting-stats?RoomCode=${roomCode}`);
          const statsData = await statsResponse.json();
          if (statsData.success) {
            setVoteStats(statsData.stats);
          }
        } else {
          setError('No votes available yet.'); 
        }
      } catch (error) {
        setError('Failed to fetch results. Please try again later.');
        console.error('Error fetching results:', error);
      } finally {
        setLoading(false); 
      }
    };

    fetchResults();
  }, [roomCode]);

  // Polling to check if revote is initiated
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3000/revote-status?RoomCode=${roomCode}`);
        const data = await response.json();
        console.log('Revote Status Response:', data);
        if (data.success && data.isRevote) {
          setIsRevote(true); 
        }
      } catch (error) {
        console.error('Failed to fetch revote status:', error);
      }
    }, 2000); 

    return () => clearInterval(intervalId); 
  }, [roomCode]);

  // Redirect members to voting screen once revote is initiated
  useEffect(() => {
    if (isRevote && !isScrumMaster) {
      navigate(`/voting/${roomCode}`, { state: { memberName } }); 
    }
  }, [isRevote, navigate, roomCode, isScrumMaster, memberName]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Voting Results for Room: {roomCode}</h1>

        {loading ? (
          <p className="text-gray-500">Loading results...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <div className="bg-gray-100 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Votes</h2>
              {votes.length > 0 ? (
                <ul className="space-y-2">
                  {votes.map((v: Vote, index) => (
                    <li key={index} className="text-lg text-gray-800">
                      {v.MemberName}: {v.VoteValue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No votes available.</p>
              )}
            </div>

            {voteStats && (
              <div className="mt-4 bg-gray-100 p-4 rounded">
                <h2 className="text-xl font-semibold mb-2">Voting Statistics</h2>
                <p>Average Vote: {voteStats.AverageVote}</p>
                <p>Minimum Vote: {voteStats.MinVote}</p>
                <p>Maximum Vote: {voteStats.MaxVote}</p>
                <p>Total Votes: {voteStats.TotalVotes}</p>
              </div>
            )}

            {!isScrumMaster && <p className="text-blue-600">You are: {memberName}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsScreen;
