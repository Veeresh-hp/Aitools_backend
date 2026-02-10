const mongoose = require('mongoose');
const Category = require('../models/Category');
require('dotenv').config();

const categories = [
    { id: 'chatbots', name: 'Chatbots' },
    { id: 'image-generators', name: 'Image Generators' },
    { id: 'music-generators', name: 'Music Generators' },
    { id: 'video-generators', name: 'Video Generators' },
    { id: 'writing-tools', name: 'Writing Tools' },
    { id: 'ai-coding-assistants', name: 'AI Coding Assistants' },
    { id: 'voice-tools', name: 'Voice/Audio Tools' },
    { id: 'data-analysis', name: 'Data Analysis' },
    { id: 'marketing-tools', name: 'Marketing Tools' },
    { id: 'email-assistance', name: 'Email Assistance' },
    { id: 'presentation-tools', name: 'Presentation Tools' },
    { id: 'website-builders', name: 'Website Builders' },
    { id: 'ai-diagrams', name: 'AI Diagrams' },
    { id: 'data-visualization', name: 'Data Visualization' },
    { id: 'ai-scheduling', name: 'AI Scheduling' },
    { id: 'meeting-notes', name: 'Meeting Notes' },
    { id: 'spreadsheet-tools', name: 'Spreadsheet Tools' },
    { id: 'utility-tools', name: 'Utility Tools' },
    { id: 'gaming-tools', name: 'Gaming Tools' },
    { id: 'short-clippers', name: 'Short Clippers' },
    { id: 'text-humanizer-ai', name: 'Text Humanizer AI' },
    { id: 'faceless-video', name: 'Faceless Video' },
    { id: 'portfolio', name: 'Portfolio' },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        for (const cat of categories) {
            const exists = await Category.findOne({ slug: cat.id });
            if (!exists) {
                await Category.create({
                    name: cat.name,
                    slug: cat.id,
                    status: 'approved'
                });
                console.log(`Created category: ${cat.name}`);
            } else {
                console.log(`Category exists: ${cat.name}`);
            }
        }
        console.log('Seeding complete');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
