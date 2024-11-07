import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { connectToDatabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
import { cors } from 'hono/cors';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';


const app = new Hono();

// Create the HTTP server for Hono
const honoServer = serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Hono server is running at http://${info.address}:${info.port}`);
  }
);

// Initialize Socket.IO with the HTTP server
const io = new SocketIOServer(honoServer as unknown as HttpServer, {
  path: '/ws',
  cors: {
    origin: '*', // Allow all origins for testing
  },
});

// Handle the 'connection' event when a client connects
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Emitting a test event to all connected clients every second
  const intervalId = setInterval(() => {
    socket.emit('hello', 'world');
  }, 1000);

  // Disconnect event for cleanup
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    clearInterval(intervalId); // Stop emitting on disconnection
  });
});

// Log any Socket.IO errors
io.on('error', (error) => {
  console.error('Socket.IO error:', error);
});

// Enable CORS for all routes
app.use('*', cors());

app.get('/', async (c) => {
  const pool = await connectToDatabase();
  return c.text('Planning Poker Backend');
});


app.post('/create-room', async (c) => {
  const pool = await connectToDatabase();
  const RoomId = uuidv4();
  const ScrumMasterId = uuidv4();
  const RoomCode = Math.random().toString(36).substr(2, 8).toUpperCase();

  try {
    const result = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .input('ScrumMasterId', sql.UniqueIdentifier, ScrumMasterId)
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`INSERT INTO Rooms (RoomId, ScrumMasterId, RoomCode) 
              VALUES (@RoomId, @ScrumMasterId, @RoomCode)`);

    return c.json({ success: true, RoomCode });
  } catch (error) {
    console.error('Error creating room:', error);
    return c.json({ success: false, message: 'Failed to create room' }, 500);
  }
});


  app.post('/join-room', async (c) => {
    const { RoomCode, MemberName } = await c.req.json();
    const pool = await connectToDatabase();

    try {
      const roomResult = await pool.request()
        .input('RoomCode', sql.NVarChar(50), RoomCode)
        .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

      if (roomResult.recordset.length === 0) {
        return c.json({ success: false, message: 'Room not found' }, 404);
      }

      const RoomId = roomResult.recordset[0].RoomId;
      const MemberId = uuidv4(); 

      await pool.request()
        .input('MemberId', sql.UniqueIdentifier, MemberId)
        .input('RoomId', sql.UniqueIdentifier, RoomId)
        .input('MemberName', sql.NVarChar(100), MemberName)
        .query(`INSERT INTO Members (MemberId, RoomId, MemberName) 
                VALUES (@MemberId, @RoomId, @MemberName)`);

      return c.json({ success: true, message: 'Joined room successfully', memberId: MemberId });
    } catch (error) {
      console.error('Error joining room:', error);
      return c.json({ success: false, message: 'Failed to join room' }, 500);
    }
  });

  app.post('/end-session', async (c) => {
    const { roomCode } = await c.req.json();
    const pool = await connectToDatabase();
  
    try {
      // Update the room's status to inactive
      await pool.request()
        .input('RoomCode', sql.NVarChar(50), roomCode)
        .query(`UPDATE Rooms SET IsActive = 0 WHERE RoomCode = @RoomCode`);
  
      return c.json({ success: true, message: 'Session ended successfully' });
    } catch (error) {
      console.error('Error ending session:', error);
      return c.json({ success: false, message: 'Failed to end session' }, 500);
    }
  });

  app.get('/check-room-status', async (c) => {
    const { roomCode } = c.req.query();
    const pool = await connectToDatabase();
  
    try {
      const result = await pool.request()
        .input('RoomCode', sql.NVarChar(50), roomCode)
        .query(`SELECT IsActive FROM Rooms WHERE RoomCode = @RoomCode`);
  
      if (result.recordset.length === 0) {
        return c.json({ success: false, message: 'Room not found' }, 404);
      }
  
      const isActive = result.recordset[0].IsActive;
      return c.json({ success: true, isActive });
    } catch (error) {
      console.error('Error checking room status:', error);
      return c.json({ success: false, message: 'Failed to check room status' }, 500);
    }
  });
  
  

  app.post('/start-voting', async (c) => {
    const { RoomCode } = await c.req.json();
    const pool = await connectToDatabase();

    try {
      const result = await pool.request()
        .input('RoomCode', sql.NVarChar(50), RoomCode)
        .query(`UPDATE Rooms SET VotingStarted = 1 WHERE RoomCode = @RoomCode`);

      if (result.rowsAffected[0] > 0) {
        return c.json({ success: true, message: 'Voting session started' });
      } else {
        return c.json({ success: false, message: 'Room not found' });
      }
    } catch (error) {
      console.error('Error starting voting session:', error);
      return c.json({ success: false, message: 'Failed to start voting session' }, 500);
    }
  });

  app.post('/update-member-name', async (c) => {
    const {MemberId, MemberName } = await c.req.json();
    const pool = await connectToDatabase();
  
    try {
      // Update the member's name in the Members table
      await pool.request()
        .input('MemberId', sql.UniqueIdentifier, MemberId)
        .input('MemberName', sql.NVarChar(100), MemberName)
        .query(`UPDATE Members SET MemberName = @MemberName WHERE MemberId = @MemberId`);
  
      return c.json({ success: true, message: 'Member name updated successfully' });
    } catch (error) {
      console.error('Error updating member name:', error);
      return c.json({ success: false, message: 'Failed to update member name' }, 500);
    }
  });
  

  app.post('/mark-done', async (c) => {
    const { RoomCode, MemberId } = await c.req.json();
    const pool = await connectToDatabase();

    try {
      // Fetch the RoomId using the RoomCode
      const roomResult = await pool.request()
        .input('RoomCode', sql.NVarChar(50), RoomCode)
        .query(`
          SELECT RoomId 
          FROM Rooms 
          WHERE RoomCode = @RoomCode
        `);

      if (roomResult.recordset.length === 0) {
        return c.json({ success: false, message: 'Room not found' }, 404);
      }

      const RoomId = roomResult.recordset[0].RoomId;

      // Check if the member exists with the given RoomId and MemberId
      const memberResult = await pool.request()
        .input('RoomId', sql.UniqueIdentifier, RoomId)
        .input('MemberId', sql.UniqueIdentifier, MemberId)
        .query(`
          SELECT MemberId 
          FROM Members 
          WHERE RoomId = @RoomId AND MemberId = @MemberId
        `);

      if (memberResult.recordset.length === 0) {
        return c.json({ success: false, message: 'Member not found' }, 404);
      }

      // Update the member's "done" status in the database
      await pool.request()
        .input('MemberId', sql.UniqueIdentifier, MemberId)
        .query(`UPDATE Members SET IsDone = 1 WHERE MemberId = @MemberId`);

      return c.json({ success: true, message: 'Marked as done successfully' });
    } catch (error) {
      console.error('Error marking voting as done:', error);
      return c.json({ success: false, message: 'Failed to mark voting as done' }, 500);
    }
  });

