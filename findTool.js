const mongoose = require('mongoose');
const Tool = require('./models/Tool');
require('dotenv').config();

async function findTool() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Get search term from command line arguments
    // Example: node findTool.js "Video Generator"
    const searchTerm = process.argv[2];

    if (!searchTerm) {
      console.log('❌ Please provide a name to search for.');
      console.log('Usage: node findTool.js "Tool Name"');
      process.exit(1);
    }

    console.log(`🔎 Searching for tools matching: "${searchTerm}"...\n`);

    // Search for tools with name containing the search term (case insensitive)
    const tools = await Tool.find({ name: { $regex: searchTerm, $options: 'i' } });

    if (tools.length === 0) {
      console.log('❌ No tools found.');
    } else {
      console.log(`✅ Found ${tools.length} tool(s):\n`);
      tools.forEach(tool => {
        console.log(`Name:   ${tool.name}`);
        console.log(`ID:     ${tool._id}`); // This is what they need
        console.log(`Status: ${tool.status}`);
        console.log(`URL:    ${tool.url}`);
        console.log('--------------------------------------------------');
      });
      console.log('\n👉 To delete a tool, copy the ID and run: node deleteTool.js <ID>');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findTool();
