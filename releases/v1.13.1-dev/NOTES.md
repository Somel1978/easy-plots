Startup and workspace development patch. The full module remains incomplete.

- Easy Plots toolbar and role-aware Module Settings entry for GM and players.
- GM workspace with real saved-plot list and connected Plot Editor.
- Create/unlock encrypted native world storage; keep the vault passphrase securely. Reload locks the vault without discarding saved plots.
- Player workspace with owned-character selection, audience tabs, received approved views and notifications. Automatic sharing/discovery remains the next task.
- Scrolling Home and unavailable tools disabled with reasons.

Replace the easy-plots folder with module.zip contents and reload the world. Open Easy Plots from the left toolbar or Configure Settings→Module Settings. GM: open World setup first.

Local verification:1,181 Node cases passed, startup→storage→save→reopen→player browser check passed, Home scroll and prior editor workflows passed. These are local/native-adapter checks; actual Foundry-server multiplayer acceptance is still required.

Work order: https://github.com/Somel1978/easy-plots/blob/main/docs/WORK_ORDER.md
Startup guide: https://github.com/Somel1978/easy-plots/blob/main/docs/STARTUP_WORKSPACES_v1.13.1.md
