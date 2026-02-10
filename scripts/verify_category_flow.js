const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Category = require('../models/Category');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

async function runTest() {
    console.log('🚀 Starting Category Flow Verification...');

    try {
        // 1. Connect to DB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Create Temp Admin User
        const uniqueId = Date.now();
        const adminEmail = `testadmin_${uniqueId}@example.com`;
        const adminUser = await User.create({
            username: `TestAdmin_${uniqueId}`,
            email: adminEmail,
            password: 'password123',
            role: 'admin'
        });
        console.log(`✅ Created temp admin: ${adminEmail}`);

        // 3. Generate Token
        const token = jwt.sign({ userId: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 4. Request New Category (as public/anonymous)
        const categoryName = `Test Category ${uniqueId}`;
        console.log(`Testing category request: "${categoryName}"`);

        const reqRes = await fetch(`${API_URL}/categories/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: categoryName })
        });

        if (reqRes.status !== 201) {
            const errText = await reqRes.text();
            throw new Error(`Failed to request category: ${reqRes.status} ${errText}`);
        }
        const reqData = await reqRes.json();
        if (reqData.category.status === 'pending') {
            console.log('✅ Category requested successfully');
        } else {
            throw new Error('Category status is not pending');
        }

        const categoryId = reqData.category._id;

        // 5. Verify it appears in pending list (as admin)
        const pendingRes = await fetch(`${API_URL}/categories/pending`, { headers });
        if (pendingRes.status !== 200) {
            const errText = await pendingRes.text();
            throw new Error(`Failed to fetch pending categories: ${pendingRes.status} ${errText}`);
        }
        const pendingCats = await pendingRes.json();
        const foundPending = pendingCats.find(c => c._id === categoryId);

        if (foundPending) {
            console.log('✅ Category found in pending list');
        } else {
            throw new Error('Category not found in pending list');
        }

        // 6. Approve Category (as admin)
        const approveRes = await fetch(`${API_URL}/categories/${categoryId}/approve`, {
            method: 'POST',
            headers
        });
        if (approveRes.status !== 200) {
            const errText = await approveRes.text();
            throw new Error(`Failed to approve category: ${approveRes.status} ${errText}`);
        }
        const approveData = await approveRes.json();
        if (approveData.category.status === 'approved') {
            console.log('✅ Category approved successfully');
        } else {
            throw new Error('Failed to approve category');
        }

        // 7. Verify it appears in public list
        const publicRes = await fetch(`${API_URL}/categories`);
        if (publicRes.status !== 200) {
            const errText = await publicRes.text();
            throw new Error(`Failed to fetch public categories: ${publicRes.status} ${errText}`);
        }
        const publicCats = await publicRes.json();
        const foundPublic = publicCats.find(c => c._id === categoryId);

        if (foundPublic) {
            console.log('✅ Category found in public list');
        } else {
            throw new Error('Category not found in public list');
        }

        // Cleanup
        await User.findByIdAndDelete(adminUser._id);
        await Category.findByIdAndDelete(categoryId);
        console.log('✅ Cleanup complete');

    } catch (err) {
        console.error('❌ Test Failed:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