// Unmark as Done API
  app.post('/unmark-done', async (c) => {
    const { RoomCode, MemberId } = await c.req.json();
    const pool = await connectToDatabase();

    try {
      // Fetch the RoomId
      const roomResult = await pool.request()
        .input('RoomCode', sql.NVarChar(50), RoomCode)
        .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

      if (roomResult.recordset.length === 0) {
        return c.json({ success: false, message: 'Room not found' }, 404);
      }

      const RoomId = roomResult.recordset[0].RoomId;

      // Check if the member exists with the given RoomId and MemberId
      const memberResult = await pool.request()
        .input('RoomId', sql.UniqueIdentifier, RoomId)
        .input('MemberId', sql.UniqueIdentifier, MemberId)
        .query(`SELECT MemberId FROM Members WHERE RoomId = @RoomId AND MemberId = @MemberId`);

      if (memberResult.recordset.length === 0) {
        return c.json({ success: false, message: 'Member not found' }, 404);
      }

      // Update the member's "done" status in the database (set IsDone to 0)
      await pool.request()
        .input('MemberId', sql.UniqueIdentifier, MemberId)
        .query(`UPDATE Members SET IsDone = 0 WHERE MemberId = @MemberId`);

      return c.json({ success: true, message: 'Unmarked as done successfully' });
    } catch (error) {
      console.error('Error unmarking as done:', error);
      return c.json({ success: false, message: 'Failed to unmark as done' }, 500);
    }
  });


