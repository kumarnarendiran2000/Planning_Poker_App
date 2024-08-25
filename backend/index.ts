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
    const roomResult = await pool.request()
      .input('RoomCode', sql.NVarChar(50), RoomCode)
      .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);

    if (roomResult.recordset.length === 0) {
      return c.json({ success: false, message: 'Room not found' }, 404);
    }

    const RoomId = roomResult.recordset[0].RoomId;

    // Need to add more logic here to handle session management

    return c.json({ success: true, message: 'Voting session started' });
  } catch (error) {
    console.error('Error starting voting session:', error);
    return c.json({ success: false, message: 'Failed to start voting session' }, 500);
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
    const VoteId = uuidv4();

    await pool.request()
      .input('VoteId', sql.UniqueIdentifier, VoteId)
      .input('RoomId', sql.UniqueIdentifier, RoomId)
      .input('MemberId', sql.UniqueIdentifier, MemberId)
      .input('VoteValue', sql.Int, VoteValue)
      .query(`INSERT INTO Votes (VoteId, RoomId, MemberId, VoteValue) 
              VALUES (@VoteId, @RoomId, @MemberId, @VoteValue)`);

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


serve(app);
