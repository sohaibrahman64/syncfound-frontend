# PayU Callback Setup (Hosted Layer -> App Deep Link)

## Why this is required
Do not set PayU `surl` / `furl` to Expo dev server URLs.
Use hosted HTTPS callback pages and redirect from those pages to app deep links.

## Hosted callback pages added in this repo
- Success page: `public/payu-success-callback.html`
- Failure page: `public/payu-failure-callback.html`

After deploying this frontend (or just these static files), your callback URLs should be:
- `https://<your-host>/payu-success-callback.html`
- `https://<your-host>/payu-failure-callback.html`

## Required backend configuration
Set backend-generated PayU payload fields (`surl`, `furl`) to the hosted callback pages above.
Do not send Expo dev server URLs in PayU payloads.

## Redirect behavior
The hosted pages:
1. Read PayU query params.
2. Build app deep links:
   - `syncfound://payment/success?...`
   - `syncfound://payment/failure?...`
3. Redirect user back into the app.

## App verification flow
Once app opens from deep link, app already:
1. Parses callback params.
2. Calls `GET /users/me/entitlements`.
3. Unlocks premium only when `tier === "premium"`.

## Params forwarded to app
- `checkout_session_id`
- `status`
- `txnid`
- `error_code`
- `error_message`

## Important note
If your PayU account posts callback form data with `POST` only and not query params, a static page cannot read request body.
In that case, use a tiny server endpoint for callback pages that:
1. Accepts PayU callback request.
2. Extracts fields server-side.
3. Redirects to `syncfound://payment/success` or `syncfound://payment/failure` with query params.
