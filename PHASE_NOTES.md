# LAN-hub Multi-till Sync (Phases 0 - 6)

## Station Temp Tickets Tradeoff
A core invariant of the LAN-hub sync system is that once an order is printed, its `order_number` must never be altered. 
To guarantee this while keeping the restaurant operational when the network fails, we've implemented the following tradeoff:

If a **TERMINAL** is completely isolated from the **HUB** (network down) **AND** has exhausted its fallback ticket lease (default 500 tickets per lease block), it will generate a temporary ticket number like `T2-07` or `A-07` depending on the device prefix.

**Important**:
- This is a last-resort safety net, NOT a designed outcome.
- When a TEMP ticket is generated, it logs a WARN level message.
- A printed TEMP ticket's `order_number` is frozen and will **NEVER** be renumbered into the shared sequence (e.g. `201`), even after the terminal reconnects to the Hub.
- To avoid TEMP tickets, terminals continuously track their remaining lease count in the background. The instant a terminal's remaining count drops to the `lease_low_water_mark` (default 20), it will silently request another batch (`lease_refill_batch`, default 200) from the Hub, ensuring TEMP tickets are an incredibly rare alarm condition.

## Test Checklist for Phase 2

1. **Firewall Requirement**: 
   - Ensure the HUB PC's Windows Firewall allows TCP Port `5000` inbound traffic.

2. **Basic Network Test**:
   - Set one PC to **HUB** and one PC (or Tablet) to **TERMINAL**.
   - Start placing orders on the **TERMINAL**. Ensure they receive shared ticket numbers from the **HUB** (e.g., `1`, `2`, `3`).

3. **Lease Refill Test (Low Water Mark)**:
   - Go to Settings -> LAN Sync on the **TERMINAL**.
   - Change `lease_block_size` to `5`, `lease_low_water_mark` to `2`.
   - Disconnect the network (unplug ethernet or turn off Wi-Fi on TERMINAL).
   - Place 3 orders on the TERMINAL. It should draw from its lease.
   - Reconnect the network.
   - Wait a moment or place another order (which triggers the background check).
   - Confirm the background refill fires automatically (check backend logs for `Refilled lease: X - Y`).
   - Disconnect again and exhaust the lease block fully.
   - Ensure that a TEMP ticket (e.g., `T2-XX`) only appears after true exhaustion, and verify the `WARN` log appears.
   
4. **General Operations**:
   - Verify Settings Page updates properly for LAN Sync.
   - Verify TopNavbar status pill (`HUB`, `LAN OK`, or `ISOLATED`).

## Test Checklist for Phase 3 (Lightweight LAN Data Sync)

1. **Order Broadcast**:
   - Set one PC to **HUB** and one PC (or Tablet) to **TERMINAL**.
   - Place an order on the **TERMINAL**.
   - Check the **HUB**'s POS Dashboard. The order should appear instantly via the `lan-sync-order` endpoint.
   
2. **Order Payment Sync**:
   - Mark an order as paid on the **TERMINAL**.
   - Ensure the payment state updates accurately on the **HUB**.
   
3. **Cloud Sync Forwarding**:
   - Verify that when the HUB receives a LAN-synced order, it queues a `sync_queue` event to push that data up to the Vercel cloud automatically.
   
4. **Network Outage Resilience**:
   - Disconnect the **TERMINAL** from the **HUB**.
   - Place an order on the **TERMINAL** (it will save locally).
   - Ensure the POS continues to function without crashing (fetch timeout is 2 seconds).
   - Once reconnected, subsequent interactions with the order will sync its full state to the HUB.

## Test Checklist for Phase 4 (Kitchen Print From Hub)

> **Important Setup**: Kitchen printers must be configured in the HUB's printers table as `ESCPOS_LAN ip:9100` or `USB` attached to the HUB. Terminals no longer interface directly with the Kitchen Printers.

1. **Terminal Forwards Kitchen Print**:
   - Make sure a Kitchen Printer is configured on the HUB.
   - Using a **TERMINAL**, place an order that includes a kitchen item.
   - Verify that the terminal does not attempt to print locally (no local kitchen `print_job` should be created on the Terminal).
   - Verify that the Terminal sends a POST request to the HUB for the kitchen print.
   
2. **Hub Executes Kitchen Print**:
   - Verify that the HUB successfully receives the kitchen print request and creates a `print_job` in its local database.
   - Verify that the kitchen ticket physically prints from the HUB's printer.

## Phase 5 (Demote Vercel To Backup)
- Terminals no longer rely on Vercel for live syncing; `syncWorker.js` avoids pushing/pulling cloud data if `device_role` is set to `TERMINAL`.
- Vercel is strictly a backup layer synchronized only by the HUB.

## Phase 6 (Hardening)
> **Hub PC settings note:** The HUB PC must NEVER go to sleep. Please configure the Windows Power & Sleep settings to "Never" when plugged in, as offline terminals depend on the Hub being continuously reachable over the LAN to allocate numbers and synchronize orders.

### Final Test Matrix
A. **Internet unplugged, both PCs on LAN**:
   orders from both PCs get sequential unique #n and appear on both screens.
B. **Unplug terminal from hub, make 2 orders on terminal**:
   uses lease block, no clash with hub numbers.
C. **Reconnect terminal**:
   hub and tablet show those leased-number orders. Hub never reuses those numbers.
D. **Tablet browser to http://HUB_IP:5000**:
   login, create order, same #n, kitchen print request reaches hub.
E. **Vercel/internet down the whole time**:
   shop still sells and prints.
F. **Kitchen printer off**:
   order still saves.
G. **Single-PC standalone mode**: A single PC set to HUB must work exactly like today, plus it no longer needs Vercel to allocate numbers.
H. **Simulate slow Hub response**: Raise hub_timeout_ms to a large value on a terminal, then simulate a slow (not down) hub response: terminal should still successfully allocate via HUB_LAN rather than falling back to LEASE/TEMP.
I. **Lease edge case**: Set lease_block_size low (e.g. 5) and lease_low_water_mark to 2 for a test terminal. Disconnect it from the hub and place orders until the low water mark would have triggered a refill had it been connected. Reconnect before the block is exhausted: confirm the refill request fires automatically and the terminal never falls through to a TEMP ticket. Then repeat fully isolated past the block's end and confirm TEMP tickets only appear after true exhaustion, with a logged warning.
