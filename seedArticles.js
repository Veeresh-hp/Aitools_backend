const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const Article = require('./models/Article');

// Load env from backend folder
dotenv.config({ path: path.join(__dirname, '.env') });

const articles = [
  {
    title: "The Rise of Autonomous AI Agents",
    slug: "rise-of-autonomous-ai-agents",
    summary: "Explore how 2024 is becoming the year of autonomous agents. We analyze the top tools leading this revolution and what it means for developers.",
    content: `
<h1>The Rise of Autonomous AI Agents</h1>
<p>2024 is shaping up to be the year of the <strong>autonomous agent</strong>. Unlike passive chatbots that wait for prompts, these new tools can plan, execute, and iterate on tasks independently.</p>

<h2>Key Players</h2>
<ul>
  <li><strong>AutoGPT</strong>: The open-source pioneer that showed us what's possible.</li>
  <li><strong>BabyAGI</strong>: A task-driven autonomous agent.</li>
  <li><strong>AgentGPT</strong>: Bringing autonomous agents to the browser.</li>
</ul>

<h2>Deeply Integrated into Workflows</h2>
<p>These tools aren't just novelties; they are being integrated into complex coding and data analysis workflows. The future of AI is agentic.</p>
    `,
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000",
    tags: ["AI Agents", "Trends", "2024"],
    createdAt: new Date('2024-12-20')
  },
  {
    title: "Top 5 AI Coding Assistants Compared",
    slug: "top-5-ai-coding-assistants-compared",
    summary: "We tested GitHub Copilot, Cursor, and others side-by-side. Here is our definitive ranking for productivity and accuracy.",
    content: `
<h1>Top 5 AI Coding Assistants Compared</h1>
<p>We put the top AI coding tools to the test. Here's what we found.</p>

<h2>1. Cursor</h2>
<p>A fork of VS Code that integrates AI natively. It feels like the future of coding.</p>

<h2>2. GitHub Copilot</h2>
<p>The standard. Reliable, everywhere, and backed by Microsoft/OpenAI.</p>

<h2>3. Supermaven</h2>
<p>Incredible speed and long context window.</p>

<h2>Conclusion</h2>
<p>The best tool depends on your specific workflow, but Cursor is currently leading the pack in innovation.</p>
    `,
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=1000",
    tags: ["Coding", "Reviews", "Productivity"],
    createdAt: new Date('2024-12-21')
  },
  {
    title: "Generative Video: The Next Frontier",
    slug: "generative-video-next-frontier",
    summary: "From Sora to Runway Gen-2, generative video is advancing at breakneck speed. Learn how these tools are changing content creation.",
    content: `
<h1>Generative Video: The Next Frontier</h1>
<p>Text-to-video was a dream just a few years ago. Now, it's a reality.</p>

<h2>The Big Shift</h2>
<p>Tools like <strong>Sora</strong> and <strong>Runway Gen-2</strong> allow creators to generate high-fidelity video from simple text prompts. This changes the economics of filmmaking and advertising forever.</p>

<h2>What to Watch</h2>
<p>Keep an eye on consistency and length. As these models improve, we will see full short films generated entirely by AI.</p>
    `,
    image: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?auto=format&fit=crop&q=80&w=1000",
    tags: ["Video AI", "Generative AI", "Creative"],
    createdAt: new Date('2024-12-22')
  }
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Clear existing articles to avoid dupes during dev
    await Article.deleteMany({});
    console.log('Cleared existing articles');

    await Article.insertMany(articles);
    console.log('Seeded 3 articles successfully');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Seeder Error:', err);
    process.exit(1);
  });
