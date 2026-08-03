const path = require('path');
const dns = require('dns');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log(`[Database] Reusing existing MongoDB connection: ${mongoose.connection.host}`);
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI;

  console.log('[Database] Starting MongoDB connection sequence...');
  console.log(`[Database] Dotenv loaded .env file: ${path.resolve(__dirname, '..', '.env')}`);
  console.log(`[Database] MONGODB_URI present: ${Boolean(mongoUri)}`);
  if (mongoUri) {
    console.log(`[Database] MONGODB_URI value: ${mongoUri.replace(/:([^:@]+)@/, ':***@')}`);
  }

  if (!mongoUri) {
    const error = new Error('MONGODB_URI is not defined in the environment. Set it in the project .env file before starting the server.');
    console.error('[Database] Missing MONGODB_URI:', error.message);
    throw error;
  }

  let parsedUri;
  try {
    parsedUri = new URL(mongoUri);
  } catch (error) {
    const invalidUriError = new Error(`MONGODB_URI is not a valid MongoDB connection string: ${error.message}`);
    console.error('[Database] Invalid URI format:', invalidUriError.message);
    throw invalidUriError;
  }

  console.log(`[Database] Parsed protocol: ${parsedUri.protocol}`);
  console.log(`[Database] Parsed host: ${parsedUri.hostname}`);
  console.log(`[Database] Parsed port: ${parsedUri.port || 'default'}`);
  console.log(`[Database] Parsed pathname: ${parsedUri.pathname}`);

  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    const invalidProtocolError = new Error(`MONGODB_URI must use mongodb:// or mongodb+srv://. Received: ${parsedUri.protocol}`);
    console.error('[Database] Invalid URI protocol:', invalidProtocolError.message);
    throw invalidProtocolError;
  }

  if (parsedUri.protocol === 'mongodb+srv:') {
    console.log('[Database] Atlas SRV connection detected. Resolving SRV target with Node DNS...');
    await new Promise((resolve, reject) => {
      dns.resolveSrv(parsedUri.hostname.replace(/^mongodb\+srv:\/\//, ''), (err, records) => {
        if (err) {
          console.error(`[Database] DNS resolveSrv failed: ${err.message}`);
          reject(err);
          return;
        }

        console.log(`[Database] DNS resolveSrv succeeded with ${records.length} record(s)`);
        records.forEach((record, index) => {
          console.log(`[Database] SRV record ${index + 1}: ${record.name}:${record.port}`);
        });
        resolve();
      });
    });
  }

  const mongooseOptions = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    family: 4,
    tls: true,
    retryWrites: true,
    w: 'majority'
  };

  console.log('[Database] Attempting Mongoose connection with options:', mongooseOptions);

  try {
    const conn = await mongoose.connect(mongoUri, mongooseOptions);
    console.log(`[Database] Mongoose connected to host: ${conn.connection.host}`);
    console.log(`[Database] Database name: ${conn.connection.name}`);

    await conn.connection.db.admin().ping();
    console.log('[Database] MongoDB Connected');
    return conn;
  } catch (error) {
    console.error('[Database] Connection failed.');
    console.error(`[Database] Error message: ${error.message}`);
    console.error(`[Database] Error code: ${error.code || 'unknown'}`);
    console.error('[Database] Full error:', error);
    throw error;
  }
};

mongoose.connection.on('error', (error) => {
  console.error(`[Database] Connection Error: ${error.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected');
});

module.exports = connectDB;
