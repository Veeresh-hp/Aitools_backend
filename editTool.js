const mongoose = require('mongoose');
const Tool = require('./models/Tool');
require('dotenv').config();

async function editTool() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get tool ID from command line argument
    const toolId = process.argv[2];
    
    if (!toolId) {
      console.log('❌ Please provide a tool ID');
      console.log('Usage: node editTool.js <tool-id>');
      console.log('\nTo get tool IDs, run: node viewApprovedTools.js');
      process.exit(1);
    }

    // Find the tool
    const tool = await Tool.findById(toolId);
    
    if (!tool) {
      console.log(`❌ Tool with ID ${toolId} not found`);
      process.exit(1);
    }

    console.log('📝 Current Tool Details:');
    console.log(`Name: ${tool.name}`);
    console.log(`Category: ${tool.category}`);
    console.log(`URL: ${tool.url}`);
    console.log(`Description: ${tool.description}`);
    console.log(`Status: ${tool.status}`);
    console.log(`Snapshot: ${tool.snapshotUrl || 'None'}`);
    console.log('\n');

    // You can modify any field here
    // Example: Update category, name, description, etc.
    
    console.log('✏️  To edit this tool, modify the fields below in the script:');
    console.log('');
    console.log('// Uncomment and modify the fields you want to change:');
    console.log('// tool.name = "New Tool Name";');
    console.log('// tool.category = "chatbots";');
    console.log('// tool.description = "New description";');
    console.log('// tool.url = "https://new-url.com";');
    console.log('// tool.status = "approved"; // or "pending" or "rejected"');
    console.log('');
    console.log('// Then uncomment this line to save:');
    console.log('// await tool.save();');
    console.log('// console.log("✅ Tool updated successfully!");');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

editTool();
