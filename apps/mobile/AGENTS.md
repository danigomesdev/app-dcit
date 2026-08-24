# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

Never put test files inside `apps/mobile/src/app/` (including a `__tests__/` subfolder there) — Expo Router treats every file under `app/` as a route, so a co-located test becomes an extra broken tab/route. Put tests for route files in the mirrored `apps/mobile/src/__tests__/app/...` tree instead.
