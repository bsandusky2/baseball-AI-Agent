# secrets.tf

# ---------------------------------------------------------
# OpenAI API Key
# ---------------------------------------------------------

resource "aws_ssm_parameter" "openai_api_key" {
  name        = "/baseball-agent/openai-api-key"
  description = "OpenAI API key for the baseball AI agent"

  type  = "SecureString"
  value = "PLACEHOLDER"

  lifecycle {
    ignore_changes = [
      value
    ]
  }

  tags = {
    Name = "baseball-agent-openai-api-key"
  }
}

