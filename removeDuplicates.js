const mongoose = require('mongoose');
const Tool = require('./models/Tool');
require('dotenv').config();

async function removeDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all approved tools
    const tools = await Tool.find({ status: 'approved' }).sort({ createdAt: 1 });
    console.log(`\n📋 Found ${tools.length} approved tools`);

    const seen = new Map();
    const toDelete = [];

    for (const tool of tools) {
      const key = `${tool.name.toLowerCase()}-${tool.category}`;
      
      if (seen.has(key)) {
        // This is a duplicate - mark for deletion
        toDelete.push(tool);
        console.log(`❌ Duplicate found: ${tool.name} (${tool.category}) - Created: ${tool.createdAt}`);
      } else {
        // First occurrence - keep it
        seen.set(key, tool);
        console.log(`✅ Keeping: ${tool.name} (${tool.category}) - Created: ${tool.createdAt}`);
      }
    }

    if (toDelete.length === 0) {
      console.log('\n✅ No duplicates found!');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\n🗑️  Found ${toDelete.length} duplicates to remove`);
    console.log('Removing duplicates...');

    for (const tool of toDelete) {
      await Tool.deleteOne({ _id: tool._id });
      console.log(`   ✅ Deleted: ${tool.name} (ID: ${tool._id})`);
    }

    console.log(`\n✅ Successfully removed ${toDelete.length} duplicate tools!`);
    
    // Show final count
    const finalCount = await Tool.countDocuments({ status: 'approved' });
    console.log(`📊 Final approved tools count: ${finalCount}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeDuplicates();
