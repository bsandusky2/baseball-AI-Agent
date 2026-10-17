# security_groups.tf

# ALB Security Group
# HTTP 80 from anywhere

resource "aws_security_group" "alb_sg" {
  name        = "alb-sg"
  description = "Security group for ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


# Backend Security Group
# Port 8000 only from ALB

resource "aws_security_group" "backend_sg" {
  name        = "backend-sg"
  description = "Security group for backend"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Backend traffic from ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


# Frontend Security Group
# Port 3000 only from ALB

resource "aws_security_group" "frontend_sg" {
  name        = "frontend-sg"
  description = "Security group for frontend"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Frontend traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


# EFS Security Group
# NFS 2049 only from backend

resource "aws_security_group" "efs_sg" {
  name        = "efs-sg"
  description = "Security group for EFS"
  vpc_id      = var.vpc_id

  ingress {
    description     = "NFS from backend"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}