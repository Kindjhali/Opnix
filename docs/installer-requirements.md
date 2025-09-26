# Opnix Installer System Requirements

## Current Issue

The existing `install.sh` script is **severely outdated** and creates a basic "OTKIT" ticket system instead of the full Opnix system. It needs to be completely rewritten to create the current production-ready Opnix with all its advanced features.

## Required Components for Complete Installer

### 1. Core System Files
- `package.json` with all current dependencies
- `server.js` with full API endpoints and middleware
- Complete Vue.js frontend (`public/index.html` and `src/App.vue + src/appOptions.js`)
- All CSS theming and Cytoscape.js integration

### 2. Directory Structure
```
opnix/
├── agents/          # All 37+ agent markdown files
├── data/            # Workspace data directory
│   ├── tickets.json
│   ├── features.json
│   └── module-links.json
├── docs/            # Documentation system
├── public/          # Frontend assets
├── scripts/         # Setup and automation scripts
├── services/        # Backend services
├── spec/            # Export and archive system
│   ├── audits/
│   ├── canvas/
│   ├── diagrams/
│   ├── docs/
│   └── roadmaps/
└── src/             # Application source (if present)
```

### 3. Dependencies Required
**Production:**
- express ^4.18.2
- cors ^2.8.5
- multer (for file uploads)
- winston (for logging)
- node-cron (for scheduled tasks)

**Development:**
- nodemon ^3.0.1
- eslint
- prettier

### 4. Frontend Libraries (CDN)
- Vue.js 3.3.4
- Cytoscape.js ^3.26.0
- cytoscape-edgehandles ^4.0.1
- Frappe Gantt ^0.6.1
- JetBrains Mono font
- Orbitron font

### 5. Sample Data Structure

**data/tickets.json:**
```json
{
  "tickets": [
    {
      "id": 1,
      "title": "Example: Fix Authentication Bug",
      "description": "Users cannot login with @ symbol. Review auth validation logic and provide fix. Check /src/auth/validator.js line 45.",
      "priority": "high",
      "status": "reported",
      "tags": ["BUG", "AUTH", "BACKEND"],
      "created": "2025-09-25T00:00:00.000Z",
      "files": ["src/auth/validator.js"],
      "acceptanceCriteria": []
    }
  ],
  "nextId": 2
}
```

**data/features.json:**
```json
{
  "features": [
    {
      "id": 1,
      "name": "User Authentication",
      "description": "Secure user login and registration system",
      "status": "development",
      "progress": 75,
      "todos": [],
      "acceptanceCriteria": [],
      "linkedTickets": [1]
    }
  ],
  "nextId": 2
}
```

### 6. Configuration Files

**eslint.config.js** (for code quality)
**scripts/setupWizard.js** (interactive setup)
**scripts/installCli.js** (CLI installation)

### 7. Server Configuration

Full Express.js server with:
- CORS enabled
- 50MB body parser limits
- Static file serving
- Complete API endpoints:
  - `/api/agents` - Agent management
  - `/api/tickets` - Ticket CRUD
  - `/api/features` - Feature management
  - `/api/modules/*` - Module detection and links
  - `/api/canvas/*` - Canvas operations
  - `/api/roadmap/*` - Roadmap functionality
  - `/api/exports/*` - Export system
  - `/api/terminal/*` - Terminal integration

### 8. Installation Process Flow

1. **Environment Check**
   - Verify Node.js version (>=16)
   - Check npm availability
   - Validate write permissions

2. **Directory Creation**
   - Create complete directory structure
   - Set appropriate permissions
   - Initialize data directories

3. **File Generation**
   - Generate package.json with full dependencies
   - Create server.js with all API endpoints
   - Generate complete frontend with Vue.js
   - Copy all agent files
   - Create sample data files

4. **Dependency Installation**
   - Run `npm install`
   - Verify successful installation
   - Check for any missing dependencies

5. **System Validation**
   - Start server briefly to test
   - Verify all endpoints respond
   - Check frontend loads correctly
   - Validate agent system works

6. **User Instructions**
   - Display startup commands
   - Show URL for web interface
   - Provide Claude CLI examples
   - List key API endpoints

### 9. Advanced Installer Features (Future)

- **Hidden Directory Installation**: Install to `.opnix/` directory
- **Existing Installation Detection**: Check for existing `.opnix/` and offer upgrade
- **Runtime Bundle**: Single script that unpacks complete system
- **Auto-cleanup**: Remove installation artifacts after successful setup

## Current Status

- ❌ **Outdated installer**: Creates wrong system entirely
- ❌ **Missing components**: No agents, services, or advanced features
- ❌ **Wrong structure**: Creates OTKIT instead of Opnix
- ❌ **Incomplete dependencies**: Missing critical libraries
- ❌ **No validation**: No checks for successful installation

## Next Agent Instructions

The next agent should:

1. **Completely rewrite install.sh** from scratch
2. **Test installation** in a clean directory
3. **Verify all features work** after installation
4. **Update TODO.md** to mark installer items complete
5. **Create installation documentation** for end users

This is a **high-priority, complete rewrite task** that requires systematic approach to ensure the installer creates a fully functional Opnix system identical to the current production version.