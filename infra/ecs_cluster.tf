# ecs_cluster.tf

# ECS Cluster

resource "aws_ecs_cluster" "main" {
  name = "main-cluster"
}


# Frontend CloudWatch Log Group

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/frontend"
  retention_in_days = 7
}


# Backend CloudWatch Log Group

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/backend"
  retention_in_days = 7
}