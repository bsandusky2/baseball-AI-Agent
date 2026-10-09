# alb.tf

# ---------------------------------------------------------
# Application Load Balancer
# ---------------------------------------------------------

resource "aws_lb" "main" {
  name               = "main-alb"
  internal           = false
  load_balancer_type = "application"

  security_groups = [
    aws_security_group.alb_sg.id
  ]

  subnets = var.public_subnet_ids

  tags = {
    Name = "main-alb"
  }
}


# ---------------------------------------------------------
# Backend Target Group
# ---------------------------------------------------------

resource "aws_lb_target_group" "backend" {
  name        = "backend-tg"
  port        = 8000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled  = true
    path     = "/health"
    protocol = "HTTP"
    port     = "8000"

    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }

  tags = {
    Name = "backend-tg"
  }
}


# ---------------------------------------------------------
# Frontend Target Group
# ---------------------------------------------------------

resource "aws_lb_target_group" "frontend" {
  name        = "frontend-tg"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled  = true
    path     = "/"
    protocol = "HTTP"
    port     = "3000"

    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }

  tags = {
    Name = "frontend-tg"
  }
}


# ---------------------------------------------------------
# ALB Listener
# Port 80
# Default -> Frontend
# ---------------------------------------------------------

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}


# ---------------------------------------------------------
# Backend Routing Rule
# /api/* -> Backend
# ---------------------------------------------------------

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}