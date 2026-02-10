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

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        for (const cat of categories) {
            const exists = await Category.findOne({ name: cat.id }); // Using ID as name for consistency with current frontend logic or name? 
            // Wait, the frontend uses ID for value and Name for display. 
            // If I switch to dynamic, I should probably use the ID as the key or just use the name as the ID.
            // Let's check the Tool model again. It stores "category" as a string.
            // In AddTool.jsx: value={cat.id}>{cat.name}
            // So the DB stores "chatbots", "image-generators", etc.

            // So I should store the ID as the name in the Category model? 
            // Or should I store both?
            // The Category model has "name". 
            // If I store "Chatbots" as name, then the Tool model will have "chatbots" (lowercase, dashed) and it won't match.
            // I should probably store the "id" as the "name" in the Category model to match the existing data, 
            // OR I should migrate the Tool data.
            // Migrating Tool data is risky.
            // Better to store the "id" (e.g. 'chatbots') as the 'name' in the Category model?
            // But then the display name will be 'chatbots' which is ugly.

            // Let's look at the Category model again.
            // name: { type: String, required: true, unique: true, trim: true }

            // If I change the frontend to use the Category name as the value, then new tools will have "Chatbots" instead of "chatbots".
            // This creates inconsistency.

            // Proposal: Add a "slug" or "key" field to Category model?
            // Or just use the "name" as the display name and "slug" as the ID.

            // Let's update the Category model to have `name` (display) and `slug` (id).
            // But wait, the prompt said "new category should reflect means appear in the all category list".
            // If a user adds "Quantum Computing", the slug would be "quantum-computing".

            // Let's update the Category model to have `slug` and `name`.
            // `slug` will be the ID used in the DB. `name` will be the display name.

            // I will update the Category model first.
        }
    });
