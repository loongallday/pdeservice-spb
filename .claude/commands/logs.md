# View Logs

View Supabase service logs for debugging.

## Usage
```
/logs <service>
```

## Examples
```
/logs api              # Edge Functions logs
/logs postgres         # Database logs
/logs auth             # Authentication logs
/logs storage          # Storage logs
/logs realtime         # Realtime logs
```

## Available Services

| Service | Description |
|---------|-------------|
| `api` | Edge Functions (most common) |
| `postgres` | Database queries and errors |
| `auth` | Authentication events |
| `storage` | File storage operations |
| `realtime` | WebSocket connections |
| `edge-function` | Alternative for Edge Functions |
| `branch-action` | Branch actions |

## MCP Command
```
mcp__supabase__get_logs({ service: "api" })
```

## Common Use Cases

### Debug Edge Function Errors
```
/logs api
```
Look for:
- Function invocation errors
- Timeout issues
- Permission errors

### Debug Database Issues
```
/logs postgres
```
Look for:
- Query errors
- RLS policy violations
- Connection issues

### Debug Authentication
```
/logs auth
```
Look for:
- Login failures
- Token issues
- User creation errors

## Local Development Logs

When running locally with `supabase functions serve`:

```bash
# Functions server output
tail -f /tmp/supabase-functions.log

# Supabase container logs
docker logs supabase_db_<project> --tail 100 -f
```

## Filtering Tips

Logs are returned for the last 24 hours. Look for:
- `error` - Error messages
- `ERROR` - Database errors
- `401`, `403` - Auth issues
- `500` - Server errors
- Function names for specific API issues

## Notes

- Logs are from remote Supabase project (not local)
- Large log volumes may be truncated
- Use timestamps to narrow down issues
