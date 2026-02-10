const mongoose = require('mongoose');
const Tool = require('../models/Tool');
const Category = require('../models/Category');
require('dotenv').config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const tool = await Tool.findOne({ name: 'Boba.video' });
        console.log('--- Tool Data ---');
        if (tool) {
            console.log(tool);
        } else {
            console.log('Tool "Boba.video" not found.');
        }

        const category = await Category.findOne({ slug: 'anime-ai' });
        console.log('--- Category Data (anime-ai) ---');
        if (category) {
            console.log(category);
        } else {
            console.log('Category "anime-ai" not found.');
        }

        const allCategories = await Category.find({});
        console.log(`--- All Categories (${allCategories.length}) ---`);
        console.log(allCategories.map(c => `${c.name} (${c.slug})`).join(', '));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkData();
