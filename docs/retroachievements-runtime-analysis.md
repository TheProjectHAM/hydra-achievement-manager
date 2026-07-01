# RetroAchievements Runtime Unlock Analysis

This document summarizes the investigation of how RetroAchievements runtime unlocks work, how `rcheevos` obtains achievement triggers, what was tested in this project, and what would still be required to evaluate triggers locally.

## Context

Project HAM currently supports RetroAchievements as a read-only source. It can fetch profile data, recent games, search results, and achievement metadata/progress through the public RetroAchievements Web API.

The existing read-only integration uses endpoints such as:

```txt
https://retroachievements.org/API/API_GetUserProfile.php
https://retroachievements.org/API/API_GetUserRecentlyPlayedGames.php
https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php
https://retroachievements.org/API/API_GetGameExtended.php
```

Those endpoints are suitable for metadata and progress display, but not for runtime trigger evaluation.

## Important Finding

The public Web API exposes a `MemAddr` field for achievements, but it is masked/hash-like data, not the actual trigger expression needed by `rcheevos`.

Example from public API:

```json
{
  "MemAddr": "05f1086ba256b3a6e25bfc29287acf9c"
}
```

This is 32 hex characters and cannot be passed to `rcheevos` as a trigger definition.

The real trigger definitions are available through the runtime/client API flow used by `rcheevos`:

```txt
https://retroachievements.org/dorequest.php?r=login2
https://retroachievements.org/dorequest.php?r=patch
```

## rcheevos Flow

The upstream `rcheevos` repository was cloned and analyzed from:

```txt
https://github.com/RetroAchievements/rcheevos.git
```

Key files:

```txt
include/rc_runtime.h
include/rc_client.h
include/rc_api_runtime.h
include/rc_api_user.h
src/rcheevos/runtime.c
src/rc_client.c
src/rapi/rc_api_runtime.c
src/rapi/rc_api_user.c
```

The runtime flow is:

1. Client identifies the game by hash or game id.
2. Client logs in using `login2`.
3. Client requests patch data using `r=patch`.
4. Patch data contains achievement definitions in `MemAddr`.
5. Client activates achievements with `rc_runtime_activate_achievement` or via `rc_client`.
6. Every frame, the emulator/client calls `rc_runtime_do_frame` or `rc_client_do_frame`.
7. `rcheevos` evaluates trigger conditions by reading emulated memory through a callback.
8. When a trigger reaches `RC_TRIGGER_STATE_TRIGGERED`, an achievement event is raised.
9. `rc_client` can then call `awardachievement` to submit the unlock to RetroAchievements.

Relevant runtime event:

```c
RC_RUNTIME_EVENT_ACHIEVEMENT_TRIGGERED
```

Relevant runtime API:

```c
rc_runtime_activate_achievement(runtime, id, memaddr, ...);
rc_runtime_do_frame(runtime, event_handler, peek, userdata, ...);
```

The critical callback is:

```c
typedef uint32_t (*rc_runtime_peek_t)(uint32_t address, uint32_t num_bytes, void* ud);
```

This means local trigger evaluation requires access to the game's emulated memory.

## Difference Between Web API Key And Runtime Token

The app already stores:

```txt
retroAchievementsUsername
retroAchievementsApiKey
```

The existing `retroAchievementsApiKey` is a public Web API key. It works for the `/API/*.php` endpoints, but it does not work for `dorequest.php?r=login2` or `dorequest.php?r=patch`.

Test result with the stored Web API key:

```json
{
  "status": 401,
  "success": false,
  "error": "Invalid user/token combination."
}
```

The runtime/client API requires a runtime token returned by `login2`, or a valid token already produced by a compatible client/emulator.

## Runtime Login Test

A real runtime login was tested using `login2` with username and password.

Request type:

```txt
POST https://retroachievements.org/dorequest.php
```

Form data:

```txt
r=login2
u=<username>
p=<password>
```

Successful sanitized result:

```json
{
  "loginStatus": 200,
  "loginSuccess": true,
  "returnedUser": "estherbr",
  "hasRuntimeToken": true,
  "runtimeTokenLength": 16,
  "score": 0,
  "softcoreScore": 0
}
```

The returned runtime token was not printed and was not saved.

## Patch Data Test

After runtime login succeeded, the returned runtime token was used to request patch data:

```txt
POST https://retroachievements.org/dorequest.php
```

Form data:

```txt
r=patch
u=<username>
t=<runtime_token>
g=1
```

Successful sanitized result:

```json
{
  "gameId": 1,
  "patchStatus": 200,
  "patchSuccess": true,
  "achievementCount": 38,
  "memAddrCount": 38,
  "triggerLikeCount": 38,
  "md5LikeCount": 0
}
```

Sample sanitized trigger data:

```txt
0xS00fff9=0_0xH00ffe0=0_0xH00ffe3=0_0xH00fff0=0_...
```

This confirms that `r=patch` returns real trigger expressions when authenticated with a runtime token.

## Code Added To Project HAM

The following backend/runtime probing support was added:

