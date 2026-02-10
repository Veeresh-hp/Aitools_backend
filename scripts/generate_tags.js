const fs = require('fs');
const path = require('path');

const toolsDataPath = path.join(__dirname, '../../ai-tools/src/data/toolsData.js');
const tempPath = path.join(__dirname, 'temp_tools.js');

// Read original file
let content = fs.readFileSync(toolsDataPath, 'utf8');

// Handle the export default
content = content.replace('export default toolsData;', 'module.exports = toolsData;');

// Write to temp file
fs.writeFileSync(tempPath, content);

// Require the data
const toolsData = require('./temp_tools.js');

// Helper to extract keywords
const getKeywords = (text) => {
    if (!text) return [];
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'that', 'this', 'it', 'as', 'be', 'can', 'will', 'tool', 'ai', 'app', 'platform', 'generate', 'create', 'make', 'help', 'use', 'user', 'users', 'best', 'top', 'free', 'online', 'software', 'service', 'system', 'model', 'models', 'based', 'using', 'powered', 'features', 'feature', 'include', 'includes', 'support', 'supports', 'provide', 'provides', 'offer', 'offers', 'allow', 'allows', 'enable', 'enables', 'designed', 'developed', 'built', 'simple', 'easy', 'fast', 'quick', 'powerful', 'advanced', 'smart', 'intelligent', 'automated', 'automatic', 'automatically', 'automation', 'solution', 'solutions', 'way', 'ways', 'need', 'needs', 'want', 'wants', 'like', 'such', 'example', 'examples', 'etc', 'so', 'very', 'much', 'many', 'more', 'most', 'other', 'others', 'another', 'new', 'old', 'good', 'bad', 'great', 'better', 'best', 'high', 'low', 'large', 'small', 'big', 'little', 'long', 'short', 'full', 'part', 'whole', 'real', 'time', 'day', 'week', 'month', 'year', 'now', 'then', 'here', 'there', 'where', 'when', 'why', 'how', 'what', 'who', 'which', 'whose', 'whom'];

    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word));
};

// Process tools
toolsData.forEach(category => {
    category.tools.forEach(tool => {
        const keywords = getKeywords(tool.description);
        const nameKeywords = getKeywords(tool.name);

        // Base tags
        let tags = [
            tool.name,
            category.name.replace(' Tools', ''),
            tool.pricing,
            ...nameKeywords,
            ...keywords
        ];

        // Clean and deduplicate
        tags = [...new Set(tags.map(t => t.toLowerCase().trim()).filter(t => t))];

        // Limit to top 10 tags to avoid bloat
        tool.tags = tags.slice(0, 15);
    });
});

// Generate output
// We need to be careful with JSON.stringify as it quotes keys.
// But for a data file, it's acceptable.
// Also need to handle the export default.

const output = `const toolsData = ${JSON.stringify(toolsData, null, 2)};\nexport default toolsData;`;

// Write back
fs.writeFileSync(toolsDataPath, output);

// Cleanup
fs.unlinkSync(tempPath);

console.log('Successfully added tags to toolsData.js');
