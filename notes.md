# Deployment Progress Notes

Full roadmap: `~/.claude/plans/zippy-singing-sutton.md` (outside this repo — see that file for the full architecture, rationale, and milestone list this is tracking against).

## Done

- **Local Docker setup** — `backend/Dockerfile`, `frontend/Dockerfile`, `compose.yml` all fixed and verified working end-to-end (`docker compose up --build`, both services reachable, backend serving real data from the mounted `data/` volume).
- **`backend/fastAPI.py` — routing/CORS changes for the ALB** (plan §4):
  - All routes moved from `@app.` to `@router.` on an `APIRouter(prefix="/api")`, registered via `app.include_router(router)`.
  - Added unprefixed `GET /health` on `app` directly (for the ALB target-group health check — stays outside `/api` since health checks hit the target group path directly, bypassing listener routing rules).
  - `allow_origins` now reads `ALLOWED_ORIGINS` env var (comma-separated), defaulting to `"http://localhost:3000"` — local `compose.yml` behavior unchanged.
- **AWS CLI** confirmed installed and authenticated (account `289064655440`, user `aiengineer`).
- **`bootstrap/`** folder scaffolded (`providers.tf`, `main.tf`, `.gitignore` with `*.tfstate*` / `.terraform/`) — **files are currently empty**, not yet filled in.
- **`infra/`** folder scaffolded with empty placeholder files matching the plan's structure: `providers.tf`, `variables.tf`, `outputs.tf`, `backend.tf`, `network.tf`, `security_groups.tf`, `ecr.tf`, `ecs_cluster.tf`, `ecs_backend.tf`, `ecs_frontend.tf`, `alb.tf`, `efs.tf`, `s3_data.tf`, `secrets.tf`, `iam.tf`, `github_oidc.tf` — **all empty**, nothing written yet.

## Next up

1. **Install Terraform** — `brew install terraform` (confirmed not installed yet).
2. **Fill in `bootstrap/providers.tf` + `bootstrap/main.tf`**:
   - `providers.tf`: `required_providers` (hashicorp/aws ~> 5.0) + `provider "aws" { region = ... }`.
   - `main.tf`: `aws_s3_bucket` (name via `data "aws_caller_identity" "current"` interpolation, **not** a hardcoded account ID) + `aws_s3_bucket_versioning` + `aws_s3_bucket_server_side_encryption_configuration` + `aws_s3_bucket_public_access_block` (all 4 flags true) + `aws_dynamodb_table` (`PAY_PER_REQUEST`, hash key `LockID` type `S`).
   - Add an `outputs.tf` printing the bucket name + table name (so they're easy to paste into `infra/backend.tf` later).
   - Run `terraform init && terraform plan && terraform apply` from inside `bootstrap/`.
3. **Then start on `infra/`, in the plan's milestone order** (don't try to fill all 16 files at once):
   - Milestone 2: `network.tf` + `security_groups.tf` only (VPC, 2 public subnets/2 AZs, IGW, route table, the 4 SGs) — apply and verify in the console before moving on.
   - Milestone 3: `ecr.tf`, then manually `docker build`/`push` both images by hand (not CI yet).
   - Milestone 4: `ecs_cluster.tf`, `ecs_backend.tf`, `ecs_frontend.tf`, `alb.tf` — hand-assembled task defs pointing at the images pushed in milestone 3; secrets can be temporary plaintext env vars for now (flagged to replace in milestone 6). Goal: prove ECS + ALB + health check + `/api/*` path routing works.
   - Milestone 5: `efs.tf` + `s3_data.tf` + the backend startup sync script (`backend/entrypoint.sh`, needs `boto3` added to `backend/requirements.txt`) — upload `baseball.duckdb` to S3 once by hand, wire EFS into the backend task def.
   - Milestone 6: `secrets.tf` (SSM `SecureString` params, placeholder value + `lifecycle { ignore_changes = [value] }`) — set real `OPENAI_API_KEY`/`HF_TOKEN` values by hand, swap the task def's plaintext env vars for the `secrets` block.
   - Milestone 7: rebuild frontend image with the real ALB DNS name as `NEXT_PUBLIC_API_URL=http://<alb-dns>/api` (only possible once the ALB from milestone 4 actually exists), full browser test.
4. **GitHub Actions** (`.github/workflows/` doesn't exist yet) — comes after `infra/` is proven working by hand (milestone 8 app pipeline, then milestone 9 infra pipeline with `terraform plan`/`apply` automation). Needs: OIDC provider + two separate IAM roles (`github-actions-app`, `github-actions-infra`) via `infra/github_oidc.tf`.

## Gotchas already resolved (don't re-litigate)

- `NEXT_PUBLIC_API_URL` is baked into the frontend's JS bundle at `docker build` time (Next.js inlines `NEXT_PUBLIC_*` vars at build, not runtime) — can't be set correctly until the ALB exists and its DNS name is known.
- ALB health checks hit the target group's configured path directly, bypassing listener path-routing rules — that's why `/health` stays unprefixed while everything else moved under `/api`.
- `frontend/app/page.tsx` (the `/` route the ALB will health-check for the frontend target group) is a plain client component with no auth redirect — already confirmed safe as a health-check target as-is.
- EFS (not EBS) for the DuckDB data volume — multi-AZ, mountable by concurrent Fargate tasks, survives task churn so redeploys don't re-trigger a 1.7GB download.
- SSM Parameter Store (not Secrets Manager) for `OPENAI_API_KEY`/`HF_TOKEN` — free, no rotation needed for these.
