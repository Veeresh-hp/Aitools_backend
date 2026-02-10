const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function makeAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // List all users
    const users = await User.find({}, 'username email role');
    
    if (users.length === 0) {
      console.log('\n❌ No users found in database!');
      console.log('Please sign up on the website first: http://localhost:3000/signup');
      process.exit(0);
    }

    console.log('\n📋 Current users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email}) - Role: ${user.role}`);
    });

    // Check if we have a command line argument
    const emailArg = process.argv[2];
    
    if (!emailArg) {
      console.log('\n💡 Usage: node makeAdmin.js <email>');
      console.log('Example: node makeAdmin.js user@example.com');
      process.exit(0);
    }

    // Update the specified user to admin
    const result = await User.updateOne(
      { email: emailArg },
      { $set: { role: 'admin' } }
    );

    if (result.matchedCount === 0) {
      console.log(`\n❌ User with email "${emailArg}" not found!`);
    } else {
      console.log(`\n✅ Successfully made ${emailArg} an admin!`);
      console.log('You can now login and access the admin dashboard at: http://localhost:3000/admin');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeAdmin();
