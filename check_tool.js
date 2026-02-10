const mongoose = require('mongoose');
require('dotenv').config();

const checkTool = async () => {
    if (!process.env.MONGO_URI) { console.error("No MONGO_URI"); return; }
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tool = mongoose.models.Tool || mongoose.model('Tool', new mongoose.Schema({ rating: Number, reviewCount: Number, name: String }, { strict: false }));
        
        const tools = await Tool.find({ name: { $in: ["Class Central", "Hacksplaining"] } });
        console.log("Found tools:", tools);
        
        await mongoose.disconnect();
    } catch (e) { console.error(e); }
};
checkTool();
