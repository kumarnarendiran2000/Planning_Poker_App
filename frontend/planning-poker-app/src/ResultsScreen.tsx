import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import Axios

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

  useEffect(() => {
    if (isScrumMaster) {
      document.title = `Planning Poker - Scrum Master`;
    } else {
      document.title = `Planning Poker - Member: ${memberName}`;
    }
  }, [isScrumMaster, memberName]);

  // Function to handle revote (for Scrum Master only)
  const handleRevote = async () => {
    try {
      const response = await axios.post('http://localhost:3000/revote', {
        RoomCode: roomCode,
      });
      const data = response.data;
      if (data.success) {
        // Reset state for revote
        setVotes([]);
        setVoteStats(null);
        
        // Redirect back to the voting screen for Scrum Master to see the "Reveal Votes" button again
        navigate(`/voting/${roomCode}`, { state: { isScrumMaster, memberName } });
      } else {
        console.error('Failed to initiate revote:', data.message);
      }
    } catch (error) {
      console.error('Error initiating revote:', error);
    }
  };

  // Fetch the votes and stats when the page loads
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await axios.post('http://localhost:3000/reveal-votes', {
          RoomCode: roomCode,
        });

        const data = response.data;
        if (data.success && data.votes.length > 0) {
          setVotes(data.votes);
          // Fetch voting statistics
          const statsResponse = await axios.get('http://localhost:3000/voting-stats', {
            params: { RoomCode: roomCode },
          });
          const statsData = statsResponse.data;
          setVoteStats(statsData.stats);
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
        const response = await axios.get('http://localhost:3000/revote-status', {
          params: { RoomCode: roomCode },
        });
        const data = response.data;
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
    if (isRevote) {
      navigate(`/voting/${roomCode}`, { state: { memberName, isScrumMaster } }); 
    }
  }, [isRevote, navigate, roomCode, isScrumMaster, memberName]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-3xl">
        <h1 className="text-4xl font-bold text-center mb-8">Voting Results</h1>
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Room Code: {roomCode}</h2>
        
        {!isScrumMaster ? (
          <p className="text-lg mb-6">You are a Member: <strong>{memberName}</strong></p>
        ):( 
          <p className="text-lg mb-6">You are <strong>{memberName}</strong></p>
        )}

        {loading ? (
          <p className="text-gray-500">Loading results...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            {/* Votes Section */}
            <div className="bg-green-50 p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-semibold mb-4">Member Votes:</h2>
              {votes.length > 0 ? (
                <ul className="space-y-4">
                  {votes.map((v: Vote, index) => (
                    <li key={index} className="text-xl text-gray-800">
                      <span className="font-semibold">{v.MemberName}</span>: {v.VoteValue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 font-bold text-2xl">No votes available.</p>
              )}
            </div>

            {/* Voting Statistics Section */}
            {voteStats && (
              <div className="mt-4 bg-yellow-50 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-4">Voting Statistics:</h2>
                <div className="text-lg text-gray-700 space-y-2">
                  <p><span className="font-bold">Average Vote:</span> {voteStats.AverageVote}</p>
                  <p><span className="font-bold">Minimum Vote:</span> {voteStats.MinVote}</p>
                  <p><span className="font-bold">Maximum Vote:</span> {voteStats.MaxVote}</p>
                  <p><span className="font-bold">Total Votes:</span> {voteStats.TotalVotes}</p>
                </div>
              </div>
            )}

            {/* Revote Button */}
            {isScrumMaster && (
              <button
                onClick={handleRevote}
                className="mt-8 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                Start a New Revote
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsScreen;
