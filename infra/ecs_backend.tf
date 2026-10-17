# ecs_backend.tf

# ---------------------------------------------------------
# ECS Backend Task Definition
# ---------------------------------------------------------

resource "aws_ecs_task_definition" "backend" {
  family                   = "backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  cpu    = "1024"
  memory = "2048"

  execution_role_arn = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn      = aws_iam_role.ecs_task_role.arn

  # -------------------------------------------------------
  # EFS Volume
  # -------------------------------------------------------

  volume {
    name = "backend-data"

    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.main.id
      transit_encryption = "ENABLED"
    }
  }

  # -------------------------------------------------------
  # Container
  # -------------------------------------------------------

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      # ---------------------------------------------------
      # Secrets
      # ---------------------------------------------------

      secrets = [
        {
          name      = "OPENAI_API_KEY"
          valueFrom = aws_ssm_parameter.openai_api_key.arn
        }
      ]

      # ---------------------------------------------------
      # EFS Mount
      # ---------------------------------------------------

      mountPoints = [
        {
          sourceVolume  = "backend-data"
          containerPath = "/usr/src/app/data"
          readOnly      = false
        }
      ]

      # ---------------------------------------------------
      # CloudWatch Logs
      # ---------------------------------------------------

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}


# ---------------------------------------------------------
# ECS Backend Service
# ---------------------------------------------------------

resource "aws_ecs_service" "backend" {
  name            = "backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn

  desired_count = 1

  launch_type = "FARGATE"

  network_configuration {
    subnets = var.private_subnet_ids

    security_groups = [
      aws_security_group.backend_sg.id
    ]

    # No NAT Gateway in this VPC — tasks run in the "private"
    # subnets (which are actually public here) and need a public
    # IP to reach ECR / the OpenAI API. Inbound access is still
    # restricted to the ALB via backend_sg.
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.http]

  # Prevent Terraform from trying to replace the service
  # during normal task-definition revisions.

  lifecycle {
    ignore_changes = [
      task_definition
    ]
  }
}