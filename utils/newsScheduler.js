const cron = require('node-cron');
const Article = require('../models/Article');
const slugify = require('slugify');

// API Configuration
const NEWS_API_KEY = process.env.NEWS_API_KEY || '12b8cc990508487b8ddb1d4426e82459';
// Optimized query from user request
const QUERY = '("AI tools" OR "new AI tool" OR "AI software release" OR "generative AI" OR "AI product launch" OR "OpenAI" OR "Gemini AI" OR "Anthropic") AND ("launch" OR "release" OR "update" OR "new" OR "tool")';

const fetchAndStoreNews = async () => {
    console.log('🔄 Running Daily AI News Fetch...');
    try {
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(QUERY)}&sortBy=publishedAt&language=en&pageSize=20&apiKey=${NEWS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'ok') {
            console.error('❌ NewsAPI Error:', data.message);
            return;
        }

        let newCount = 0;

        for (const article of data.articles) {
            // Skip removed content or missing titles
            if (article.title === '[Removed]' || !article.title || !article.url) continue;

            const slug = slugify(article.title, { lower: true, strict: true }) + '-' + Date.now().toString().slice(-4);

            const articleData = {
                title: article.title,
                summary: article.description || article.content?.substring(0, 200) + '...',
                content: article.content || article.description,
                image: article.urlToImage,
                author: article.author || article.source.name,
                sourceUrl: article.url,
                isExternal: true,
                publishedAt: article.publishedAt,
                slug: slug,
                status: 'published',
                tags: ['AI News', 'Tech', 'Automation'] // Basic tagging
            };

            // Upsert: Check for existing article by URL OR Title to prevent duplicates
            const result = await Article.updateOne(
                { 
                    $or: [
                        { sourceUrl: article.url },
                        { title: article.title }
                    ]
                },
                { $setOnInsert: articleData }, // Only set on insert to preserve existing data/edits
                { upsert: true }
            );

            if (result.upsertedCount > 0) newCount++;
        }

        console.log(`✅ AI News Fetch Complete. Added ${newCount} new articles.`);

    } catch (error) {
        console.error('❌ Scheduler Error:', error);
    }
};

// Initialize Scheduler
const initNewsScheduler = () => {
    // Run every day at midnight (0 0 * * *)
    // For testing/demo, we can also run it on startup if needed, but let's stick to schedule + manual trigger
    cron.schedule('0 0 * * *', fetchAndStoreNews);
    
    // Also run once immediately on server start to populate initial data
    fetchAndStoreNews();
};

module.exports = { initNewsScheduler, fetchAndStoreNews };
