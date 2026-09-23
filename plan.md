# Dubai Food POS — remaining work

Code was changed in a previous session. **Nothing below was runtime-tested in the live app.** Operational steps (GitHub revoke, secret rotation, clicking screens) are not DONE.

---

## DONE (code landed; files)

1. **GitHub PAT removed from source** — `main.js` (auto-update uses `GH_TOKEN` env only)
2. **Stop packing `.env` in the installer** — `package.json`
3. **JWT required + generated/persisted for Electron** — `backend/src/config/schema.js`, `backend/src/config/index.js`, `main.js`, `backend/.env` (local)
4. **Auth on backup / sync / dashboard / reports** — `backend/src/routes/backupRoutes.js`, `syncRoutes.js`, `dashboardRoutes.js`, `reportRoutes.js`
5. **Do not serve the live DB over `/storage`** — `backend/src/app.js` (images + templates only)
6. **Logout revokes by JWT `jti`** — `backend/src/middleware/authenticate.js`
7. **Inactive/locked users blocked; failed PIN attempts; login rate limit** — `backend/src/services/authService.js`, `backend/src/routes/authRoutes.js`
8. **Prefer JWT user id over `x-user-id`** — `backend/src/controllers/paymentController.js`, `cartController.js`, `orderController.js`
9. **Manager PIN verify API** — `authService.js`, `authController.js`, `authRoutes.js`; used by `frontend/src/pages/POS.tsx`, `Orders.tsx`, `CashierManagement.tsx`, `frontend/src/services/authService.ts`
10. **Shift `req.user.userId` + real SQL + `cash_drops`/`paid_outs`/close columns** — `shiftController.js`, `shiftService.js`, `backend/src/database/migrations/033_shift_cash_ops.js`
11. **Order `idempotency_key` actually inserted; checkout requires header** — `orderRepository.js`, `orderCreationService.js`, `cartController.js`
12. **Payment re-check inside the SQLite transaction** — `paymentService.js`, `paymentValidationService.js`
13. **Tax removed; service charges kept** — `orderCreationService.js`, `frontend/src/store/posStore.ts`, `POS.tsx`
14. **Checkout pays unless method is Later** — `POS.tsx`, `posStore.ts`
15. **Order notes saved to cart** — `POS.tsx` → `cartService.setNotes`
16. **Edit-mode item notes/modifiers/duplicate hit order APIs** — `posStore.ts`
17. **No unlock-on-unmount wiping edit cart** — `POS.tsx`
18. **Drive Through mapped; Later does not post a fake payment method** — `posStore.ts`
19. **Backup zip create uses `archiver`; restore integrity check fixed; Electron respawns after exit 0** — `backend/src/backup/backupService.js`, `backupController.js`, `main.js`
20. **Backup upload dir is `config.paths.temp`** — `backupRoutes.js`
21. **Config unwrap (printers/finance load)** — `Settings.tsx`, `KDS.tsx`, `posStore.ts`
22. **Cursor no longer hides; printers fetched on start + Printer Manager** — `App.tsx`, `PrinterManager.tsx`
23. **Ctrl+P calls `printReceipt`** — `App.tsx`
24. **Error boundary hides stack in production** — `GlobalErrorBoundary.tsx`
25. **Toasts use `toastStore` (not silent `react-hot-toast`)** — `toastStore.ts`, `Backup.tsx`, `Synchronization.tsx`, `CustomerPanelModal.tsx`, `Orders.tsx`
26. **`/employees` → `/permissions`; notifications empty; Customers in sidebar** — `main.tsx`, `NotificationCenter.tsx`, `Sidebar.tsx`
27. **Waiter list by role name** — `WaiterSelectorModal.tsx`
28. **Occupied table loads the order; dine-in marks floor table Occupied; delete frees if idle** — `TableSelectorModal.tsx`, `orderCreationService.js`, `tableController.js`, `orderService.js`
29. **Orders PDF `autoTable` import; bulk actions no longer swallow all errors** — `Orders.tsx`
30. **Kitchen status on Orders page calls kitchen APIs (first item only)** — `Orders.tsx`
31. **Reports: no 70% cash / 45% profit mock; custom range spinner clears** — `Reports.tsx`, `reportService.js`
32. **Product view fake 42/12 unit stats removed** — `Products.tsx`
33. **Receipt preview uses settings store address/phone** — `ReceiptPreview.tsx`
34. **Print route `/queue/order/:id` registered before `/queue/:jobId`** — `printRoutes.js`
35. **Catalog image MIME allow-list** — `catalogRoutes.js`
36. **Sync: delete payload arity; pull extra tables; conflict resolve API** — `orderService.js`, `syncWorker.js`, `sync-api/src/controllers/syncController.js`, `frontend/src/api/syncApi.ts`, `Synchronization.tsx`
37. **Manual sync 60s timeout** — `syncApi.ts`
38. **Frontend `tsc -b` passed** after these edits

---

## UNVERIFIED (code exists; not proven in a running POS)

1. Cashiers open/close/cash-drop/paid-out against a real DB after migration `033`
2. Backup create zip + restore + window reload
3. Settings / KDS printer list after config unwrap
4. Thermal print / KOT on real hardware
5. POS Cash checkout records `order_payments` and does not double-create orders
6. Order notes appear on kitchen ticket / receipt
7. Occupied table click loads the live ticket
8. Reports cash vs digital matches `order_payments`
9. Cloud pull of `deals` / `order_payments` / `dining_tables` against live Supabase (tables may be missing)
10. Packaged exe still starts (JWT from `secrets.json`, no packed `.env`, `DEVICE_SECRET` on a fresh PC)

---

## TODO (remaining only)

1. **Revoke the old GitHub PAT on github.com** (it was in `main.js`; removing it from source does not revoke it).
2. **Rotate leaked cloud secrets** (Supabase service_role, Cloudinary, `DEVICE_SECRET`, sync-api JWT) and update Vercel/Render. Confirm `sync-api/.env` was never pushed.
3. **Change default live PIN** `admin` / `1234` on the database the client will use.
4. **Run the app once on the same DB path the client will use** (`npm run dev` → `backend/storage/...`; Electron → `%APPDATA%\Restaurant POS\storage\...`) so migration `033` actually applies. Then click: login, POS cash sale, Cashiers, Settings printers, Backup create.
5. **Decide LAN vs loopback.** Code still listens on all interfaces (tablets). If this site is one PC only, bind `127.0.0.1` in `server.js`.
6. **Hold / resume** — APIs exist; POS has no Hold control. Add a button that calls existing APIs, or leave unused.
7. **Kitchen status from Orders** currently updates the **first item only**. Loop all items if that screen is used.
8. **Multi-terminal images** — worker still does not POST `/sync/upload-image`. Skip if one PC.
9. **Electron `contextIsolation: true` + preload** — still `nodeIntegration: true`.
10. **Do not glob junk into the next installer** — leftover `pos.db` copies, `testController.js`, `POS.old.tsx`, extra `node.exe`.
11. **No automated tests** — still none. Add checkout/payment/login/restore tests if there is time after the demo.
12. **Inventory / Expenses pages** stay unrouted on purpose (incomplete). Do not demo them.

Out of scope (still): inventory stock deduction, expense product, notification engine, online ordering, new tax engine.
