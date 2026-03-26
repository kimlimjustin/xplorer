# Xplorer Architect + AI Chat Integration Plan

## Overview
Rebuild the xplorer-architect extension into a full-screen "Architecture Mode" that replaces the file grid. Integrate with AI Chat for context-aware code editing through a node-based visualization.

## Architecture Decisions
1. **Full-screen mode**: Add `architectMode` state to xplorer.tsx. When active, MainLayout renders ArchitectView instead of FileGrid
2. **AI API bridge**: Add `api.ai` namespace to extension-api-factory.ts, wrapping AgentService for streaming chat
3. **Node selection context**: Selected node info passed to AI Chat via shared state/events
4. **Code expansion**: Nodes can be expanded inline to show source code with syntax highlighting
5. **Architecture discovery**: AI agent scans project and returns structured JSON (nodes + edges)

## Waves

### Wave 1: Core Infrastructure
- T1.1: Add `ai` namespace to extension-api-factory.ts (AgentService bridge)
- T1.2: Add architecture mode toggle to MainLayout/xplorer.tsx

### Wave 2: Architecture Extension Rebuild
- T2.1: Rebuild architect extension with full-screen canvas, expandable nodes, code preview
- T2.2: AI-powered project scanning (uses api.ai to analyze codebase structure)

### Wave 3: AI Chat Integration
- T3.1: Wire selected node context to AI Chat
- T3.2: AI Chat understands architecture, can modify code through nodes

### Wave 4: Polish
- T4.1: Testing + error handling
- T4.2: Commit

## Status: EXECUTING
