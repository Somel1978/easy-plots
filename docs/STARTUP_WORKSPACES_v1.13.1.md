# Startup/workspace patch1.13.1-dev

This development patch addresses startup and accessible user workspaces. The complete module is still unfinished; docs/WORK_ORDER.md is the ordered backlog and acceptance guide.

After updating the module and reloading Foundry, use the Easy Plots diagram icon on the left toolbar, or Configure Settings→Module Settings→Easy Plots→Open Easy Plots. The same settings entry opens the correct workspace for the current GM/player role, including without an active scene.

The GM workspace starts with World setup. Create a private world vault using a passphrase of at least12 characters. Campaign records are encrypted before native document writes; the passphrase is not saved in world settings. Keep it securely: Easy Plots cannot recover it. After reload, unlock the same vault to see the existing plot list. No persistent campaign plot is represented by a memory-only Save button.

Create/Open plot launches the existing GM Plot Editor connected to native storage. Draft save, publication and activation remain separate. The session-tools Home shows unavailable connections as disabled with explanations and has a bounded scroll area.

Players open their own workspace, select an owned character and access Quests, Investigations, Known world, Journal and Notifications. It displays received approved views and honest empty states. Automatic discovery/sharing remains the next work-order item; this patch does not claim a completed populated player experience.

Local checks cover startup, storage creation/unlock, private native draft reconstruction, wrong passwords, ciphertext tampering/chunk interruption and role loss; Chromium exercises actual bootstrap and GM/player entry. These are adapter/DOM regressions. Actual Foundry multiplayer and all125 acceptance scenarios remain unverified. Do not treat the historical service gate as complete-product acceptance.
