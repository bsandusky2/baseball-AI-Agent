terraform {
  backend "s3" {
    bucket         = "baseball-ai-agent-tfstate-147692974185"
    key            = "baseball-agent/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "baseball-ai-agent-tf-lock"
    encrypt        = true
  }
}