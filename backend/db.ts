import sql from 'mssql';

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

export const connectToDatabase = async () => {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to SQL Server');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
};