```txt
src-tauri/src/integrations/retro_achievements/retro_achievements_api.rs
src-tauri/src/integrations/retro_achievements/retro_achievements_types.rs
src-tauri/src/integrations/retro_achievements/mod.rs
src-tauri/src/commands/retro_achievements.rs
src-tauri/src/lib.rs
src/tauri-api.ts
src/types.ts
```

New Rust API methods:

```rust
RetroAchievementsApi::runtime_login_with_password(username, password)
RetroAchievementsApi::runtime_login_with_token(username, token)
RetroAchievementsApi::probe_patch_data(username, runtime_token, game_id)
```

New Tauri commands:

```txt
login_retro_achievements_runtime_with_password
login_retro_achievements_runtime_with_token
probe_retro_achievements_patch_data
```

New frontend wrappers:

```ts
loginRetroAchievementsRuntimeWithPassword(username, password)
loginRetroAchievementsRuntimeWithToken(username, token)
probeRetroAchievementsPatchData(username, runtimeToken, gameId)
```

The implementation does not save passwords or runtime tokens automatically.

## Verification

Rust backend check:

```bash
cargo check
```

Result:

```txt
Finished dev profile successfully
```

Frontend build:

```bash
npm run build
```

Result:

```txt
vite build completed successfully
```

The Vite build emitted only the existing large chunk warning.

## What This Makes Possible

The project can now authenticate against the RetroAchievements runtime API and confirm whether patch data contains real trigger expressions.

This enables a future local trigger evaluation prototype using `rcheevos`.

## What Is Still Missing

Having trigger expressions is not enough to unlock or evaluate achievements accurately.

Still required:

1. Integrate `rcheevos` into the Rust/Tauri backend.
2. Compile/link the C library, likely through `cc`/`build.rs` or a safe wrapper crate.
3. Activate achievements with their real `MemAddr` expressions.
4. Provide a real memory `peek` callback.
5. Connect that callback to emulator/game memory.
6. Call the runtime every frame or at a stable polling interval.
7. Emit frontend events when local triggers fire.
8. Decide whether this remains local-only or eventually submits legitimate runtime unlocks.

The largest technical blocker is memory access. `rcheevos` expects to read console/emulator memory addresses. Project HAM is currently not an emulator and does not expose a memory map.

## Safe Implementation Recommendation

Recommended staged approach:

1. Keep RetroAchievements unlock UI read-only for now.
2. Add a developer-only runtime probe UI to validate `login2` and `patch` without saving passwords.
3. Store only runtime tokens if needed, never store raw passwords unless explicitly required and protected.
4. Integrate `rcheevos` for parse/evaluation tests using synthetic memory.
5. Only after that, explore emulator-specific memory bridges.

## Security Note

Runtime login with password should be handled carefully. Passwords should not be logged, persisted, or exposed to the frontend longer than necessary.

If a password was shared in chat or logs during testing, it should be changed afterward.

## Conclusion

The investigation confirmed that real RetroAchievements triggers are available, but only through the runtime/client API flow:

```txt
login2 -> runtime token -> patch -> real MemAddr trigger definitions
```

The public Web API remains metadata/progress-only for this purpose because its `MemAddr` values are hash-like and not usable by `rcheevos`.

Project HAM can now probe the runtime API. The next major step would be integrating `rcheevos` and providing a valid memory source for local trigger evaluation.

## Direct Award Test And Implementation

After confirming `login2` and `patch`, Project HAM also implemented the final runtime award call used by `rcheevos` after a trigger fires.

Endpoint:

```txt
POST https://retroachievements.org/dorequest.php
```

Form data:

```txt
r=awardachievement
u=<username>
t=<runtime_token>
a=<achievement_id>
h=<0_or_1>
v=<md5_signature>
```

The signature follows the `rcheevos` implementation:

```txt
md5(achievement_id + username + hardcore_flag)
```

For example, softcore unlock uses `hardcore_flag = 0`.

Added backend API:

```rust
RetroAchievementsApi::award_achievement(&RetroAchievementsAwardRequest)
```

Added Tauri command:

```txt
award_retro_achievement
```

Added frontend wrapper:

```ts
awardRetroAchievement(options)
```

### Real Award Test

A controlled softcore award test was performed for game `1`, achievement `9`.

Sanitized result:

```json
{
  "awardStatus": 200,
  "awardSuccess": true,
  "awardError": null,
  "awardedAchievementId": 9,
  "score": 0,
  "softcoreScore": 3,
  "achievementsRemaining": 34
}
```

This confirms that the server accepts `awardachievement` directly with a valid runtime token and signature.

### Project HAM UI Behavior

The app now includes a RetroAchievements runtime login in:

```txt
Settings > Connections > RetroAchievements
```

The password is used only to obtain a runtime token with `login2`; the password is not saved. The runtime token is saved locally as:

```json
"retroAchievementsRuntimeToken": "..."
```

RetroAchievements achievements are no longer read-only in the achievements page. When selected and confirmed, Project HAM calls `award_retro_achievement` for each selected achievement in softcore mode.

After unlock, the app reloads RetroAchievements progress from the Web API and updates local status.

### Limitation

This direct award flow does not evaluate `rcheevos` triggers against emulator memory. It submits the award directly using the runtime token. A full emulator-like implementation would still require `rcheevos` plus a valid memory `peek` source.
