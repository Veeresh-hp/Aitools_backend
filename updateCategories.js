const mongoose = require('mongoose');
const Tool = require('./models/Tool');
require('dotenv').config();

async function updateToolCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all approved tools without a category
    const tools = await Tool.find({ 
      status: 'approved',
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: '' }
      ]
    });

    console.log(`\n📋 Found ${tools.length} approved tools without category:`);
    
    if (tools.length === 0) {
      console.log('✅ All tools have categories!');
      process.exit(0);
    }

    // Update each tool based on its name/description
    for (const tool of tools) {
      console.log(`\n🔧 Tool: ${tool.name}`);
      console.log(`   Description: ${tool.description.substring(0, 100)}...`);
      
      // Auto-categorize based on tool name/description
      let category = 'utility-tools'; // default
      
      const name = tool.name.toLowerCase();
      const desc = tool.description.toLowerCase();
      
      if (name.includes('tts') || name.includes('voice') || name.includes('speech') || 
          desc.includes('text-to-speech') || desc.includes('voice') || desc.includes('audio')) {
        category = 'voice-tools';
      } else if (name.includes('reader') || desc.includes('read')) {
        category = 'voice-tools';
      } else if (name.includes('chat') || desc.includes('chatbot')) {
        category = 'chatbots';
      } else if (desc.includes('image') || desc.includes('photo')) {
        category = 'image-generators';
      } else if (desc.includes('video')) {
        category = 'video-generators';
      } else if (desc.includes('music') || desc.includes('audio')) {
        category = 'music-generators';
      } else if (desc.includes('writ')) {
        category = 'writing-tools';
      }
      
      tool.category = category;
      await tool.save();
      console.log(`   ✅ Updated to category: ${category}`);
    }

    console.log('\n✅ All tools updated successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateToolCategories();