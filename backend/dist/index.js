"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const node_server_1 = require("@hono/node-server");
const db_1 = require("./db");
const uuid_1 = require("uuid");
const mssql_1 = __importDefault(require("mssql"));
const cors_1 = require("hono/cors");
const app = new hono_1.Hono();
// Enable CORS for all routes
app.use('*', (0, cors_1.cors)());
app.get('/', async (c) => {
    const pool = await (0, db_1.connectToDatabase)();
    return c.text('Planning Poker Backend');
});
app.post('/create-room', async (c) => {
    const pool = await (0, db_1.connectToDatabase)();
    const RoomId = (0, uuid_1.v4)();
    const ScrumMasterId = (0, uuid_1.v4)();
    const RoomCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    try {
        const result = await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .input('ScrumMasterId', mssql_1.default.UniqueIdentifier, ScrumMasterId)
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`INSERT INTO Rooms (RoomId, ScrumMasterId, RoomCode) 
              VALUES (@RoomId, @ScrumMasterId, @RoomCode)`);
        return c.json({ success: true, RoomCode });
    }
    catch (error) {
        console.error('Error creating room:', error);
        return c.json({ success: false, message: 'Failed to create room' }, 500);
    }
});
app.post('/join-room', async (c) => {
    const { RoomCode, MemberName } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        const roomResult = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
        if (roomResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Room not found' }, 404);
        }
        const RoomId = roomResult.recordset[0].RoomId;
        const MemberId = (0, uuid_1.v4)();
        await pool.request()
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .input('MemberName', mssql_1.default.NVarChar(100), MemberName)
            .query(`INSERT INTO Members (MemberId, RoomId, MemberName) 
                VALUES (@MemberId, @RoomId, @MemberName)`);
        return c.json({ success: true, message: 'Joined room successfully', memberId: MemberId });
    }
    catch (error) {
        console.error('Error joining room:', error);
        return c.json({ success: false, message: 'Failed to join room' }, 500);
    }
});
app.post('/end-session', async (c) => {
    const { roomCode } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        // Update the room's status to inactive
        await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
            .query(`UPDATE Rooms SET IsActive = 0 WHERE RoomCode = @RoomCode`);
        return c.json({ success: true, message: 'Session ended successfully' });
    }
    catch (error) {
        console.error('Error ending session:', error);
        return c.json({ success: false, message: 'Failed to end session' }, 500);
    }
});
app.get('/check-room-status', async (c) => {
    const { roomCode } = c.req.query();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        const result = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
            .query(`SELECT IsActive FROM Rooms WHERE RoomCode = @RoomCode`);
        if (result.recordset.length === 0) {
            return c.json({ success: false, message: 'Room not found' }, 404);
        }
        const isActive = result.recordset[0].IsActive;
        return c.json({ success: true, isActive });
    }
    catch (error) {
        console.error('Error checking room status:', error);
        return c.json({ success: false, message: 'Failed to check room status' }, 500);
    }
});
app.post('/start-voting', async (c) => {
    const { RoomCode } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        const result = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`UPDATE Rooms SET VotingStarted = 1 WHERE RoomCode = @RoomCode`);
        if (result.rowsAffected[0] > 0) {
            return c.json({ success: true, message: 'Voting session started' });
        }
        else {
            return c.json({ success: false, message: 'Room not found' });
        }
    }
    catch (error) {
        console.error('Error starting voting session:', error);
        return c.json({ success: false, message: 'Failed to start voting session' }, 500);
    }
});
app.post('/update-member-name', async (c) => {
    const { MemberId, MemberName } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        // Update the member's name in the Members table
        await pool.request()
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
            .input('MemberName', mssql_1.default.NVarChar(100), MemberName)
            .query(`UPDATE Members SET MemberName = @MemberName WHERE MemberId = @MemberId`);
        return c.json({ success: true, message: 'Member name updated successfully' });
    }
    catch (error) {
        console.error('Error updating member name:', error);
        return c.json({ success: false, message: 'Failed to update member name' }, 500);
    }
});
app.post('/mark-done', async (c) => {
    const { RoomCode, MemberId } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        // Fetch the RoomId using the RoomCode
        const roomResult = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
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
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
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
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
            .query(`UPDATE Members SET IsDone = 1 WHERE MemberId = @MemberId`);
        return c.json({ success: true, message: 'Marked as done successfully' });
    }
    catch (error) {
        console.error('Error marking voting as done:', error);
        return c.json({ success: false, message: 'Failed to mark voting as done' }, 500);
    }
});
// Unmark as Done API
app.post('/unmark-done', async (c) => {
    const { RoomCode, MemberId } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        // Fetch the RoomId
        const roomResult = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
        if (roomResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Room not found' }, 404);
        }
        const RoomId = roomResult.recordset[0].RoomId;
        // Check if the member exists with the given RoomId and MemberId
        const memberResult = await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
            .query(`SELECT MemberId FROM Members WHERE RoomId = @RoomId AND MemberId = @MemberId`);
        if (memberResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Member not found' }, 404);
        }
        // Update the member's "done" status in the database (set IsDone to 0)
        await pool.request()
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
            .query(`UPDATE Members SET IsDone = 0 WHERE MemberId = @MemberId`);
        return c.json({ success: true, message: 'Unmarked as done successfully' });
    }
    catch (error) {
        console.error('Error unmarking as done:', error);
        return c.json({ success: false, message: 'Failed to unmark as done' }, 500);
    }
});
app.post('/cast-vote', async (c) => {
    const { RoomCode, MemberId, VoteValue } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        const roomResult = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
        if (roomResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Room not found' }, 404);
        }
        const RoomId = roomResult.recordset[0].RoomId;
        // Check if the member exists using MemberId and RoomId
        const memberResult = await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
            .query(`SELECT MemberId FROM Members WHERE RoomId = @RoomId AND MemberId = @MemberId`);
        if (memberResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Member not found in the room' }, 404);
        }
        // Check if the member has already cast a vote
        const voteResult = await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
            .query(`SELECT VoteId FROM Votes WHERE RoomId = @RoomId AND MemberId = @MemberId`);
        if (voteResult.recordset.length > 0) {
            // If a vote already exists, update the existing vote
            const VoteId = voteResult.recordset[0].VoteId;
            await pool.request()
                .input('VoteId', mssql_1.default.UniqueIdentifier, VoteId)
                .input('VoteValue', mssql_1.default.Int, VoteValue)
                .query(`UPDATE Votes SET VoteValue = @VoteValue WHERE VoteId = @VoteId`);
        }
        else {
            // If no vote exists, insert a new vote
            const VoteId = (0, uuid_1.v4)();
            await pool.request()
                .input('VoteId', mssql_1.default.UniqueIdentifier, VoteId)
                .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
                .input('MemberId', mssql_1.default.UniqueIdentifier, MemberId)
                .input('VoteValue', mssql_1.default.Int, VoteValue)
                .query(`INSERT INTO Votes (VoteId, RoomId, MemberId, VoteValue) 
                VALUES (@VoteId, @RoomId, @MemberId, @VoteValue)`);
        }
        return c.json({ success: true, message: 'Vote cast successfully' });
    }
    catch (error) {
        console.error('Error casting vote:', error);
        return c.json({ success: false, message: 'Failed to cast vote' }, 500);
    }
});
app.post('/reveal-votes', async (c) => {
    const { RoomCode } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        // Fetch RoomId based on RoomCode
        const roomResult = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
        if (roomResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Room not found' }, 404);
        }
        const RoomId = roomResult.recordset[0].RoomId;
        // Update the Room to set VotingFrozen to true and isRevote to 0
        await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .query(`UPDATE Rooms SET VotingFrozen = 1, IsRevote = 0 WHERE RoomId = @RoomId`);
        // Fetch the votes and corresponding MemberName for the Room
        const votesResult = await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .query(`SELECT Members.MemberName, Votes.VoteValue 
              FROM Votes 
              JOIN Members ON Votes.MemberId = Members.MemberId 
              WHERE Votes.RoomId = @RoomId`);
        return c.json({ success: true, votes: votesResult.recordset });
    }
    catch (error) {
        console.error('Error revealing votes:', error);
        return c.json({ success: false, message: 'Failed to reveal votes' }, 500);
    }
});
app.get('/voting-stats', async (c) => {
    const { RoomCode } = c.req.query();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        const roomResult = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
        if (roomResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Room not found' }, 404);
        }
        const RoomId = roomResult.recordset[0].RoomId;
        const statsResult = await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .query(`
        SELECT 
          AVG(VoteValue) AS AverageVote,
          MIN(VoteValue) AS MinVote,
          MAX(VoteValue) AS MaxVote,
          COUNT(*) AS TotalVotes
        FROM Votes
        WHERE RoomId = @RoomId`);
        return c.json({ success: true, stats: statsResult.recordset[0] });
    }
    catch (error) {
        console.error('Error fetching voting stats:', error);
        return c.json({ success: false, message: 'Failed to fetch voting stats' }, 500);
    }
});
// Backend Revote Endpoint
app.post('/revote', async (c) => {
    const { RoomCode } = await c.req.json();
    const pool = await (0, db_1.connectToDatabase)();
    try {
        // Fetch the RoomId for the provided RoomCode
        const roomResult = await pool.request()
            .input('RoomCode', mssql_1.default.NVarChar(50), RoomCode)
            .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
        if (roomResult.recordset.length === 0) {
            return c.json({ success: false, message: 'Room not found' }, 404);
        }
        const RoomId = roomResult.recordset[0].RoomId;
        // Reset the votes for the room and reset the VotingFrozen and isRevote flags
        await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .query(`DELETE FROM Votes WHERE RoomId = @RoomId`);
        await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .query(`UPDATE Rooms SET VotingStarted = 1, VotingFrozen = 0, IsRevote = 1 WHERE RoomId = @RoomId`);
        await pool.request()
            .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
            .query(`UPDATE Members SET IsDone = 0 WHERE RoomId = @RoomId`);
        return c.json({ success: true });
    }
    catch (error) {
        console.error('Error initiating revote:', error);
        return c.json({ success: false, message: 'Failed to initiate revote' }, 500);
    }
});
//SSE endpoints from here
app.get('/sse/room-members', (c) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    let isStreamOpen = true;
    const roomCode = c.req.query('RoomCode'); // Retrieve RoomCode from query params
    if (!roomCode) {
        return new Response('RoomCode is required', { status: 400 });
    }
    const stream = new ReadableStream({
        start(controller) {
            //controller.enqueue('data: Stream started to send members joined\n\n');
            console.log('Stream started to send membrs joined');
        },
        async pull(controller) {
            if (!isStreamOpen)
                return;
            const pool = await (0, db_1.connectToDatabase)();
            try {
                // Retrieve RoomId using RoomCode
                const roomResult = await pool.request()
                    .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
                    .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
                if (roomResult.recordset.length === 0) {
                    controller.enqueue(`data: ${JSON.stringify({ error: 'Room not found' })}\n\n`);
                    controller.close(); // Close stream if room is not found
                    return;
                }
                const roomId = roomResult.recordset[0].RoomId;
                // Fetch updated member list
                const membersResult = await pool.request()
                    .input('RoomId', mssql_1.default.UniqueIdentifier, roomId)
                    .query(`SELECT MemberName FROM Members WHERE RoomId = @RoomId`);
                const members = membersResult.recordset.map(record => record.MemberName);
                // Send updated member list to client
                controller.enqueue(`data: ${JSON.stringify(members)}\n\n`);
            }
            catch (error) {
                console.error('Error fetching members:', error);
                controller.enqueue(`data: ${JSON.stringify({ error: 'Failed to fetch members' })}\n\n`);
            }
            // Wait for 2000ms (2 seconds) before next pull
            await new Promise((resolve) => setTimeout(resolve, 2000));
        },
        cancel() {
            isStreamOpen = false;
            console.log('Stream cancelled to send members joined');
        },
    });
    return new Response(stream, { headers });
});
app.get('/sse/voting-status', (c) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    const roomCode = c.req.query('RoomCode');
    if (!roomCode) {
        return new Response('RoomCode is required', { status: 400 });
    }
    let isStreamOpen = true;
    const stream = new ReadableStream({
        async start(controller) {
            console.log('Stream started to send voting status');
            //controller.enqueue(`data: stream started to send voting status\n\n`);
        },
        async pull(controller) {
            if (!isStreamOpen)
                return;
            const pool = await (0, db_1.connectToDatabase)();
            const result = await pool.request()
                .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
                .query(`SELECT VotingStarted FROM Rooms WHERE RoomCode = @RoomCode`);
            if (result.recordset.length === 0) {
                controller.enqueue(`data: ${JSON.stringify({ error: 'Room not found' })}\n\n`);
                return;
            }
            const votingStarted = result.recordset[0].VotingStarted;
            controller.enqueue(`data: ${JSON.stringify({ votingStarted })}\n\n`);
            // Wait for a short interval before checking again
            return new Promise(resolve => setTimeout(resolve, 2000));
        },
        cancel() {
            isStreamOpen = false;
            console.log('SSE stream for voting status has been closed');
        },
    });
    return new Response(stream, { headers });
});
app.get('/sse/room-status', (c) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    const roomCode = c.req.query('roomCode');
    if (!roomCode) {
        return new Response('RoomCode is required', { status: 400 });
    }
    let isStreamOpen = true;
    const stream = new ReadableStream({
        async start(controller) {
            console.log('Stream started to send room status');
            //controller.enqueue('data: stream started to send room status\n\n');
        },
        async pull(controller) {
            if (!isStreamOpen)
                return;
            try {
                const pool = await (0, db_1.connectToDatabase)();
                const result = await pool.request()
                    .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
                    .query(`SELECT IsActive FROM Rooms WHERE RoomCode = @RoomCode`);
                if (result.recordset.length === 0) {
                    controller.enqueue(`data: ${JSON.stringify({ error: 'Room not found' })}\n\n`);
                    isStreamOpen = false;
                    controller.close();
                    return;
                }
                const isActive = result.recordset[0].IsActive;
                controller.enqueue(`data: ${JSON.stringify({ isActive })}\n\n`);
                // Wait for a short interval before the next check
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            catch (error) {
                console.error('Error checking room status:', error);
                controller.enqueue(`data: ${JSON.stringify({ error: 'Failed to check room status' })}\n\n`);
                isStreamOpen = false;
                controller.close();
            }
        },
        cancel() {
            isStreamOpen = false;
            console.log('SSE stream for room status has been closed');
        },
    });
    return new Response(stream, { headers });
});
app.get('/sse/casted-vote-done-status', (c) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    const roomCode = c.req.query('RoomCode');
    const memberId = c.req.query('MemberId');
    if (!roomCode || !memberId) {
        return new Response('RoomCode and MemberId are required', { status: 400 });
    }
    let isStreamOpen = true;
    const stream = new ReadableStream({
        async start(controller) {
            console.log('Stream started to send casted vote and done status');
            //controller.enqueue('data: stream started to send casted vote and done status\n\n');
        },
        async pull(controller) {
            if (!isStreamOpen)
                return;
            try {
                const pool = await (0, db_1.connectToDatabase)();
                const result = await pool.request()
                    .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
                    .input('MemberId', mssql_1.default.UniqueIdentifier, memberId)
                    .query(`
            SELECT Votes.VoteValue, Members.IsDone
            FROM Votes 
            JOIN Members ON Votes.MemberId = Members.MemberId
            JOIN Rooms ON Rooms.RoomId = Members.RoomId
            WHERE Rooms.RoomCode = @RoomCode AND Members.MemberId = @MemberId
          `);
                if (result.recordset.length === 0) {
                    controller.enqueue(`data: ${JSON.stringify({ error: 'Currently no votes available' })}\n\n`);
                    isStreamOpen = false;
                    controller.close();
                    return;
                }
                const { VoteValue, IsDone } = result.recordset[0];
                const updateData = { castedVote: VoteValue, isDone: IsDone };
                controller.enqueue(`data: ${JSON.stringify(updateData)}\n\n`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            catch (error) {
                console.error('Error fetching vote and done status:', error);
                controller.enqueue(`data: ${JSON.stringify({ error: 'Failed to fetch data' })}\n\n`);
                isStreamOpen = false;
                controller.close();
            }
        },
        cancel() {
            isStreamOpen = false;
            console.log('SSE stream for casted vote and done status has been closed');
        },
    });
    return new Response(stream, { headers });
});
app.get('/sse/voting-freeze-status', (c) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    const roomCode = c.req.query('RoomCode');
    if (!roomCode) {
        return new Response('RoomCode is required', { status: 400 });
    }
    let isStreamOpen = true;
    const stream = new ReadableStream({
        async start(controller) {
            console.log('Stream started to send voting freeze status');
            //controller.enqueue('data: stream started to send votong freeze status\n\n');
        },
        async pull(controller) {
            if (!isStreamOpen)
                return;
            try {
                const pool = await (0, db_1.connectToDatabase)();
                const result = await pool.request()
                    .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
                    .query(`SELECT VotingFrozen FROM Rooms WHERE RoomCode = @RoomCode`);
                if (result.recordset.length === 0) {
                    controller.enqueue(`data: ${JSON.stringify({ error: 'Room not found' })}\n\n`);
                    isStreamOpen = false;
                    controller.close();
                    return;
                }
                const votingFrozen = result.recordset[0].VotingFrozen;
                controller.enqueue(`data: ${JSON.stringify({ VotingFrozen: votingFrozen })}\n\n`);
                // Check for updates every 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            catch (error) {
                console.error('Error fetching voting freeze status:', error);
                controller.enqueue(`data: ${JSON.stringify({ error: 'Failed to fetch voting freeze status' })}\n\n`);
                isStreamOpen = false;
                controller.close();
            }
        },
        cancel() {
            isStreamOpen = false;
            console.log('SSE stream for voting freeze status has been closed');
        },
    });
    return new Response(stream, { headers });
});
app.get('/sse/members-done-status', (c) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    const roomCode = c.req.query('RoomCode');
    if (!roomCode) {
        return new Response('RoomCode is required', { status: 400 });
    }
    let isStreamOpen = true;
    const stream = new ReadableStream({
        async start(controller) {
            console.log('Stream started to send membrs dpne status');
            //controller.enqueue('data: stream started to send members done status\n\n');
        },
        async pull(controller) {
            if (!isStreamOpen)
                return;
            try {
                const pool = await (0, db_1.connectToDatabase)();
                // Get RoomId using RoomCode
                const roomResult = await pool.request()
                    .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
                    .query(`SELECT RoomId FROM Rooms WHERE RoomCode = @RoomCode`);
                if (roomResult.recordset.length === 0) {
                    controller.enqueue(`data: ${JSON.stringify({ error: 'Room not found' })}\n\n`);
                    isStreamOpen = false;
                    controller.close();
                    return;
                }
                const RoomId = roomResult.recordset[0].RoomId;
                // Fetch all members and their done status for the RoomId
                const membersResult = await pool.request()
                    .input('RoomId', mssql_1.default.UniqueIdentifier, RoomId)
                    .query(`
            SELECT Members.MemberId, Members.MemberName, Members.IsDone
            FROM Members
            WHERE RoomId = @RoomId
          `);
                const members = membersResult.recordset.map(record => ({
                    name: record.MemberName,
                    isDone: record.IsDone,
                }));
                // Send the updated members' done status to the client
                controller.enqueue(`data: ${JSON.stringify(members)}\n\n`);
                // Wait before checking for updates again
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            catch (error) {
                console.error('Error fetching members done status:', error);
                controller.enqueue(`data: ${JSON.stringify({ error: 'Failed to fetch members done status' })}\n\n`);
                isStreamOpen = false;
                controller.close();
            }
        },
        cancel() {
            isStreamOpen = false;
            console.log('SSE stream for members done status has been closed');
        },
    });
    return new Response(stream, { headers });
});
// SSE endpoint for revote status
app.get('/sse/revote-status', (c) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    const roomCode = c.req.query('RoomCode'); // Retrieve RoomCode from query params
    if (!roomCode) {
        return new Response('RoomCode is required', { status: 400 });
    }
    let isStreamOpen = true;
    const stream = new ReadableStream({
        async start(controller) {
            console.log('Stream started to send revote status');
            //controller.enqueue('data: stream started to send revote status\n\n'); // Initial message
        },
        async pull(controller) {
            if (!isStreamOpen)
                return;
            try {
                const pool = await (0, db_1.connectToDatabase)();
                const result = await pool.request()
                    .input('RoomCode', mssql_1.default.NVarChar(50), roomCode)
                    .query(`SELECT IsRevote FROM Rooms WHERE RoomCode = @RoomCode`);
                if (result.recordset.length === 0) {
                    controller.enqueue(`data: ${JSON.stringify({ error: 'Room not found' })}\n\n`);
                    isStreamOpen = false;
                    controller.close();
                    return;
                }
                const isRevote = result.recordset[0].IsRevote;
                controller.enqueue(`data: ${JSON.stringify({ isRevote })}\n\n`);
                // Wait for a short interval before the next check
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            catch (error) {
                console.error('Error fetching revote status:', error);
                controller.enqueue(`data: ${JSON.stringify({ error: 'Failed to fetch revote status' })}\n\n`);
                isStreamOpen = false;
                controller.close();
            }
        },
        cancel() {
            isStreamOpen = false;
            console.log('SSE stream for revote status has been closed');
        },
    });
    return new Response(stream, { headers });
});
(0, node_server_1.serve)(app);
