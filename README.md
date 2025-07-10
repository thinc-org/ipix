# iPix

## Description

Photo management system for Intania.

## Installation

```bash
bun i
```

## Running the app

```bash
bun dev
```

To run any particular app in the monorepo, use:

```bash
bun dev --filter <app-name>
```

## Roadmap

See GitHub Projects.

## Contributing

Issue template coming soon TM.

## Authors and acknowledgment

Project Manager

- [Maersk1112](https://github.com/Maersk1112)

Engineering Team

- [Puifaii](https://github.com/Puifaii)
- [neennera](https://github.com/neennera)
- [wnmay](https://github.com/wnmay)
- [betich](https://github.com/betich)

## Status

- [ ] Set-up Formatter (Prettier)
- [ ] Set-up Linter (ESLint)
- [ ] Set-up CI/CD
- [ ] Set-up [Catalog](https://bun.sh/docs/install/catalogs)
- [ ] Set-up `@repo/eslint-config`
- [ ] Set-up `@repo/api`
- [ ] Set-up `@repo/rdb`
- [ ] Set-up `@repo/s3db`
- [ ] Set-up `@repo/auth`

# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
bunx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps Packages, and Tools

- `docs`: a ElysiaJS app
- `web`: a TanStack Start app
- `@repo/ui`: a stub React component library shared by `web` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo.
- `@repo/api`: package for trpc configuration.
- `@repo/rdb`: package for relational/sql database configuration.
- `@repo/s3db`: package for s3 database configuration.
- `@repo/auth`: package for auth configuration.

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Shared

These are things that will be used in many areas:

- `@repo/shared`: shared assets.

### Utilities/Tools

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build
yarn dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build --filter=docs

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev --filter=web

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo login

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo link

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
- [TanStack](https://tanstack.com)
- [ElysiaJS](https://elysiajs.com/)
- [tRPC](https://trpc.io/)
- [Monorepo Example](https://github.com/nktnet1/rt-stack)
- [Effectively using tRPC in a monorepo](https://github.com/trpc/trpc/discussions/1860#discussioncomment-4406931)
- [package.json cheatsheet](https://areknawo.com/whats-what-package-json-cheatsheet/)
