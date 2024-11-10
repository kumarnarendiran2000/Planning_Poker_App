import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import Axios

// Define the type for a vote
interface Vote {
  MemberId: string;
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
  const memberId = location.state?.memberId;
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

  useEffect(() => {
    const eventSource = new EventSource(`http://localhost:3000/sse/room-status?roomCode=${roomCode}`);
  
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.isActive === false) {
        // Perform cleanup actions if the session is inactive
        alert('This session has ended.');
        navigate('/'); // Redirect to landing or home
        localStorage.removeItem(`MemberName_${roomCode}`);
        localStorage.removeItem(`MemberId_${roomCode}`);
      }
    };
  
    eventSource.onerror = (error) => {
      console.error("Error with SSE:", error);
      eventSource.close();
    };
  
    return () => {
      eventSource.close(); // Clean up on unmount
    };
  }, [navigate, roomCode]);

  useEffect(() => {
    const eventSource = new EventSource(`http://localhost:3000/sse/revote-status?RoomCode=${roomCode}`);
  
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.isRevote !== undefined) {
        setIsRevote(data.isRevote); // Update the revote status from SSE data
      }
    };
  
    eventSource.onerror = (error) => {
      console.error("Error with SSE:", error);
      eventSource.close(); // Close the connection on error
    };
  
    return () => {
      eventSource.close(); // Clean up on component unmount
    };
  }, [roomCode]);

  
   // Redirect members to voting screen once revote is initiated
   useEffect(() => {
    if (isRevote) {
      navigate(`/voting/${roomCode}`, { state: { memberName, memberId, isScrumMaster } });
    }
  }, [isRevote, navigate, roomCode, isScrumMaster, memberId, memberName]);

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
        navigate(`/voting/${roomCode}`, { state: { isScrumMaster, memberName, memberId } });
      } else {
        console.error('Failed to initiate revote:', data.message);
      }
    } catch (error) {
      console.error('Error initiating revote:', error);
    }
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


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-3xl overflow-y-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Voting Results</h1>
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Room Code: {roomCode}</h2>
  
        {!isScrumMaster ? (
          <p className="text-lg mb-6">
            You are a Member: <strong>{memberName}</strong>
          </p>
        ) : (
          <p className="text-lg mb-6">You are the <strong>Scrum Master</strong></p>
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
  
            {/* Revote and End Session Buttons */}
            {isScrumMaster && (
              <div className="space-y-4 mt-8">
                <button
                  onClick={handleRevote}
                  className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg transition duration-300 shadow-md w-full"
                >
                  Start a New Revote
                </button>
                <button
                  onClick={handleEndSession}
                  className="bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition duration-300 shadow-md w-full"
                >
                  End Session
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsScreen;
