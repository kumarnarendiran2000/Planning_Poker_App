"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = void 0;
const mssql_1 = __importDefault(require("mssql"));
const config = {
    user: 'sa',
    password: 'muppet',
    server: 'localhost',
    database: 'PlanningPoker',
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};
const connectToDatabase = async () => {
    try {
        const pool = await mssql_1.default.connect(config);
        return pool;
    }
    catch (err) {
        console.error('Database connection failed:', err);
        throw err;
    }
};
exports.connectToDatabase = connectToDatabase;
