import mongoose from 'mongoose';
import { readIndexBuildMode } from '../services/indexBuild';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mahallu';
    
    // Set strictPopulate to false globally to allow virtual populate
    mongoose.set('strictPopulate', false);
    
    // Fail within 15s when the cluster is unreachable (the driver default is 30s), so a bad
    // deployment is reported quickly instead of looking like a hang.
    // Gated index build (services/indexBuild.ts): autoIndex is OFF so that opening the connection builds no
    // index. The server builds them explicitly afterwards, only the unique ones the duplicate preflight
    // cleared. development/test keep Mongoose's automatic build.
    const gated = readIndexBuildMode(process.env) === 'gated';
    if (gated) mongoose.set('autoIndex', false);
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 15000, ...(gated ? { autoIndex: false } : {}) });
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