app.get('/members-done-status', async (c) => {
  const { RoomCode } = c.req.query();
  const pool = await connectToDatabase();

  try {
    // Fetch the RoomId based on RoomCode
    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    // Fetch all members and their done status for the given RoomId
    const membersResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .query(`
        SELECT Members.MemberId, Members.MemberName, Members.IsDone
        FROM Members
        WHERE RoomId = @RoomId
      `);

    return c.json({ success: true, members: membersResult.recordset });
  } catch (error) {
    console.error('Error fetching members done status:', error);
    return c.json({ success: false, message: 'Failed to fetch members done status' }, 500);
  }
});


app.post('/cast-vote', async (c) => {
  const { RoomCode, MemberId, VoteValue } = await c.req.json();
  const pool = await connectToDatabase();

  try {

    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    // Check if the member exists using MemberId and RoomId
    const memberResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .input('MemberId', sql.UniqueIdentifier, MemberId)
      .query(`SELECT MemberId FROM Members WHERE RoomId = @RoomId AND MemberId = @MemberId`);

    if (memberResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Member not found in the room' }, 404);
    }

    // Check if the member has already cast a vote
    const voteResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .input('MemberId', sql.UniqueIdentifier, MemberId)
      .query(`SELECT VoteId FROM Votes WHERE RoomId = @RoomId AND MemberId = @MemberId`);

    if (voteResult.recordset.length > 0) {
      // If a vote already exists, update the existing vote
      const VoteId = voteResult.recordset[0].VoteId;
      await pool.request()
        .input('VoteId', sql.UniqueIdentifier, VoteId)
        .input('VoteValue', sql.Int, VoteValue)
        .query(`UPDATE Votes SET VoteValue = @VoteValue WHERE VoteId = @VoteId`);
    } else {
      // If no vote exists, insert a new vote
      const VoteId = uuidv4();
      await pool.request()
        .input('VoteId', sql.UniqueIdentifier, VoteId)
        .input('RoomId', sql.UniqueIdentifier, RoomId)
        .input('MemberId', sql.UniqueIdentifier, MemberId)
        .input('VoteValue', sql.Int, VoteValue)
        .query(`INSERT INTO Votes (VoteId, RoomId, MemberId, VoteValue) 
                VALUES (@VoteId, @RoomId, @MemberId, @VoteValue)`);
    }

    return c.json({ success: true, message: 'Vote cast successfully' });
  } catch (error) {
    console.error('Error casting vote:', error);
    return c.json({ success: false, message: 'Failed to cast vote' }, 500);
  }
});


app.post('/reveal-votes', async (c) => {
  const { RoomCode } = await c.req.json();
  const pool = await connectToDatabase();

  try {
    // Fetch RoomId based on RoomCode
    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    // Update the Room to set VotingFrozen to true and isRevote to 0
    await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .query(`UPDATE Rooms SET VotingFrozen = 1, IsRevote = 0 WHERE RoomId = @RoomId`);

    // Fetch the votes and corresponding MemberName for the Room
    const votesResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .query(`SELECT Members.MemberName, Votes.VoteValue 
              FROM Votes 
              JOIN Members ON Votes.MemberId = Members.MemberId 
              WHERE Votes.RoomId = @RoomId`);

    return c.json({ success: true, votes: votesResult.recordset });
  } catch (error) {
    console.error('Error revealing votes:', error);
    return c.json({ success: false, message: 'Failed to reveal votes' }, 500);
  }
});

