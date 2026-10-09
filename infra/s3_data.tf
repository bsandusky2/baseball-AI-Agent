# s3_data.tf

# ---------------------------------------------------------
# S3 Bucket for Baseball Data
# Separate from the Terraform state bucket
# ---------------------------------------------------------

resource "aws_s3_bucket" "baseball_data" {
  bucket = "baseball-data-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "baseball-data"
  }
}


# ---------------------------------------------------------
# Block Public Access
# ---------------------------------------------------------

resource "aws_s3_bucket_public_access_block" "baseball_data" {
  bucket = aws_s3_bucket.baseball_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}


# ---------------------------------------------------------
# Versioning
# ---------------------------------------------------------

resource "aws_s3_bucket_versioning" "baseball_data" {
  bucket = aws_s3_bucket.baseball_data.id

  versioning_configuration {
    status = "Enabled"
  }
}


# ---------------------------------------------------------
# Server-Side Encryption
# ---------------------------------------------------------

resource "aws_s3_bucket_server_side_encryption_configuration" "baseball_data" {
  bucket = aws_s3_bucket.baseball_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}


# ---------------------------------------------------------
# Baseball DuckDB Database
# ---------------------------------------------------------

resource "aws_s3_object" "baseball_duckdb" {
  bucket = aws_s3_bucket.baseball_data.id
  key    = "data/baseball.duckdb"
  source = "${path.module}/../data/baseball.duckdb"

  etag = filemd5("${path.module}/../data/baseball.duckdb")
}


# ---------------------------------------------------------
# AWS Account ID
# Used to make the bucket name globally unique
# ---------------------------------------------------------

data "aws_caller_identity" "current" {}