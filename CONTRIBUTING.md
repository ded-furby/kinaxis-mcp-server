# Contributing

Thanks for contributing to `kinaxis-mcp-server`.

## Local Setup

1. Fork and clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Copy the example environment file and add your Kinaxis credentials:

```bash
cp .env.example .env
```

4. Start the server locally:

```bash
npm start
```

If you are iterating on the server implementation, you can also use:

```bash
npm run dev
```

## Environment

At minimum, configure:

```env
KINAXIS_BASE_URL=https://your-region.kinaxis.net/YOUR_INSTANCE
KINAXIS_CLIENT_ID=your_oauth2_client_id
KINAXIS_CLIENT_SECRET=your_oauth2_client_secret
```

If you use Basic Auth instead of OAuth2:

```env
KINAXIS_BASE_URL=https://your-region.kinaxis.net/YOUR_INSTANCE
KINAXIS_USERNAME=your_ws_user
KINAXIS_PASSWORD=your_ws_password
```

Never commit real credentials, exported data, or customer-specific Maestro documentation.

## Testing

There is no dedicated automated test suite yet.

Before opening a pull request, please:

1. Run `npm start` or `npm run dev` successfully.
2. Validate the MCP server boots with your chosen authentication method.
3. Include the manual verification steps you used in the pull request description.

If your contribution adds a test harness or linting command, update this document so future contributors can run it the same way.

## Branches And Pull Requests

1. Create a focused branch from `main`.
2. Keep each pull request scoped to one feature, fix, or documentation improvement.
3. Open the pull request against `main`.
4. Describe the problem, the change, and any manual verification steps.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

Examples:

- `feat: add workbook metadata helper`
- `fix: handle empty bulk export responses`
- `docs: clarify OAuth2 configuration`
- `chore: update development scripts`

## Release Flow

Maintainers can cut a release with the standard npm versioning flow:

```bash
npm version patch
git push --follow-tags
```

After the version tag is pushed, publish release notes on GitHub and record user-facing changes in [`CHANGELOG.md`](./CHANGELOG.md).

## Code Of Conduct

This repository does not currently ship a dedicated code of conduct.
Contributors should follow the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/).
