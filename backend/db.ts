import sql from 'mssql';

const config = {
  user: 'sa',
  password: 'muppetmuppet',
  server: 'localhost', 
  database: 'PlanningPoker',
  options: {
    encrypt: true,               
    trustServerCertificate: true,
  },
};

export const connectToDatabase = async () => {
  try {
    const pool = await sql.connect(config);
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
};
