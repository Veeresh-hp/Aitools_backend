const mongoose = require('mongoose');
const User = require('./models/User');

// Replace with your actual MongoDB URI or use dotenv
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://aiToolsHub:2PixDgjnWk2wS5mK@cluster0.3606h3j.mongodb.net/ai-tools-hub?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  migrateUsers();
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

async function migrateUsers() {
  try {
    const users = await User.find({ username: { $exists: false } });
    for (const user of users) {
      user.username = user.email.split('@')[0]; // Use email prefix as default username
      await user.save();
      console.log(`Updated user: ${user.email}`);
    }
    console.log('✅ Migration complete');
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    mongoose.disconnect();
  }
}
