# Secrets and Environment Variables

Never hardcode credentials, API keys, or other secrets in source code. `LLM_API_KEY` and any future secret must be supplied via environment variables / a local `.env` file, per `docs/deployment/docker-compose.md` §5.

Never commit a `.env` file or any file containing a real secret value. Confirm `.gitignore` actually excludes it before adding new secret-bearing configuration — don't assume.

If a new secret or credential is introduced, document its environment variable name in `docs/deployment/docker-compose.md` §5 (and `ai/context/` if it's relevant background), not just inline in code where it's easy to miss.
