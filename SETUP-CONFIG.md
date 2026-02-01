# Anchor Deploy Configuration

Generated: Mon  2 Feb 2026 02:18:19 +07
Stage: dev
Region: ap-southeast-1
AWS Account: 775039091390

## Secrets (Keep These Safe!)

```
AUTH_SECRET=XtfQ26qq4qnLoFwm/bl4fdTXzdEd9YBd7zzsyhttJBg=
GITHUB_WEBHOOK_SECRET=2b8ff2401f0d093bda115275dfacbfa8c8f4249b0a285aaa65a7489d103e2787
```

## AWS Resources

After deployment, run `npx sst output --stage dev` to see:
- Webhook URL (for GitHub)
- API Gateway URL (for dashboard)
- CloudFront URL (for deployed sites)

## Dashboard Configuration

File: `dashboard/.env.local`

Update `API_GATEWAY_URL` with the actual value from SST outputs.

## GitHub Webhook Configuration

1. Go to your GitHub repository → Settings → Webhooks
2. Add webhook:
   - Payload URL: `<Webhook URL from SST outputs>`
   - Content type: `application/json`
   - Secret: `2b8ff2401f0d093bda115275dfacbfa8c8f4249b0a285aaa65a7489d103e2787`
   - Events: Just the push event

## Next Steps

1. Create admin user:
   ```bash
   ./create-admin-user.sh admin@example.com YourSecurePassword
   ```

2. Start the dashboard:
   ```bash
   cd dashboard
   npm run dev
   ```

3. Log in and add your first site

4. Configure GitHub webhook on your repository

5. Push to main branch to trigger first deployment
