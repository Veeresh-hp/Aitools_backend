const mongoose = require('mongoose');
const Tool = require('./models/Tool');
const User = require('./models/User');
require('dotenv').config();

async function viewApprovedTools() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const tools = await Tool.find({ status: 'approved' })
      .populate('submittedBy', 'username email')
      .sort({ updatedAt: -1 });

    console.log(`📋 Found ${tools.length} approved tools:\n`);

    tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   ID: ${tool._id}`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   URL: ${tool.url}`);
      console.log(`   Snapshot: ${tool.snapshotUrl || 'None'}`);
      console.log(`   Submitted by: ${tool.submittedBy ? `${tool.submittedBy.username} (${tool.submittedBy.email})` : 'Anonymous'}`);
      console.log(`   Approved on: ${tool.updatedAt}`);
      console.log(`   Description: ${tool.description.substring(0, 100)}...`);
      console.log('');
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

viewApprovedTools();