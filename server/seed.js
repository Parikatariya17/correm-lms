import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './src/models/User.js';

dotenv.config();

const SEED_USERS = [
  {
    name: 'Vikram Mehta (Admin)',
    email: 'admin@lms.in',
    password: 'Password@123',
    role: 'admin',
  },
  {
    name: 'Priya Sharma (Loan Officer)',
    email: 'officer@lms.in',
    password: 'Password@123',
    role: 'officer',
  },
  {
    name: 'Rohan Verma (Applicant)',
    email: 'applicant@lms.in',
    password: 'Password@123',
    role: 'applicant',
  },
];

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_db';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for seeding...');

    for (const userData of SEED_USERS) {
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`Skipped (already exists): ${userData.email} [${userData.role}]`);
      } else {
        await User.create(userData);
        console.log(`Created: ${userData.email} [${userData.role}]`);
      }
    }

    console.log('\n--- Seed Credentials ---');
    console.table(
      SEED_USERS.map(({ name, email, password, role }) => ({
        Role: role,
        Name: name,
        Email: email,
        Password: password,
      }))
    );

    await mongoose.disconnect();
    console.log('Database seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error.message);
    process.exit(1);
  }
};

seedDatabase();
