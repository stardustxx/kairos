# Kairos MCP Server Docker Image
# Provides a deterministic fallback for Intel-mac, musl, and unprebuilt ABI users

FROM node:20-alpine

WORKDIR /app

# Install kairos-astrology globally
RUN npm install -g kairos-astrology

# Expose the MCP server via stdio
# Run as: docker run --rm -i kairos:latest npx -y kairos-astrology mcp
# Or for direct CLI: docker run --rm kairos:latest kairos compute '{"kind":"horary",...}'

ENTRYPOINT ["kairos"]
CMD ["mcp"]
