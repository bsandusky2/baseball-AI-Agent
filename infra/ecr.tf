# ecr.tf

# Frontend ECR Repository

resource "aws_ecr_repository" "frontend" {
  name                 = "frontend"
  image_scanning_configuration {
    scan_on_push = true
  }

  image_tag_mutability = "MUTABLE"
}


# Backend ECR Repository

resource "aws_ecr_repository" "backend" {
  name                 = "backend"
  image_scanning_configuration {
    scan_on_push = true
  }

  image_tag_mutability = "MUTABLE"
}


# Frontend Lifecycle Policy
# Keep only the 10 most recent images

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1

        description = "Keep only the 10 most recent images"

        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }

        action = {
          type = "expire"
        }
      }
    ]
  })
}


# Backend Lifecycle Policy
# Keep only the 10 most recent images

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1

        description = "Keep only the 10 most recent images"

        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }

        action = {
          type = "expire"
        }
      }
    ]
  })
}