--CREATE DATABASE PlanningPoker;
--GO

USE PlanningPoker;
GO

CREATE TABLE Rooms (
    RoomId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),  -- Use GUID for RoomId
    ScrumMasterId UNIQUEIDENTIFIER NOT NULL,             -- Foreign Key for Scrum Master (linked to Members)
    RoomCode NVARCHAR(50) NOT NULL UNIQUE,               -- Unique Room Code for the session
    CreatedAt DATETIME DEFAULT GETDATE(),                -- Timestamp for room creation
    VotingStarted BIT DEFAULT 0,                         -- Flag indicating if voting has started
    IsRevote BIT DEFAULT 0,                              -- Flag indicating if a revote has been initiated
    VotingFrozen BIT DEFAULT 0                           -- Flag indicating if votes are revealed (frozen)
);


CREATE TABLE Members (
    MemberId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),  -- Use GUID for MemberId
    RoomId UNIQUEIDENTIFIER NOT NULL,                      -- Foreign Key to Rooms table
    MemberName NVARCHAR(100) NOT NULL,                     -- Name of the member
    FOREIGN KEY (RoomId) REFERENCES Rooms(RoomId) ON DELETE CASCADE  -- Cascade delete when the room is deleted
);


CREATE TABLE Votes (
    VoteId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),  -- Use GUID for VoteId
    RoomId UNIQUEIDENTIFIER NOT NULL,                     -- Foreign Key to Rooms table
    MemberId UNIQUEIDENTIFIER NOT NULL,                   -- Foreign Key to Members table
    VoteValue NVARCHAR(50) NOT NULL,                      -- The value of the vote (number or string)
    VotedAt DATETIME DEFAULT GETDATE(),                   -- Timestamp when the vote was cast
    FOREIGN KEY (RoomId) REFERENCES Rooms(RoomId) ON DELETE CASCADE,  -- Cascade delete when the room is deleted
    FOREIGN KEY (MemberId) REFERENCES Members(MemberId) ON DELETE CASCADE  -- Cascade delete when the member is deleted
);


