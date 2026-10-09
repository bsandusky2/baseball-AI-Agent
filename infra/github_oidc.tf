# github_oidc.tf

# ---------------------------------------------------------
# GitHub Actions OIDC Provider
# ---------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "ffffffffffffffffffffffffffffffffffffffff"
  ]
}


# ---------------------------------------------------------
# GitHub Actions Infrastructure Role
# Used by Terraform
# ---------------------------------------------------------

resource "aws_iam_role" "github_actions_infra" {
  name = "github-actions-infra"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }

          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:YOUR_GITHUB_USERNAME/YOUR_REPOSITORY:*"
          }
        }
      }
    ]
  })
}


# ---------------------------------------------------------
# Infrastructure Permissions
#
# Scoped to the AWS services this Terraform config actually
# manages, instead of blanket AdministratorAccess. IAM actions
# are further scoped to the specific role/provider names this
# config creates, so the role can't mint arbitrary new
# privileged identities.
# ---------------------------------------------------------

resource "aws_iam_role_policy" "github_actions_infra" {
  name = "github-actions-infra-policy"
  role = aws_iam_role.github_actions_infra.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid    = "NetworkingAndSecurityGroups"
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "ec2:CreateSecurityGroup",
          "ec2:DeleteSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:CreateTags",
          "ec2:DeleteTags"
        ]
        Resource = "*"
      },
      {
        Sid      = "LoadBalancing"
        Effect   = "Allow"
        Action   = "elasticloadbalancing:*"
        Resource = "*"
      },
      {
        Sid      = "ECS"
        Effect   = "Allow"
        Action   = "ecs:*"
        Resource = "*"
      },
      {
        Sid      = "ECR"
        Effect   = "Allow"
        Action   = "ecr:*"
        Resource = "*"
      },
      {
        Sid      = "EFS"
        Effect   = "Allow"
        Action   = "elasticfilesystem:*"
        Resource = "*"
      },
      {
        Sid    = "S3DataBucket"
        Effect = "Allow"
        Action = "s3:*"
        Resource = [
          "arn:aws:s3:::baseball-data-*",
          "arn:aws:s3:::baseball-data-*/*"
        ]
      },
      {
        Sid      = "ParameterStore"
        Effect   = "Allow"
        Action   = "ssm:*"
        Resource = "arn:aws:ssm:*:*:parameter/baseball-agent/*"
      },
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = "logs:*"
        Resource = "*"
      },
      {
        Sid    = "IamForManagedRoles"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:PassRole",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies"
        ]
        Resource = [
          "arn:aws:iam::*:role/ecs-task-execution-role",
          "arn:aws:iam::*:role/ecs-task-role",
          "arn:aws:iam::*:role/github-actions-infra",
          "arn:aws:iam::*:role/github-actions-app"
        ]
      },
      {
        Sid    = "IamOidcProvider"
        Effect = "Allow"
        Action = [
          "iam:CreateOpenIDConnectProvider",
          "iam:DeleteOpenIDConnectProvider",
          "iam:GetOpenIDConnectProvider",
          "iam:UpdateOpenIDConnectProviderThumbprint",
          "iam:TagOpenIDConnectProvider",
          "iam:ListOpenIDConnectProviders"
        ]
        Resource = "arn:aws:iam::*:oidc-provider/token.actions.githubusercontent.com"
      },
      {
        Sid      = "CallerIdentity"
        Effect   = "Allow"
        Action   = "sts:GetCallerIdentity"
        Resource = "*"
      },
      {
        Sid    = "TerraformStateBucket"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::baseball-ai-agent-tfstate-*",
          "arn:aws:s3:::baseball-ai-agent-tfstate-*/*"
        ]
      },
      {
        Sid    = "TerraformStateLock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/baseball-ai-agent-tf-lock"
      }
    ]
  })
}


# ---------------------------------------------------------
# GitHub Actions Application Role
# Used to build/push images and deploy ECS
# ---------------------------------------------------------

resource "aws_iam_role" "github_actions_app" {
  name = "github-actions-app"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }

          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:YOUR_GITHUB_USERNAME/YOUR_REPOSITORY:*"
          }
        }
      }
    ]
  })
}


# ---------------------------------------------------------
# Application Permissions
# ---------------------------------------------------------

resource "aws_iam_role_policy" "github_actions_app" {
  name = "github-actions-app-policy"
  role = aws_iam_role.github_actions_app.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [

      # ECR
      {
        Effect = "Allow"

        Action = [
          "ecr:GetAuthorizationToken"
        ]

        Resource = "*"
      },

      {
        Effect = "Allow"

        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
          "ecr:BatchGetImage"
        ]

        Resource = [
          aws_ecr_repository.frontend.arn,
          aws_ecr_repository.backend.arn
        ]
      },

      # ECS
      {
        Effect = "Allow"

        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService"
        ]

        Resource = "*"
      },

      # Required so ECS can assume these roles on behalf of a
      # newly-registered task definition revision.
      {
        Effect = "Allow"

        Action = "iam:PassRole"

        Resource = [
          aws_iam_role.ecs_task_execution_role.arn,
          aws_iam_role.ecs_task_role.arn
        ]

        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })
}