const mongoose = require('mongoose');
const Tool = require('./models/Tool');
require('dotenv').config();

async function quickEditTool() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const toolId = process.argv[2];
    const field = process.argv[3];
    const newValue = process.argv[4];
    
    if (!toolId || !field || !newValue) {
      console.log('❌ Missing arguments');
      console.log('Usage: node quickEditTool.js <tool-id> <field> <new-value>');
      console.log('\nExamples:');
      console.log('  node quickEditTool.js 69023d20742550b7e724ed2c category "chatbots"');
      console.log('  node quickEditTool.js 69023d20742550b7e724ed2c name "New Tool Name"');
      console.log('  node quickEditTool.js 69023d20742550b7e724ed2c url "https://new-url.com"');
      console.log('  node quickEditTool.js 69023d20742550b7e724ed2c status "pending"');
      console.log('\nAvailable fields: name, category, url, description, status');
      console.log('Available categories: chatbots, voice-tools, image-generators, video-generators, etc.');
      console.log('\nTo get tool IDs, run: node viewApprovedTools.js');
      process.exit(1);
    }

    const tool = await Tool.findById(toolId);
    
    if (!tool) {
      console.log(`❌ Tool with ID ${toolId} not found`);
      process.exit(1);
    }

    const validFields = ['name', 'category', 'url', 'description', 'status'];
    if (!validFields.includes(field)) {
      console.log(`❌ Invalid field: ${field}`);
      console.log(`Valid fields: ${validFields.join(', ')}`);
      process.exit(1);
    }

    console.log(`📝 Updating ${tool.name}...`);
    console.log(`   Old ${field}: ${tool[field]}`);
    console.log(`   New ${field}: ${newValue}`);
    
    tool[field] = newValue;
    await tool.save();
    
    console.log('✅ Tool updated successfully!\n');
    console.log('Updated tool:');
    console.log(`   Name: ${tool.name}`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   URL: ${tool.url}`);
    console.log(`   Status: ${tool.status}`);
    console.log(`   Description: ${tool.description.substring(0, 100)}...`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

quickEditTool();
