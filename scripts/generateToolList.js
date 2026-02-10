const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Tool = require('../models/Tool');

// Path to frontend data
const FRONTEND_DATA_PATH = path.join(__dirname, '../../Frontend/src/data/toolsData.js');
const OUTPUT_FILE = path.join(__dirname, '../../all_tools_list.md');

async function getFrontendTools() {
  try {
    const fileContent = fs.readFileSync(FRONTEND_DATA_PATH, 'utf8');
    // Remove "export default toolsData;" and any potential imports (though none seen)
    // We want to evaluate "const toolsData = [...]; return toolsData;"
    // But since it is just a variable declaration, we can strip the export and eval.
    
    // Simple parsing strategy:
    // 1. Remove "export default toolsData;"
    // 2. Wrap in a function or just eval
    
    // Regex to remove the export statement
    const cleanContent = fileContent.replace(/export default toolsData;[\s\S]*/, '');
    
    // We will use a safe evaluation approach using Function
    // We need to make sure the content is just data.
    // "const toolsData = ..." -> we want just the array.
    
    // Let's try to extract the array content directly if possible, 
    // or just eval the whole string and access toolsData.
    
    const context = {};
    // Emulate a minimal environment
    // We'll use vm module for slightly better safety/isolation
    const vm = require('vm');
    const script = new vm.Script(cleanContent + '; toolsData;');
    const result = script.runInNewContext(context);
    
    // result should be the toolsData array
    // Validate structure
    if (!Array.isArray(result)) {
        console.warn('Frontend data extraction failed: result is not an array');
        return [];
    }
    
    const tools = [];
    result.forEach(category => {
        if (category.tools && Array.isArray(category.tools)) {
            category.tools.forEach(tool => {
                if (tool.name && tool.url) {
                    tools.push({
                        name: tool.name,
                        url: tool.url,
                        source: 'Frontend Static'
                    });
                }
            });
        }
    });
    
    console.log(`Found ${tools.length} tools in Frontend static file.`);
    return tools;
    
  } catch (err) {
    console.error('Error reading frontend tools:', err.message);
    return [];
  }
}

async function generateList() {
  try {
    // 1. Fetch Backend Tools
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const dbTools = await Tool.find({ status: 'approved' }).sort({ name: 1 });
    console.log(`Found ${dbTools.length} approved tools in Database.`);
    
    const backendToolsList = dbTools.map(t => ({
        name: t.name,
        url: t.url,
        source: 'Database'
    }));

    // 2. Fetch Frontend Tools
    const frontendToolsList = await getFrontendTools();
    
    // 3. Merge and Deduplicate
    // Map URL -> Tool to dedup. Prefer Database version if conflict? 
    // Or just list them. Let's dedup by normalized URL.
    
    const allToolsMap = new Map();
    
    const normalize = (url) => {
        try {
            return new URL(url).hostname.replace('www.', '').toLowerCase();
        } catch (e) {
            return url.toLowerCase();
        }
    };
    
    // Add frontend tools first
    frontendToolsList.forEach(tool => {
        allToolsMap.set(normalize(tool.url), tool);
    });
    
    // Add/Overwrite with backend tools (assuming DB is more up to date or "truth")
    backendToolsList.forEach(tool => {
        allToolsMap.set(normalize(tool.url), tool);
    });
    
    const uniqueTools = Array.from(allToolsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`Total unique tools: ${uniqueTools.length}`);
    
    // 4. Generate Markdown
    let mdContent = `# All AI Tools List\n\nGenerated on: ${new Date().toLocaleString()}\n\n`;
    mdContent += `Total Tools: ${uniqueTools.length}\n\n`;
    
    uniqueTools.forEach((tool, index) => {
        mdContent += `${index + 1}. **[${tool.name}](${tool.url})**\n`;
    });
    
    fs.writeFileSync(OUTPUT_FILE, mdContent);
    console.log(`\nSuccessfully wrote tool list to: ${OUTPUT_FILE}`);
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

generateList();
