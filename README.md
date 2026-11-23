# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@1.6.0 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright="demo:yes" tailwindcss="plugins:none" sveltekit-adapter="adapter:node" drizzle="database:mysql+mysql:mysql2+docker:no" better-auth="demo:password" paraglide="languageTags:en, am+demo:yes" ai-tools="ide:claude-code,gemini,cursor,opencode,other,pi,vscode+delivery:plugin+tools:mcp,svelte-code-writer,svelte-core-bestpractices,svelte-file-editor+mcpSetup:remote+agentsMd:yes+optInSkills:none" --install npm ./
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## Deploying

The demo runs at <https://kebena.srv1912542.hstgr.cloud> on the `digital` server (`ssh digital`,
AlmaLinux + CyberPanel/OpenLiteSpeed, MariaDB, Node 24 via nvm), set up the same way as
alpha-steel and stock management:

- app: `/home/admin/apps/kebena-coffee`: `build/`, `server.js`, `package.json`, `.env`, `files/`
  (uploads, `FILES_DIR`)
- helpers and backups: `/home/admin/apps/kebena-coffee-deploy` (`root-setup.sh`, dumps)
- service: `kebena-coffee.service`, `User=admin`, on `127.0.0.1:3100`; the CyberPanel child domain
  `kebena.srv1912542.hstgr.cloud` proxies to it and forces https

```sh
npm run deploy              # build, release checks, back up, ship, restart, health-check
npm run deploy -- --dry-run # say what would happen, touch nothing
npm run release:check       # the checks alone: types, unit tests, self-contained bundle
npm run db:migrate:remote   # pending migrations on the server (dry run; `-- --apply` to apply)
```

**Only `build/` ships**, with no `node_modules` beside it, so every package except
`@nahu/admin-kit` lives in `devDependencies` and is bundled by Vite. A package moved back to
`dependencies` is a 500 on every route that reaches it; `npm run verify:build` catches that, and
`deploy` runs it every time. `server.js` wraps adapter-node's handler because OpenLiteSpeed sends
the `Origin` header twice, which SvelteKit's CSRF check would read as a cross-site form post.

`deploy` never touches the server's `.env` (the systemd `EnvironmentFile`, edited by hand), and
never syncs `files/`: the server's uploads are the live ones. Messages are dry runs there
(`NOTIFY_DRY_RUN="true"`) and Chapa stays off until its keys are filled in. `/health` answers once
the database does; `/health/ready` only once it holds every migration in `drizzle/`, and that is
what `deploy` waits for. A new migration goes up with `npm run db:migrate:remote -- --apply`
(which takes a dump first) before the deploy that needs it.

**First-time setup** needs root once: `sudo bash /home/admin/apps/kebena-coffee-deploy/root-setup.sh`
(source: `scripts/root-setup.sh`). It creates the database and user (password read from the app's
`.env`), imports `kebena_coffee-dump.sql`, installs the unit, creates the child domain and its
Let's Encrypt certificate, and points the vhost at the app, restoring the old config if the site
does not answer afterwards. `journalctl -u kebena-coffee` is readable as `admin`.

# kebena-buna
