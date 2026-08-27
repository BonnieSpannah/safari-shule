# Admin user guide

A walkthrough of the Safari Shule web console for school administrators. Covers the full day-to-day journey: fleet, students, routes, trip dispatch, incidents, payments, and settings.

URL: `http://localhost:5173` (dev) or `https://<your-school>.safari-shule.test` (Herd).

---

## Signing in

1. Open the app URL in your browser.
2. Enter your email and password.
3. Click **Sign in**.

On first login you'll be prompted to change your password (unless the super admin disabled this for your account).

---

## Dashboard

The dashboard shows:

- **Live trips** — active trips with vehicle registration, route name, driver, boarding count, and current status. Auto-refreshes every 15 s.
- **Stats cards** — total students enrolled, vehicles active, trips today, open incidents.

Click any trip row to open its detail panel.

---

## Fleet

**Path:** Fleet

Manage the school's vehicle inventory.

### Add a vehicle

1. Click **Add vehicle**.
2. Fill in registration, make, model, year, capacity, and ownership type (School / Hired).
3. Set status to **Active**.
4. Click **Save**.

### Edit or retire a vehicle

Open the action menu (⋯) on any row:

- **Edit** — update any field.
- **Retire** — marks the vehicle as retired; it will not appear in the trip dispatch form.

### Export

Click **Export** (top-right of the table) to download a CSV, Excel, or PDF snapshot of the current filtered view.

---

## Routes

**Path:** Routes

Define bus routes that vehicles follow. Each route has an ordered list of bus stops with scheduled pickup and drop-off times.

### Create a route

1. Click **Add route**.
2. Enter a name and optional description.
3. Toggle **Active** on.
4. Click **Create route**.

> Bus stops and GPS coordinates are added via the map editor (coming in the next milestone). New routes start with a placeholder stop.

### Activate / deactivate

Use the action menu → **Activate** or **Deactivate**. Students assigned to an inactive route will not be picked up.

---

## Students

**Path:** Students

Enrol and manage students.

### Enrol a student

1. Click **Enrol student**.
2. Fill in legal name, admission number, date of birth, and gender.
3. Optionally add classroom and birth certificate number.
4. Click **Enrol**.

### Edit or remove

Open the action menu on any student row. Deleting a student is permanent and removes all route assignments.

### Search and filter

Use the search box (filters on name or admission number) and the gender / class selectors above the table. All filters reset with the **× Clear** button.

---

## Parents

**Path:** Parents

Link parents and caretakers to students.

### Add a parent

1. Click **Add parent**.
2. Enter full name, phone (Kenyan mobile, `+2547...`), and optionally email and national ID.
3. Click **Save**.

### Link to a student

From the parent's action menu → **Link student**, then search by name or admission number.

---

## Trips

**Path:** Trips

Dispatch and monitor school bus trips in real time.

### Dispatch a trip

1. Click **Dispatch trip**.
2. Select a route, vehicle, driver, and direction (Morning pickup / Evening drop-off).
3. Set the scheduled start time.
4. Click **Dispatch**.

### Trip lifecycle

| Status        | Meaning                     |
| ------------- | --------------------------- |
| `scheduled`   | Dispatched, not yet started |
| `in_progress` | Driver started the trip     |
| `completed`   | Trip ended normally         |
| `cancelled`   | Cancelled before starting   |

Use the action menu to **Start**, **End**, or **Cancel** a trip. Starting a trip begins live telemetry — the vehicle pin appears on the map on the Dashboard.

### Live refresh

The trips board refreshes every 15 s automatically. Pull-to-refresh is also available on mobile.

---

## Incidents

**Path:** Incidents

Track SOS alerts and operational issues reported during trips.

### Incident lifecycle

| Status         | Action                                                     |
| -------------- | ---------------------------------------------------------- |
| `reported`     | Incident just created (SOS or manual)                      |
| `acknowledged` | Dispatcher confirmed receipt → click **Acknowledge**       |
| `resolved`     | Issue resolved → click **Resolve**, enter resolution notes |

### View SMS log

Click **View details** from the action menu to open the incident detail panel, which shows the SMS delivery log for every emergency contact notified.

---

## Payments

**Path:** Payments

Initiate and track M-Pesa STK-push payments for fuel and repairs.

### Initiate a payment

1. Click **Initiate STK**.
2. Select purpose (Fuel / Repair).
3. Enter the amount in KES, mobile number (`+2547...`), and a description.
4. Click **Send**.

An STK push prompt is sent to the mobile number. The transaction status updates automatically:

| Status      | Meaning                                 |
| ----------- | --------------------------------------- |
| `initiated` | STK sent, waiting for PIN               |
| `succeeded` | Payment confirmed, M-Pesa receipt shown |
| `failed`    | Timeout or PIN error                    |
| `cancelled` | User dismissed the prompt               |

The table auto-refreshes every 20 s.

---

## Settings

**Path:** Settings

### Users tab

Manage staff accounts that can log in to the web admin.

**Invite a user**

1. Click **Invite user**.
2. Enter their full name, email, optional phone, and assign one or more roles.
3. Click **Send invitation**.

The user receives an email with a link to set their password.

**Deactivate / reactivate**

Use the action menu on any user row. Deactivated users lose access immediately; their data is preserved.

### Staff tab

Manage employment records for drivers, assistants, and other school staff.

**Add a staff member**

1. Click **Add staff**.
2. Fill in legal name, employee number, national ID, position, phone, date of birth, and gender.
3. Click **Add staff member**.

Staff records are linked to driver users for trip assignment.

---

## Profile and account

Access via the avatar menu (top-right corner):

| Page            | What you can do                                      |
| --------------- | ---------------------------------------------------- |
| **Profile**     | Update your full name and phone number               |
| **Security**    | Change your password; view active sessions           |
| **Preferences** | Toggle dark / light / system theme; collapse sidebar |

---

## Audit log

**Path:** Audit log (visible to users with `audit.view`)

Every significant action in the system is recorded — login, data access, exports, payment initiation, impersonation. Filter by date, action type, or entity. Export as CSV.

---

## Keyboard shortcuts

| Shortcut           | Action                                       |
| ------------------ | -------------------------------------------- |
| `?`                | Open keyboard shortcut help (if implemented) |
| `Cmd+K` / `Ctrl+K` | Command palette (coming in a future release) |

---

## Getting help

- This guide: `docs/user-guide/admin.md`
- API walkthrough: [e2e-walkthrough.md](../e2e-walkthrough.md)
- Troubleshooting: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- Support: [SUPPORT.md](../SUPPORT.md)
