 # n8n-nodes-zep-v3

Community node package that replicates 100% of the deprecated Zep nodes using Zep API v3 semantics (threads & user context) while preserving the same UX in n8n.

## Features

- **Zep Memory (v3)** — Sub-node with ai_memory port for AI Agent integration
- **Zep Vector Store (v3)** — Insert, Search, and Get Many operations
- **Drop-in replacement** for `@n8n/n8n-nodes-langchain.memoryZep`
- **Zep Cloud compatible** — Works with https://api.getzep.com

## Installation

```bash
# In your n8n custom nodes directory
npm install n8n-nodes-zep-v3
npm run build
# Restart n8n
Requirements

n8n >= 1.82
Zep Cloud account or self-hosted Zep v3

Usage

Configure Zep API v3 credentials with your API key
Add Zep Memory (v3) node to your AI Agent workflow
Set Session ID parameter
Connect to AI Agent via ai_memory port

License
MIT
