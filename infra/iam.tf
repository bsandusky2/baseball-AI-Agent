# iam.tf

# ---------------------------------------------------------
# ECS Task Execution Role
# Used by ECS/Fargate to:
# - Pull images from ECR
# - Write logs to CloudWatch
# - Retrieve secrets from SSM Parameter Store
# ---------------------------------------------------------

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}


# ---------------------------------------------------------
# ECS Task Execution Role Policy
# ---------------------------------------------------------

resource "aws_iam_role_policy" "ecs_task_execution_policy" {
  name = "ecs-task-execution-policy"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      # ECR
      {
        Effect = "Allow"

        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]

        Resource = "*"
      },

      # CloudWatch Logs
      {
        Effect = "Allow"

        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]

        Resource = [
          "${aws_cloudwatch_log_group.frontend.arn}:*",
          "${aws_cloudwatch_log_group.backend.arn}:*"
        ]
      },

      # SSM Parameter Store
      {
        Effect = "Allow"

        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]

        Resource = [
          aws_ssm_parameter.openai_api_key.arn
        ]
      }
    ]
  })
}


# ---------------------------------------------------------
# ECS Task Role
# Used by the application running inside the container
# ---------------------------------------------------------

resource "aws_iam_role" "ecs_task_role" {
  name = "ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}


# ---------------------------------------------------------
# ECS Task Role Policy
# Allows the backend to access the EFS access point
# ---------------------------------------------------------

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite"
        ]

        Resource = aws_efs_file_system.main.arn
      },

      # Lets the backend (re)load baseball.duckdb from S3 onto the
      # EFS volume it mounts at /usr/src/app/data.
      {
        Effect = "Allow"

        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]

        Resource = [
          aws_s3_bucket.baseball_data.arn,
          "${aws_s3_bucket.baseball_data.arn}/*"
        ]
      }
    ]
  })
}