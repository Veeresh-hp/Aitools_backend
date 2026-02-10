const mongoose = require('mongoose');
const Tool = require('./models/Tool');
require('dotenv').config();

async function deleteTool() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const toolId = process.argv[2];
    
    if (!toolId) {
      console.log('❌ Please provide a tool ID');
      console.log('Usage: node deleteTool.js <tool-id>');
      console.log('\nTo get tool IDs, run: node viewApprovedTools.js');
      process.exit(1);
    }

    const tool = await Tool.findById(toolId);
    
    if (!tool) {
      console.log(`❌ Tool with ID ${toolId} not found`);
      process.exit(1);
    }

    console.log('⚠️  You are about to delete:');
    console.log(`   Name: ${tool.name}`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   Status: ${tool.status}`);
    console.log(`   URL: ${tool.url}`);
    console.log('');

    await Tool.deleteOne({ _id: toolId });
    
    console.log('✅ Tool deleted successfully!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteTool();
