# efs.tf

# ---------------------------------------------------------
# EFS File System
# ---------------------------------------------------------

resource "aws_efs_file_system" "main" {
  creation_token = "main-efs"

  encrypted = true

  tags = {
    Name = "main-efs"
  }
}


# ---------------------------------------------------------
# EFS Mount Target - Subnet 1
# ---------------------------------------------------------

resource "aws_efs_mount_target" "subnet_1" {
  file_system_id  = aws_efs_file_system.main.id
  subnet_id       = var.private_subnet_ids[0]
  security_groups = [aws_security_group.efs_sg.id]
}


# ---------------------------------------------------------
# EFS Mount Target - Subnet 2
# ---------------------------------------------------------

resource "aws_efs_mount_target" "subnet_2" {
  file_system_id  = aws_efs_file_system.main.id
  subnet_id       = var.private_subnet_ids[1]
  security_groups = [aws_security_group.efs_sg.id]
}


# ---------------------------------------------------------
# EFS Access Point
# ---------------------------------------------------------

resource "aws_efs_access_point" "backend" {
  file_system_id = aws_efs_file_system.main.id

  posix_user {
    uid = 1000
    gid = 1000
  }

  root_directory {
    path = "/backend"

    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "0755"
    }
  }

  tags = {
    Name = "backend-access-point"
  }
}