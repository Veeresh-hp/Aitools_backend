const mongoose = require('mongoose');
const Tool = require('../models/Tool');
const Category = require('../models/Category');
const slugify = require('slugify');
require('dotenv').config();

async function reproduce() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Simulate Requesting "Anime AI"
        const name = "Anime AI";
        const slug = slugify(name, { lower: true, strict: true });
        console.log(`Generated slug for "${name}": "${slug}"`);

        let category = await Category.findOne({ slug });
        if (!category) {
            console.log('Creating new category...');
            category = await Category.create({
                name,
                slug,
                status: 'pending'
            });
        } else {
            console.log('Category already exists:', category);
        }

        // 2. Simulate Submitting Tool
        const toolData = {
            name: "Boba.video",
            description: "Test tool",
            url: "https://boba.video",
            category: category.slug, // This is what frontend sends
            status: 'pending'
        };

        console.log('Submitting tool with data:', toolData);

        const tool = await Tool.create(toolData);
        console.log('Tool created:', tool);

        if (tool.category === 'utility-tools') {
            console.error('❌ BUG REPRODUCED: Tool saved as "utility-tools"!');
        } else if (tool.category === slug) {
            console.log('✅ Tool saved correctly with category:', tool.category);
        } else {
            console.log('⚠️ Tool saved with unexpected category:', tool.category);
        }

        // Cleanup
        await Tool.findByIdAndDelete(tool._id);
        if (category.status === 'pending') {
            await Category.findByIdAndDelete(category._id);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

reproduce();
