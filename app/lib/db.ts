import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10, 
});

export default sql;