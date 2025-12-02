# infra/smartlead-mcp/Dockerfile
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install the Smartlead MCP server CLI
RUN npm install -g smartlead-mcp-by-leadmagic

# Environment passed at runtime by docker-compose or `docker run`
ENV SMARTLEAD_API_KEY=""
ENV SMARTLEAD_ADVANCED_TOOLS="true"

# MCP talks over STDIN/STDOUT, so just start the CLI
ENTRYPOINT ["smartlead-mcp-by-leadmagic"]