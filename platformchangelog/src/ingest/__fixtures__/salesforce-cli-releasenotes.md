# Salesforce CLI Release Notes

## 2.154.4 (October 14, 2026) [stable-rc]

These changes are in the Salesforce CLI release candidate. We plan to include these changes in next week's official release. This list isn't final and is subject to change.

------------

* NEW: See which Apex classes in your org are invalid or have compilation warnings with the new `apex get compile-status` command. For example:

    ```bash
    sf apex get compile-status --target-org my-org
    ```

    (plugin-apex PR [977](https://github.com/salesforcecli/plugin-apex/pull/977))

## 2.153.5 (October 7, 2026) [stable]

* NEW: Manage Apex debug log trace flags in your org with these new `apex trace` commands:

    * `apex trace create` : Create a trace flag for a user, Apex class, or Apex trigger.
    * `apex trace delete` : Delete a trace flag in your org.
    * `apex trace list` : List trace flags in your org.

     A trace flag sets the debug log level and duration for a specific entity, so you capture the logs you need without changing org-wide settings.  After creating the trace flag, perform the activity you want to debug and then use the `apex log` commands to get the debug logs. For example:
  
    ```bash
    # Create a trace flag for a user with a custom duration and log type
    sf apex trace create --traced-entity-id 005xx000001Sv6DAAS --debug-level SFDC_DevConsole --duration 60 --log-type USER_DEBUG --target-org my-org

	# List all trace flags in the org
    sf apex trace list --target-org my-org

    # Delete a trace flag by ID
    sf apex trace delete --trace-flag-id 7tfxx0000000001AAA --target-org my-org
    ```

    (plugin-apex PR [970](https://github.com/salesforcecli/plugin-apex/pull/970), plugin-apex PR [973](https://github.com/salesforcecli/plugin-apex/pull/973))

* CHANGE: Salesforce CLI no longer suggests the `SF_TEMP_SHOW_SECRETS` environment variable as a workaround for viewing redacted secrets, and now announces that this workaround will be removed on October 28, 2026. Commands such as `org display user` and `org list users` now point you to the `sf org auth show-*` commands instead. The `SF_TEMP_SHOW_SECRETS=true` workaround still works until the removal date, so existing CI jobs won't break. For example:

    ```bash
    # Instead of setting SF_TEMP_SHOW_SECRETS=true, use the dedicated command
    sf org auth show-access-token --target-org my-org
    ```

    See [this announcement](https://github.com/forcedotcom/cli/issues/3658) for more information.
  
    (GitHub Issue [#3560](https://github.com/forcedotcom/cli/issues/3560), plugin-user PR [1527](https://github.com/salesforcecli/plugin-user/pull/1527), plugin-org PR [1782](https://github.com/salesforcecli/plugin-org/pull/1782), plugin-auth PR [1550](https://github.com/salesforcecli/plugin-auth/pull/1550))

* FIX: Logging in with `sf org login web` on Linux no longer intermittently fails due to a race condition when opening the browser. (plugin-auth PR [1549](https://github.com/salesforcecli/plugin-auth/pull/1549))

## 2.152.14 (September 30, 2026)

* NEW: The `apex run` command has two new flags for controlling the debug log level when you execute anonymous Apex. Use `--debug-level` to set a predefined level (`NONE`, `DEBUGONLY`, `DB`, `PROFILING`, `CALLOUT`, or `DETAIL`), or `--category-level` for fine-grained, per-category control (the two flags are mutually exclusive). For example:

    ```bash
    # Set a predefined debug log level
    sf apex run --file test.apex --debug-level DETAIL

    # Or set individual category levels (repeatable)
    sf apex run --file test.apex --category-level Apex_code=FINEST --category-level Db=FINE
    ```

    (plugin-apex PR [967](https://github.com/salesforcecli/plugin-apex/pull/967), salesforcedx-apex PR [684](https://github.com/forcedotcom/salesforcedx-apex/pull/684))

* CHANGE: We removed the Hyperforce/JWT gate that blocked `sf org create user` on Hyperforce orgs when the Dev Hub used JWT authentication. The underlying platform issue is now resolved, so this command works in that scenario. For example:

    ```bash
    # Now succeeds on a Hyperforce scratch org authenticated with JWT (previously blocked)
    sf org create user --definition-file config/user-def.json --target-org my-scratch-org
    ```

    (plugin-user PR [1509](https://github.com/salesforcecli/plugin-user/pull/1509))

* FIX: The `sf org open` command no longer exits before the browser finishes launching, which caused intermittent failures, especially on Windows and in the VS Code integrated terminal. (GitHub Issue [#3646](https://github.com/forcedotcom/cli/issues/3646), plugin-org PR [1775](https://github.com/salesforcecli/plugin-org/pull/1775))

* FIX: We fixed a broken `sf-trust` bin path in `@salesforce/plugin-trust` that pointed at an unpublished `bin/dev` file, which silently skipped the bin link and broke `npm install`. It now points at the published `bin/run.js`. (GitHub Issue [#3644](https://github.com/forcedotcom/cli/issues/3644), plugin-trust PR [1347](https://github.com/salesforcecli/plugin-trust/pull/1347))

* FIX: We addressed an issue where the published `npm-shrinkwrap.json` pinned a version of `npm` that bundled a vulnerable version of `tar`. We bumped the pinned `npm` version to pull in a patched `tar`. (GitHub Issue [#3642](https://github.com/forcedotcom/cli/issues/3642), plugin-trust PR [1347](https://github.com/salesforcecli/plugin-trust/pull/1347))

* FIX: Salesforce DX projects now support the ReferralIntakeConfiguration [metadata type](https://github.com/forcedotcom/source-deploy-retrieve/blob/main/src/registry/metadataRegistry.json).
 
## 2.151.7 (Sept 23, 2026)

* NEW: When you run project deploy start, any notification attached to the deployment now appears in both the JSON and the human-readable table output; previously, notifications were included only in the JSON output. Notifications are informational, non-blocking, deploy-level advisories represented by the DeployNotification metadata type—for example, ApexApiVersionRetirement. There's no new flag to enable this behavior; the human-readable output includes notifications by default. For example:

    ```bash
    sf project deploy start --metadata ApexClass:MyRetiringApiClass --target-org my-org
    ```

    (plugin-deploy-retrieve PR [1630](https://github.com/salesforcecli/plugin-deploy-retrieve/pull/1630), source-deploy-retrieve PR [1825](https://github.com/forcedotcom/source-deploy-retrieve/pull/1825))

* NEW: Salesforce CLI now supports Refresh Token Rotation (RTR). When your connected app has RTR enabled, the CLI persists the server-rotated refresh token and handles concurrent token refreshes safely, so simultaneous commands no longer fail with "Token request is already being processed". No new flags are required; the behavior is automatic. (sfdx-core PR [1342](https://github.com/forcedotcom/sfdx-core/pull/1342))

* FIX, with NEW feature: We significantly sped up `sf org login jwt` for users with many cached org authorizations. The post-login scratch-org identification check now exits early on the first match, scans auth files in a single pass, and short-circuits sandbox lookups by URL. You can also skip the check entirely in CI/CD by setting the new `SF_SKIP_SCRATCH_ORG_CHECK` environment variable. (GitHub Issue [#3626](https://github.com/forcedotcom/cli/issues/3626), sfdx-core PR [1336](https://github.com/forcedotcom/sfdx-core/pull/1336))

* FIX: The `plugins install`, `plugins uninstall`, and `plugins update` commands no longer fail on Windows with a misleading `<package> does not exist in the registry` error when Node.js is installed at the default path containing a space (such as `C:\Program Files\nodejs\node.exe`). (GitHub Issue [#1387](https://github.com/oclif/plugin-plugins/issues/1387), plugin-plugins PR [1388](https://github.com/oclif/plugin-plugins/pull/1388))

* FIX: The `project retrieve preview` command no longer reports hundreds of unrelated, false-positive metadata diffs after you edit only the CSS resource of an Aura component through the Setup UI or Developer Console. A long-lived process (such as the VS Code Salesforce Extension) holding a stale in-memory source-tracking cache could overwrite the CLI's correctly synced revision data in `maxRevision.json`. (GitHub Issue [#3612](https://github.com/forcedotcom/cli/issues/3612), source-tracking PR [877](https://github.com/forcedotcom/source-tracking/pull/877))

* FIX: The `project deploy start` and `project retrieve start` commands now correctly handle `AiAgentDefinitionVersion` metadata, which uses `#` as a version separator in its fullName (such as `MyAgent#1`). Previously, the `#` character was incorrectly interpreted as a key delimiter, which caused deploy messages to be unmapped and retrieves to fail. (source-deploy-retrieve PR [1826](https://github.com/forcedotcom/source-deploy-retrieve/pull/1826))

* FIX: The `plugins install`, `plugins link`, and other commands that spawn child processes no longer fail with `ENOENT` when Salesforce CLI was installed from a standalone tarball on Unix. The fix ensures the CLI uses the bundled Node.js binary rather than searching `PATH` for a system-level `node`. (GitHub Issue [#1293](https://github.com/oclif/plugin-plugins/issues/1293), plugin-plugins PR [1383](https://github.com/oclif/plugin-plugins/pull/1383))

