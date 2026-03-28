terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment after first apply to migrate state to S3:
  # backend "s3" {
  #   bucket  = "ok-factory-tfstate"
  #   key     = "terraform.tfstate"
  #   region  = "eu-west-2"
  #   encrypt = true
  # }
}

# ── Providers ──────────────────────────────────────────────────
provider "aws" {
  region = var.aws_region
}

# ACM certs for CloudFront MUST be in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ── Variables ──────────────────────────────────────────────────
variable "aws_region" {
  default = "eu-west-2"
}

variable "domain_name" {
  default = "okfactory.live"
}

variable "bucket_name" {
  default = "okfactory-live-site"
}

# ── S3 Bucket (private, served via CloudFront OAC) ────────────
resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
        }
      }
    }]
  })
}

# ── ACM Certificate (us-east-1 for CloudFront) ────────────────
resource "aws_acm_certificate" "site" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ── ACM Validation (waits for DNS validation in Namecheap) ────
resource "aws_acm_certificate_validation" "site" {
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.site.arn

  # This will block until you add the CNAME record in Namecheap.
  # Run `terraform output acm_validation_records` to see what to add.
  # Terraform will poll every 10s until the cert is validated (~5 min after DNS update).
}

# ── CloudFront OAC ────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront Distribution ───────────────────────────────────
resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = "PriceClass_100" # US + EU only (cheapest)

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600    # 1 hour
    max_ttl     = 86400   # 1 day
  }

  # Custom error: serve index.html for 404 (SPA-style, future-proof)
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Project = "ok-factory"
  }
}

# ── Outputs ───────────────────────────────────────────────────
output "cloudfront_domain" {
  description = "Add a CNAME in Namecheap: okfactory.live → this value"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "Used by GitHub Actions to invalidate cache"
  value       = aws_cloudfront_distribution.site.id
}

output "s3_bucket" {
  value = aws_s3_bucket.site.bucket
}

output "acm_validation_records" {
  description = "Add these DNS records in Namecheap to validate the SSL cert"
  value = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
      type  = dvo.resource_record_type
      name  = dvo.resource_record_name
      value = dvo.resource_record_value
    }
  }
}
