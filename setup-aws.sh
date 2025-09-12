#!/bin/bash

# AWS S3 Setup Script for Shared Notes Web
# This script creates and configures an S3 bucket for static website hosting

set -e

# Configuration variables
BUCKET_NAME="shared-notes-web"
AWS_REGION="eu-central-1"
PROFILE="rabbagliettiandrea"

echo "🚀 Setting up AWS S3 bucket for Shared Notes Web"
echo "📦 Bucket name: $BUCKET_NAME"
echo "🌍 Region: $AWS_REGION"
echo "👤 AWS Profile: $PROFILE"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity --profile "$PROFILE" &> /dev/null; then
    echo "❌ AWS credentials not configured for profile '$PROFILE'"
    echo "   Run: aws configure --profile $PROFILE"
    exit 1
fi

echo "✅ AWS credentials verified"
echo ""

# Create S3 bucket
echo "📦 Creating S3 bucket..."
if aws s3 ls "s3://$BUCKET_NAME" --profile "$PROFILE" 2>/dev/null; then
    echo "⚠️  Bucket $BUCKET_NAME already exists"
else
    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3 mb "s3://$BUCKET_NAME" --profile "$PROFILE"
    else
        aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" --profile "$PROFILE"
    fi
    echo "✅ Bucket $BUCKET_NAME created successfully"
fi

# Configure bucket for static website hosting
echo "🌐 Configuring bucket for static website hosting..."
aws s3 website "s3://$BUCKET_NAME" \
    --index-document index.html \
    --error-document index.html \
    --profile "$PROFILE"

# Set bucket policy for public read access
echo "🔓 Setting bucket policy for public read access..."
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy \
    --bucket "$BUCKET_NAME" \
    --policy file://bucket-policy.json \
    --profile "$PROFILE"

rm bucket-policy.json
echo "✅ Bucket policy configured"

# Block public access settings (override default)
echo "🔧 Configuring public access settings..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    --profile "$PROFILE"

echo "✅ Public access settings configured"

# Wait a moment for settings to propagate
echo "⏳ Waiting for settings to propagate..."
sleep 5

# Upload a test file
echo "📤 Uploading test files..."
echo "<!DOCTYPE html><html><head><title>Shared Notes Web</title></head><body><h1>Deployment successful!</h1><p>Your Shared Notes Web application is ready to be deployed.</p></body></html>" > test.html
aws s3 cp test.html "s3://$BUCKET_NAME/" --profile "$PROFILE"
rm test.html

# Test public access
echo "🧪 Testing public access..."
WEBSITE_URL="http://$BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
if curl -s -o /dev/null -w "%{http_code}" "$WEBSITE_URL" | grep -q "200"; then
    echo "✅ Public access working correctly"
else
    echo "⚠️  Public access might need a moment to propagate"
    echo "   Try accessing: $WEBSITE_URL in a few minutes"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Add these secrets to your GitHub repository:"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - AWS_REGION: $AWS_REGION"
echo "   - S3_BUCKET_NAME: $BUCKET_NAME"
echo ""
echo "2. Optional - Add CloudFront secrets:"
echo "   - CLOUDFRONT_DISTRIBUTION_ID (after creating CloudFront distribution)"
echo "   - CLOUDFRONT_DOMAIN (your CloudFront domain)"
echo ""
echo "3. Push your code to trigger the deployment"
echo ""
echo "🌐 Website URL: http://$BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
echo "🔗 GitHub Secrets Setup:"
echo "   Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
echo ""
echo "📚 For CloudFront setup, run:"
echo "   aws cloudfront create-distribution --distribution-config file://cloudfront-config.json --profile $PROFILE"
