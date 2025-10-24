# send-user-email

Send emails via Gmail API using connected user mail identities.

## Features

- Authentication required
- Input validation with Zod
- Automatic access token refresh
- RFC822 email formatting with MIME multipart
- Support for text/plain and text/html bodies
- File attachments with size limits
- Email logging to database

## Request Payload

```json
{
  "from_email": "user@example.com",
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "subject": "Hello from Virgilio",
  "body_text": "This is the plain text version of the email.",
  "body_html": "<p>This is the <strong>HTML</strong> version of the email.</p>",
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "BASE64_ENCODED_CONTENT_HERE",
      "content_type": "application/pdf"
    }
  ],
  "candidate_id": "optional-uuid",
  "job_id": "optional-uuid"
}
```

## Validation Rules

- `from_email`: Must be an email address connected to the user's account
- `to`: Required, array of email addresses (min 1)
- `subject`: Required, max 998 characters
- `attachments`: Optional, max 10MB per file, 25MB total

## cURL Example

```bash
curl -X POST \
  https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/send-user-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "sender@example.com",
    "to": ["recipient@example.com"],
    "subject": "Test Email",
    "body_html": "<h1>Hello!</h1><p>This is a test email.</p>"
  }'
```

## Response

```json
{
  "success": true,
  "message_id": "18d4f5e6a7b8c9d0",
  "thread_id": "18d4f5e6a7b8c9d0",
  "log_id": "uuid-of-email-log-record"
}
```

## Error Responses

- `400`: Invalid request (Zod validation errors)
- `401`: Unauthorized (missing/invalid JWT)
- `403`: From email not connected to user
- `500`: Internal server error
