output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = aws_lb.main.dns_name
}

output "frontend_ecr_repository_url" {
  description = "Frontend ECR repository URL"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "s3_data_bucket_name" {
  description = "S3 bucket containing baseball data"
  value       = aws_s3_bucket.baseball_data.bucket
}

output "efs_file_system_id" {
  description = "EFS file system ID"
  value       = aws_efs_file_system.main.id
}