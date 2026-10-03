FROM node:24.12-alpine

WORKDIR /usr/src/app

# 1. Copy dependency files first (for caching efficiency). pnpm-workspace.yaml
#    and .npmrc carry the onlyBuiltDependencies/allowBuilds config that lets
#    bcrypt/sharp's native build scripts run — pnpm needs them present before
#    install, not just package.json + the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# 2. Install dependencies with pnpm, matching the committed lockfile
#    (full install, not --omit=dev: `next build`'s type-check needs the
#    @types/* devDependencies)
RUN corepack enable && pnpm install --frozen-lockfile

# 3. Copy the rest of the application source code
#    (frontend/.dockerignore keeps this from clobbering node_modules
#    with the host's own macOS-built copy)
COPY . .

# 4. NEXT_PUBLIC_* vars are inlined into the client bundle at build time,
#    so this has to be a build arg, not a runtime environment variable.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 5. Build the production app
RUN pnpm build

# 6. Document the port the app listens on
EXPOSE 3000

# 7. Start the already-built app (next start)
CMD ["pnpm", "start"]
