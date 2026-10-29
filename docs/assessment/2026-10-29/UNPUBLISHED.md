# Unpublished working changes at the audit freeze

None of these changes is in the shipped v1.13.0-dev tag. The working manifest says1.13.1-dev; that is not a released/accepted patch.

| Change | Exact status at freeze |
|---|---|
| Toolbar/Module Settings launcher | New helper/bootstrap registration;4 Node cases and an earlier isolated Chromium launch check passed. Not shipped. |
| Home availability/scrolling | New Home/CSS and4 Node cases; focused bounded-window Chromium check passed. Bootstrap still does not provide its new openSetup/getSetupState callbacks, so its setup action is unavailable. |
| World participant bindings | New service/desk;11 focused cases passed. Not composed in bootstrap/native integration. |
| World setup verification | New direct-denial synthetic canary/socket draft. Recheck:8/9 cases pass; stale-bootstrap case fails with an undefined probe access. Encrypted-vault mode not implemented; incompatible with root's draft session field. |
| Encrypted native pack | New initial source, unpublished, untested, not integrated. No confidentiality, compatibility, chunk interruption or key recovery acceptance. |
| World setup/unlock/restoration | New draft source references vault services. Not imported/composed by bootstrap, not covered by a complete positive first-use test, not accepted. |
| Proposed GM/player UI | Standalone sample-data HTML and screenshots. Interactive design preview only; no integration with real campaign data. |

The frozen working focused run covered28 cases:27 passed,1 failed. Logs are retained with this assessment. Those counts do not establish a working product patch. Implementation was paused at the user's assessment request; drafts have not been silently repaired or counted as shipped features.

The combined frozen working launcher Chromium recheck also failed: it cannot find the old Open Graph Editor button after the Home rewrite. The independently passing launcher/Home checks therefore did not prove their combined current flow. See working-launcher-browser.log. No native-world passing result is claimed.
