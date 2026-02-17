# How to Get D-ID Avatar IDs

## The Error You're Seeing

```
❌ D-ID request failed: D-ID Expressives API error (404): {"kind":"NotFoundError","description":"Avatar not found"}
```

This means the default avatar IDs in the code don't exist in your D-ID account.

---

## Quick Fix: Use Clips API Only (Works Immediately)

The **Clips API** uses public presenters that work without configuration. To use it:

1. In the video modal, select **"Full-HD (Clips)"** instead of "Expressive (V4)"
2. This will work immediately with the default presenter IDs

---

## Permanent Fix: Get Your Avatar IDs

### For Clips API (Full-HD)

1. Go to https://studio.d-id.com/
2. Navigate to **Clips** section
3. Call the API to list available presenters:

```bash
curl -X GET "https://api.d-id.com/clips/presenters" \
  -H "Authorization: Basic YOUR_DID_API_KEY"
```

4. You'll get a response like:
```json
{
  "presenters": [
    {
      "presenter_id": "v2_public_Amber@0zSz8kflCN",
      "presenter_name": "Amber",
      "gender": "female"
    },
    {
      "presenter_id": "v2_public_Adam@0GLJgELXjc",
      "presenter_name": "Adam",
      "gender": "male"
    }
  ]
}
```

5. Add these to your `.env` file:
```bash
DID_CLIPS_PROFESSIONAL=v2_public_Amber@0zSz8kflCN
DID_CLIPS_CASUAL=v2_public_Adam@0GLJgELXjc
# ... add more as needed
```

---

### For Expressives API (V4 with Emotions)

1. Go to https://studio.d-id.com/
2. Navigate to **Expressives** section
3. Call the API to list available avatars:

```bash
curl -X GET "https://api.d-id.com/expressives/avatars" \
  -H "Authorization: Basic YOUR_DID_API_KEY"
```

4. You'll get a response like:
```json
{
  "avatars": [
    {
      "avatar_id": "public_amber_casual@avt_ABC123",
      "avatar_name": "Amber Casual",
      "sentiments": [
        {
          "sentiment_id": "snt_professional",
          "sentiment_name": "Professional"
        },
        {
          "sentiment_id": "snt_friendly",
          "sentiment_name": "Friendly"
        }
      ]
    }
  ]
}
```

5. Add these to your `.env` file:
```bash
DID_EXPRESSIVE_PROFESSIONAL=public_amber_casual@avt_ABC123
DID_EXPRESSIVE_CASUAL=public_amber_casual@avt_ABC123
# ... add more as needed
```

---

## Using cURL with Your API Key

Replace `YOUR_DID_API_KEY` with your actual key from the `.env` file:

```bash
# On Windows PowerShell
$env:DID_KEY = "your_actual_key_here"

# List Clips presenters
curl -X GET "https://api.d-id.com/clips/presenters" `
  -H "Authorization: Basic $env:DID_KEY"

# List Expressives avatars
curl -X GET "https://api.d-id.com/expressives/avatars" `
  -H "Authorization: Basic $env:DID_KEY"
```

---

## Alternative: Use D-ID Studio UI

1. Go to https://studio.d-id.com/
2. Log in with your account
3. Browse the **Clips** or **Expressives** sections
4. Click on any avatar to see its ID in the URL or details panel
5. Copy the IDs and add them to your `.env` file

---

## Update Your .env File

Once you have the correct IDs, update your `.env`:

```bash
# Clips API (Full-HD) - These usually work by default
DID_CLIPS_PROFESSIONAL=v2_public_Amber@0zSz8kflCN
DID_CLIPS_CASUAL=v2_public_Adam@0GLJgELXjc

# Expressives API (V4) - Replace with your actual avatar IDs
DID_EXPRESSIVE_PROFESSIONAL=your_actual_avatar_id_here
DID_EXPRESSIVE_CASUAL=your_actual_avatar_id_here
DID_EXPRESSIVE_CARTOON=your_actual_avatar_id_here
DID_EXPRESSIVE_ANIME=your_actual_avatar_id_here
DID_EXPRESSIVE_REALISTIC=your_actual_avatar_id_here
DID_EXPRESSIVE_MINIMAL=your_actual_avatar_id_here
```

Then restart the server:
```bash
npm run dev
```

---

## Testing

1. **Test Clips API first** - Should work with default IDs
2. **Test Expressives API** - Only after adding correct avatar IDs to `.env`

---

## Common Issues

**"Avatar not found" error**
- Avatar ID doesn't exist in your D-ID account
- Check the API response for available IDs

**"Sentiment not found" error**
- The avatar doesn't support that sentiment
- Check the avatar's `sentiments` array in the API response

**"Unauthorized" error**
- Check your `DID_API_KEY` in `.env`
- Make sure it's a valid D-ID API key

---

## Need Help?

Check the D-ID documentation:
- Clips API: https://docs.d-id.com/reference/clips
- Expressives API: https://docs.d-id.com/reference/expressives
