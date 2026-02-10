# Approved Tools Management Guide

## 📋 View All Approved Tools

```bash
node viewApprovedTools.js
```

This will show:
- Tool ID (needed for editing/deleting)
- Name, Category, URL, Description
- Who submitted it
- When it was approved

---

## ✏️ Edit an Approved Tool

### Quick Edit (Single Field)

```bash
node quickEditTool.js <tool-id> <field> <new-value>
```

**Examples:**

Change category:
```bash
node quickEditTool.js 69023d20742550b7e724ed2c category "chatbots"
```

Change name:
```bash
node quickEditTool.js 69023d20742550b7e724ed2c name "ChatGPT Alternative"
```

Change URL:
```bash
node quickEditTool.js 69023d20742550b7e724ed2c url "https://new-url.com"
```

Change status (approved/pending/rejected):
```bash
node quickEditTool.js 69023d20742550b7e724ed2c status "pending"
```

### Available Categories:
- `chatbots`
- `voice-tools`
- `image-generators`
- `video-generators`
- `writing-tools`
- `music-generators`
- `ai-coding-assistants`
- `presentation-tools`
- `data-analysis`
- `marketing-tools`
- `website-builders`
- `utility-tools`
- `gaming-tools`
- `short-clippers`
- `faceless-video`
- `email-assistance`
- `ai-diagrams`
- `ai-scheduling`
- `data-visualization`
- `Portfolio`
- `text-humanizer-ai`
- `meeting-notes`
- `spreadsheet-tools`

---

## 🗑️ Delete an Approved Tool

```bash
node deleteTool.js <tool-id>
```

**Example:**
```bash
node deleteTool.js 69023d20742550b7e724ed2c
```

---

## 🔄 Remove Duplicate Tools

```bash
node removeDuplicates.js
```

Automatically finds and removes duplicate tools (same name + category).

---

## 🔧 Through Admin Dashboard

You can also manage tools through the web interface:

1. Login as admin (veereshhp2004@gmail.com)
2. Go to **Admin Dashboard** (click your profile → Admin Dashboard)
3. View pending submissions
4. Approve or reject tools
5. See tool details including category

**Note:** Currently the Admin Dashboard doesn't have edit/delete buttons, but you can:
- Reject a tool to remove it from approved list
- Use the command line scripts above for editing

---

## 📊 Workflow Summary

```
1. View approved tools → node viewApprovedTools.js
2. Copy the tool ID you want to change
3. Edit the tool → node quickEditTool.js <id> <field> <value>
4. Refresh your website to see changes
```

---

## 💡 Common Tasks

### Change a tool's category:
```bash
# 1. Get the tool ID
node viewApprovedTools.js

# 2. Update category
node quickEditTool.js 69023d20742550b7e724ed2c category "chatbots"
```

### Move tool to pending (unpublish):
```bash
node quickEditTool.js 69023d20742550b7e724ed2c status "pending"
```

### Delete a tool completely:
```bash
node deleteTool.js 69023d20742550b7e724ed2c
```

### Check for duplicates:
```bash
node removeDuplicates.js
```

---

## ⚠️ Important Notes

1. **Always get the tool ID first** using `viewApprovedTools.js`
2. **Changes are immediate** - refresh your website to see updates
3. **Backup before deleting** - deletions are permanent
4. **Category names must match exactly** - use the list above
5. **Use quotes for values with spaces** - `"New Tool Name"`

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| View all tools | `node viewApprovedTools.js` |
| Edit tool | `node quickEditTool.js <id> <field> <value>` |
| Delete tool | `node deleteTool.js <id>` |
| Remove duplicates | `node removeDuplicates.js` |
| Update categories | `node updateCategories.js` |

---

## 🚀 Future Enhancement Idea

Consider adding edit/delete buttons in the Admin Dashboard UI for easier management without command line!
