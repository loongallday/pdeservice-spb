# Deploy Edge Function

Deploy a Supabase Edge Function to production.

## Usage
```
/deploy <function-name>
```

## Examples
```
/deploy api-tickets
/deploy api-employees
/deploy all
```

## What it does
1. Validates the function exists
2. Deploys to project `ogzyihacqbasolfxymgo`
3. Uses `--no-verify-jwt` flag
4. Reports success/failure

## Command
```bash
npx supabase functions deploy $FUNCTION_NAME --no-verify-jwt --project-ref ogzyihacqbasolfxymgo
```
