# End-to-end API walkthrough

A complete curl story: create a school, invite an admin, dispatch a trip, and trigger SOS. Useful for verifying your install or testing a staging environment.

Requires: stack running (`make infra && make api-dev`), core seed done (`make db-seed-local`).

## 0. Set shell variables

```bash
API=http://localhost:3000
SUPER_EMAIL=admin@safarishule.test
SUPER_PASS=ChangeMe!Now1
```

## 1. Authenticate as super admin

```bash
SUPER_TOKEN=$(curl -s -X POST "$API/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: platform" \
  -d "{\"email\":\"$SUPER_EMAIL\",\"password\":\"$SUPER_PASS\"}" \
  | jq -r '.accessToken')

echo "Super-admin token: ${SUPER_TOKEN:0:40}..."
```

## 2. Create a school tenant

```bash
TENANT=$(curl -s -X POST "$API/v1/admin/tenants" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "X-Tenant-Slug: platform" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hillcrest Academy",
    "slug": "hillcrest",
    "subdomain": "hillcrest",
    "planTier": "pro",
    "contactEmail": "contact@hillcrest.ac.ke",
    "adminFullName": "Jane Mwangi",
    "adminEmail": "admin@hillcrest.ac.ke",
    "adminPassword": "Demo!Password1"
  }')

TENANT_ID=$(echo $TENANT | jq -r '.tenant.id')
echo "Tenant ID: $TENANT_ID"
```

## 3. Authenticate as the school admin

```bash
ADMIN_TOKEN=$(curl -s -X POST "$API/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: hillcrest" \
  -d '{"email":"admin@hillcrest.ac.ke","password":"Demo!Password1"}' \
  | jq -r '.accessToken')
```

## 4. Add a vehicle

```bash
VEHICLE=$(curl -s -X POST "$API/v1/vehicles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  -H "Content-Type: application/json" \
  -d '{
    "registration": "KCB 123A",
    "make": "Toyota",
    "model": "HiAce",
    "year": 2022,
    "capacity": 14,
    "ownership": "school",
    "status": "active"
  }')

VEHICLE_ID=$(echo $VEHICLE | jq -r '.id')
echo "Vehicle ID: $VEHICLE_ID"
```

## 5. Create a route

```bash
ROUTE=$(curl -s -X POST "$API/v1/routes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zone A Morning",
    "isActive": true,
    "startPoint": {"lat": -1.286389, "lng": 36.817223},
    "endPoint": {"lat": -1.292066, "lng": 36.821946},
    "busStops": [
      {
        "name": "Westlands Junction",
        "location": {"lat": -1.268, "lng": 36.804},
        "pickupOrder": 1,
        "scheduledPickupTime": "06:45",
        "scheduledDropoffTime": "16:30"
      }
    ]
  }')

ROUTE_ID=$(echo $ROUTE | jq -r '.id')
echo "Route ID: $ROUTE_ID"
```

## 6. Invite a driver

```bash
DRIVER=$(curl -s -X POST "$API/v1/users/invite" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@hillcrest.ac.ke",
    "fullName": "Peter Kamau",
    "phone": "+254712000001",
    "roleKeys": ["driver"]
  }')

DRIVER_USER_ID=$(echo $DRIVER | jq -r '.user.id')
echo "Driver user ID: $DRIVER_USER_ID"
```

## 7. Dispatch a trip

```bash
TRIP=$(curl -s -X POST "$API/v1/trips" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  -H "Content-Type: application/json" \
  -d "{
    \"routeId\": \"$ROUTE_ID\",
    \"vehicleId\": \"$VEHICLE_ID\",
    \"driverUserId\": \"$DRIVER_USER_ID\",
    \"direction\": \"morning_pickup\",
    \"scheduledStart\": \"$(date -u +%Y-%m-%dT06:30:00Z)\"
  }")

TRIP_ID=$(echo $TRIP | jq -r '.id')
echo "Trip ID: $TRIP_ID"
```

## 8. Start the trip

```bash
curl -s -X PATCH "$API/v1/trips/$TRIP_ID/start" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  | jq '.status'
# → "in_progress"
```

## 9. Trigger SOS

```bash
curl -s -X POST "$API/v1/trips/$TRIP_ID/sos" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  -H "Content-Type: application/json" \
  -d '{"kind":"breakdown","severity":"high","description":"Vehicle stalled on Ngong Road"}' \
  | jq '{id:.id, status:.status, severity:.severity}'
```

The SOS creates an incident record, triggers SMS notifications to registered emergency contacts (mocked in dev via `INTEGRATIONS_MODE=mock`), and emits a Socket.IO event on the `incidents` channel.

## 10. Acknowledge and resolve

```bash
# List open incidents
INCIDENT_ID=$(curl -s "$API/v1/incidents?status=reported" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  | jq -r '.data[0].id')

# Acknowledge
curl -s -X PATCH "$API/v1/incidents/$INCIDENT_ID/acknowledge" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" | jq '.status'

# Resolve
curl -s -X PATCH "$API/v1/incidents/$INCIDENT_ID/resolve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"Tyre replaced on site, resumed route 07:45."}' \
  | jq '.status'
# → "resolved"
```

## 11. Initiate an M-Pesa payment (mock)

```bash
curl -s -X POST "$API/v1/payments/fuel" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  -H "Content-Type: application/json" \
  -d "{
    \"vehicleId\": \"$VEHICLE_ID\",
    \"amountKes\": 5000,
    \"phoneE164\": \"+254712000001\",
    \"description\": \"Fuel — Zone A morning run\"
  }" | jq '{id:.id, status:.status, mpesaReceiptNumber:.mpesaReceiptNumber}'
# status → "succeeded" in mock mode
```

## Verify audit trail

Every action above is recorded in `audit_log`. Query via the API:

```bash
curl -s "$API/v1/audit?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Tenant-Slug: hillcrest" \
  | jq '.data[] | {action:.action, entity:.entityType, at:.createdAt}'
```

Or browse visually in the web admin under **Audit log**.
