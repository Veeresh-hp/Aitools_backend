require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    const count = await Category.countDocuments();
    console.log(`Total categories: ${count}`);
    
    const approved = await Category.countDocuments({ status: 'approved' });
    console.log(`Approved categories: ${approved}`);
    
    const all = await Category.find({});
    console.log('Categories:', all.map(c => `${c.name} (${c.status})`));
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
