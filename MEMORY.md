# Current work — unified UI, 29 October 2026

The user rejected the separate-window service forms and explicitly requested a systematic whole-module UX. Follow docs/UI_SYSTEM.md and docs/UI_SCREEN_MIGRATION.md before more implementation. No scope restart, no approval between batches. Existing 125-decision assessment remains the feature backlog; all-complete/readiness claims remain withdrawn.

Current source version 1.14.0-dev. One actual ApplicationV2 host (workspace-shell.mjs) hosts all bootstrap-composed Easy Plots panels. GM navigation Campaign/Plot editor/Session/Review/World/Settings; player navigation Quests/Investigations/Known world/Journal/Notifications. Settings and toolbar reuse the host. Background panel completion cannot steal navigation or reopen a closed host. Role/user-bound panels cannot render for a different identity.

Core guided editor is implemented atop existing GraphEditorModel: labelled title saved directly, readable nodes/ports, searchable labelled library, start choice, typed object fields, simple typed comparison builder, connections, check/save/publish/activate. Advanced editor retained in-place. Pending inputs survive navigation; cross-plot opens and scene focus refuse to lose edits. Draft browsing bug fixed by omitting undefined optional cursor/limit; strict JSON command validation remains intact. Player notices are inline and incoming notices no longer force a popup/navigation. GM encrypted vault semantics unchanged.

Verification on current source: 1184 actual Node tests PASS, 0 fail/skip; 224 source modules syntax PASS; composed UX browser PASS including persistence, publication/activation, edit retention, one host, 360px scrolling and player isolation; advanced/global browser PASS; launcher browser PASS; bounded Home browser PASS. Spec/schema/TypeScript/coverage inventory PASS. Exact evidence docs/UI_VALIDATION_v1.14.json and versioned logs. No real Foundry-server/world acceptance. Actual module DOM screenshots docs/design/implemented-v1.14 (synthetic Foundry adapters), unlike older prototype images.

The whole UI is NOT complete: session/review/world-content desks are only hosted, still technical; dedicated guided tasks/entity selectors/compound rules remain. Player discovery and catalog restoration, participant bindings, voting submission and generic approved-intent execution remain feature gaps. Next implementation stage is systematic Session/Review task forms in UI_SCREEN_MIGRATION.md, together with their prerequisites, then World content and Settings/recovery; do not jump to unrelated service batches or count hosted forms as redesigned. Preserve old tags. Prior GitHub push/prerelease authorization persists. Standard module.json custom-hosting URLs follow user convention, but external hosting has not been uploaded.

Publishing 1.14.0-dev as a scoped UI foundation build; root must finish package verification/push/release and record actual result. GitHub API auth works; uploads.github.com failed401 in earlier session. Use Git-tracked release ZIP mirror if the supported upload remains unavailable; never extract credentials or mutate old release tags.

# Historical handovers below (superseded by the current entry)

# Current work —29October2026

User changed priority after full assessment: finish startup/initiation +GM workspace +GM Plot Editor +player workspace first; then systematic backlog. Main module remains incomplete. Do not repeatreadyforall125claim. Work order: docs/WORK_ORDER.md;125rowassessment remainsdocs/assessment/2026-10-29/.

Current patch1.13.1-dev wires role-aware toolbar/ModuleSettings, real GM plot list/editor, player owned-character workspace and setup-aware scrollingHome. FoundryWorldSetup +WorldSetupWindow create/unlock an AES-GCM native vault; native-pack verifies WeakSet-branded encrypted wrapper instead of forged privacy attestations. No passphrase storedserver-side. Reloadrequiresunlock andretainsnativeplots. Tests prove encrypted persisted graph save/reconstruct, wrongkey,tamper,AAD/chunk-failure/roleloss. Browser actualbootstrap→setup→save→reopen→playeremptyworkspacePASS. Final current fullsuite1181PASS/0fail/skip; startupbrowserPASS, HomeboundedscrollPASS andglobaleditorbrowserPASS; specPASS. No sourcechangesafter finalrun. Packaging/publishingexplicitlimitedUIpatchnext; automaticplayerdiscovery remainsopen.

Playerworkspace currentlyhas ownedcharacter/tabs/notifications andcacheofloadedapprovedviews; automaticsharing/discovery stillmissing. Item7workordernext. WorldParticipants andWorldSetupVerification areunuseddraftsnotconfiguredcapabilities; do notenablebysyntheticproof. No finalnativeFoundryworldcertification. Rootmustfinishlogs/fullcheck andpublishexplicitlyscopedUIpatch, notcompleteproductrelease.

Do notaskuserforapprovalbetweenbatches. Prior authorizationincludesGitHubpush+prereleaseassets. Repo main remoteGitHubSomel1978/easy-plots; networkapi/uploads nowallowed. Preserveuserrequestedmodulemetadataconvention; externalhostingURLsnotuploaded. No requiredexternalbackend. Proposed screenshots docs/design are notactualproductcontent. Codeinthispatchusesrealempty/savedworlddata,no samples.

# Current authoritative state —29 October2026

The project is INCOMPLETE. User installedv1.13.0-dev and reported no launcher/settings, temporary-only storage, protected-service errors and no Status scrolling. Prior claim ready-for-Foundry-testflight was wrong. A complete scope/code assessment is in docs/assessment/2026-10-29/README.md, with125 per-decision records and28 requirement groups. Read it before implementation.

Shipped baseline commit2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a, tagv1.13.0-dev. Working1.13.1-dev is UNPUBLISHED and incomplete. It contains launcher/home/participants changes and untested/unintegrated world-setup/vault drafts. Audit snapshots are in /tmp/easy-plots-assessment, hashes in assessment/BASELINES.json. No new module release was published.

Implementation is PAUSED at the user's request for full assessment. Do not continue adding code, refresh oldclosuregreenclaims or release drafts until the assessment has been delivered and the user steers subsequent work. The six assessment subagents hit usage limits; their early findings were incorporated, but no completed independent agent reports are claimed. The root produced the125-row assessment and validated its source/case references.

Actual missing features include player vote submission, generic approved-intent execution, user-facing rule builder, guided rebind workflow, application migrations/recovery and usable fresh-world persistence/setup. Service code remains substantial; it is not equivalent to complete user workflows. Prior1,147-case suite is historical shipped local evidence, not native/product certification. Frozen working recheck27pass/1fail outof28.

Proposed GM/player designs in docs/design are sample-data previews, not implemented screens. Full original Q1–112 wording unavailable; condensed register+transfer are scopebasis,97 candidateinterfaces are proposed and not extrauserrequirements. Userrequiresonecomplete125-decision nativeFoundry14+ module, no externalbackend; no permissionbetweenbatches. No completionpercent/hour estimate supported.