app.get('/voting-status', async (c) => {
  try {
    const { RoomCode } = c.req.query();
    const pool = await connectToDatabase();

    const result = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT VotingStarted FROM Rooms WHERE RoomCode = @RoomCode`);

    if (result.recordset.length > 0) {
      return c.json({ votingStarted: result.recordset[0].VotingStarted });
    } else {
      return c.json({ votingStarted: false, message: 'Room not found' }, 404);
    }
  } catch (error) {
    console.error('Error fetching voting status:', error);
    return c.json({ votingStarted: false, message: 'Server error' }, 500);
  }
});


app.get('/voting-stats', async (c) => {
  const { RoomCode } = c.req.query();
  const pool = await connectToDatabase();

  try {
    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    const statsResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .query(`
        SELECT 
          AVG(VoteValue) AS AverageVote,
          MIN(VoteValue) AS MinVote,
          MAX(VoteValue) AS MaxVote,
          COUNT(*) AS TotalVotes
        FROM Votes
        WHERE RoomId = @RoomId`);

    return c.json({ success: true, stats: statsResult.recordset[0] });
  } catch (error) {
    console.error('Error fetching voting stats:', error);
    return c.json({ success: false, message: 'Failed to fetch voting stats' }, 500);
  }
});

app.get('/room-members', async (c) => {
  const { RoomCode } = c.req.query();
  const pool = await connectToDatabase();

  try {
    // Get the RoomId based on RoomCode
    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    // Get the list of members in the room
    const membersResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .query(`SELECT MemberName FROM Members WHERE RoomId = @RoomId`);

    const members = membersResult.recordset.map(record => record.MemberName);

    return c.json({ success: true, members });
  } catch (error) {
    console.error('Error fetching members:', error);
    return c.json({ success: false, message: 'Failed to fetch members' }, 500);
  }
});


app.get('/revote-status', async (c) => {
  const { RoomCode } = c.req.query();
  const pool = await connectToDatabase();

  try {
    const result = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT IsRevote FROM Rooms WHERE RoomCode = @RoomCode`);

    if (result.recordset.length > 0) {
      return c.json({ success: true, isRevote: result.recordset[0].IsRevote });
    } else {
      return c.json({ success: false, message: 'Room not found' });
    }
  } catch (error) {
    return c.json({ success: false, message: 'Server error' });
  }
});

  app.get('/get-casted-vote', async (c) => {
    const { RoomCode, MemberId } = c.req.query();  // Get RoomCode and MemberId from the query params
    const pool = await connectToDatabase();

    try {
      // Fetch the vote value and done status using MemberId and RoomCode
      const result = await pool.request()
        .input('RoomCode', sql.NVarChar(50), RoomCode)
        .input('MemberId', sql.UniqueIdentifier, MemberId)  // Use MemberId instead of MemberName
        .query(`
          SELECT Votes.VoteValue, Members.IsDone
          FROM Votes 
          JOIN Members ON Votes.MemberId = Members.MemberId
          JOIN Rooms ON Rooms.RoomId = Members.RoomId
          WHERE Rooms.RoomCode = @RoomCode AND Members.MemberId = @MemberId
        `);

      // If no data is found, return a 404 response
      if (result.recordset.length === 0) {
        return c.json({ success: false, message: 'No data found' }, 404);
      }

      // Extract the vote value and done status from the result
      const { VoteValue, IsDone } = result.recordset[0];
      return c.json({ success: true, castedVote: VoteValue, isDone: IsDone });
    } catch (error) {
      console.error('Error fetching vote and done status:', error);
      return c.json({ success: false, message: 'Failed to fetch data' }, 500);
    }
  });




// Backend Revote Endpoint
app.post('/revote', async (c) => {
  const { RoomCode } = await c.req.json();
  const pool = await connectToDatabase();

  try {
    // Fetch the RoomId for the provided RoomCode
    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    // Reset the votes for the room and reset the VotingFrozen and isRevote flags
    await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .query(`DELETE FROM Votes WHERE RoomId = @RoomId`);

    await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .query(`UPDATE Rooms SET VotingStarted = 1, VotingFrozen = 0, IsRevote = 1 WHERE RoomId = @RoomId`);

    await pool.request()
    .input('RoomId', sql.UniqueIdentifier, RoomId)
    .query(`UPDATE Members SET IsDone = 0 WHERE RoomId = @RoomId`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error initiating revote:', error);
    return c.json({ success: false, message: 'Failed to initiate revote' }, 500);
  }
});

// Voting freeze status endpoint
app.get('/voting-freeze-status', async (c) => {
  const { RoomCode } = c.req.query();
  const pool = await connectToDatabase();

  try {
    const result = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT VotingFrozen FROM Rooms WHERE RoomCode = @RoomCode`);

    if (result.recordset.length > 0) {
      // Return the voting frozen status
      return c.json({ success: true, VotingFrozen: result.recordset[0].VotingFrozen });
    } else {
      // If the room is not found
      return c.json({ success: false, message: 'Room not found' }, 404);
    }
  } catch (error) {
    console.error('Error fetching voting freeze status:', error);
    return c.json({ success: false, message: 'Failed to fetch voting freeze status' }, 500);
  }
});

