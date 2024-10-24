import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { connectToDatabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
import { cors } from 'hono/cors';

const app = new Hono();

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

    return c.json({ success: true, message: 'Joined room successfully' });
  } catch (error) {
    console.error('Error joining room:', error);
    return c.json({ success: false, message: 'Failed to join room' }, 500);
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

app.post('/mark-done', async (c) => {
  const { RoomCode, MemberName } = await c.req.json();
  const pool = await connectToDatabase();

  try {
    // Fetch the RoomId and MemberId
    const memberResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .input('MemberName', sql.NVarChar(50), MemberName)
      .query(`
        SELECT Members.MemberId
        FROM Members 
        INNER JOIN Rooms ON Rooms.RoomId = Members.RoomId
        WHERE Rooms.RoomCode = @RoomCode AND Members.MemberName = @MemberName
      `);

    if (memberResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Member not found' }, 404);
    }

    const MemberId = memberResult.recordset[0].MemberId;

    // Update the member's "done" status in the database
    await pool.request()
      .input('MemberId', sql.UniqueIdentifier, MemberId)
      .query(`UPDATE Members SET IsDone = 1 WHERE MemberId = @MemberId`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error marking voting as done:', error);
    return c.json({ success: false, message: 'Failed to mark voting as done' }, 500);
  }
});

// Unmark as Done API
app.post('/unmark-done', async (c) => {
  const { RoomCode, MemberName } = await c.req.json();
  const pool = await connectToDatabase();

  try {
    // Fetch the RoomId and MemberId
    const memberResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .input('MemberName', sql.NVarChar(50), MemberName)
      .query(`
        SELECT Members.MemberId
        FROM Members 
        INNER JOIN Rooms ON Rooms.RoomId = Members.RoomId
        WHERE Rooms.RoomCode = @RoomCode AND Members.MemberName = @MemberName
      `);

    if (memberResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Member not found' }, 404);
    }

    const MemberId = memberResult.recordset[0].MemberId;

    // Update the member's "done" status in the database (set IsDone to 0)
    await pool.request()
      .input('MemberId', sql.UniqueIdentifier, MemberId)
      .query(`UPDATE Members SET IsDone = 0 WHERE MemberId = @MemberId`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error unmarking as done:', error);
    return c.json({ success: false, message: 'Failed to unmark as done' }, 500);
  }
});

app.get('/members-done-status', async (c) => {
  const { RoomCode } = c.req.query();
  const pool = await connectToDatabase();

  try {
    // Fetch all members and their done status
    const membersResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`
        SELECT Members.MemberName, Members.IsDone
        FROM Members
        INNER JOIN Rooms ON Rooms.RoomId = Members.RoomId
        WHERE Rooms.RoomCode = @RoomCode
      `);

    return c.json({ success: true, members: membersResult.recordset });
  } catch (error) {
    console.error('Error fetching members done status:', error);
    return c.json({ success: false, message: 'Failed to fetch members done status' }, 500);
  }
});

app.post('/cast-vote', async (c) => {
  const { RoomCode, MemberName, VoteValue } = await c.req.json();
  const pool = await connectToDatabase();

  try {

    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    const memberResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .input('MemberName', sql.NVarChar(100), MemberName)
      .query(`SELECT MemberId FROM Members WHERE RoomId = @RoomId AND MemberName = @MemberName`);

    if (memberResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Member not found in the room' }, 404);
    }

    const MemberId = memberResult.recordset[0].MemberId;

    // Log vote check result
    const voteResult = await pool.request()
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .input('MemberId', sql.UniqueIdentifier, MemberId)
      .query(`SELECT VoteId FROM Votes WHERE RoomId = @RoomId AND MemberId = @MemberId`);
    

    if (voteResult.recordset.length > 0) {
      const VoteId = voteResult.recordset[0].VoteId;
      await pool.request()
        .input('VoteId', sql.UniqueIdentifier, VoteId)
        .input('VoteValue', sql.Int, VoteValue)
        .query(`UPDATE Votes SET VoteValue = @VoteValue WHERE VoteId = @VoteId`);
    } else {
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

    // Fetch the votes after revealing them
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
  const { RoomCode, MemberName } = c.req.query();
  const pool = await connectToDatabase();

  try {
    const result = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .input('MemberName', sql.NVarChar(100), MemberName)
      .query(`SELECT VoteValue FROM Votes 
              JOIN Members ON Votes.MemberId = Members.MemberId
              WHERE Votes.RoomId = (SELECT Rooms.RoomId FROM Rooms WHERE RoomCode = @RoomCode)
              AND Members.MemberName = @MemberName`);

    if (result.recordset.length > 0) {
      return c.json({ success: true, castedVote: result.recordset[0].VoteValue });
    } else {
      return c.json({ success: true, castedVote: null });
    }
  } catch (error) {
    console.error('Error fetching casted vote:', error);
    return c.json({ success: false, message: 'Failed to fetch casted vote' });
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

serve(app);
