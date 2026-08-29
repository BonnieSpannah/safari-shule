import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Clock3, Route as RouteIcon, Users, MapPinned, Activity, CheckCircle2, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { env } from '@/lib/env';
import { getTrip, updateTripAssignment, type TripDetail, type TripLocationSnapshot } from '@/lib/api/trips';
import { getRouteStops, type BusStop } from '@/lib/api/routes';
import { listVehicles, type Vehicle } from '@/lib/api/fleet';
import { listUsers, type User } from '@/lib/api/users';
import { listAuditLogs, type AuditEntry } from '@/lib/api/audit';
import { useAnyPermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/stores/auth.store';

type Point = [number, number];

const NAIROBI_CENTER: Point = [-1.2864, 36.8219];

function socketBaseUrl(): string {
  if (env.apiUrl) return env.apiUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

function statusMeta(status: TripDetail['status']) {
  if (status === 'in_progress') return { tone: 'bg-green-500/10 text-green-700 border-green-500/20', label: 'Live trip', note: 'Vehicle location is streaming in real time.' };
  if (status === 'completed') return { tone: 'bg-teal-500/10 text-teal-700 border-teal-500/20', label: 'Completed', note: 'Actual covered path is shown from telemetry snapshots.' };
  if (status === 'cancelled') return { tone: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'Cancelled', note: 'This trip was cancelled, but the expected route remains visible.' };
  return { tone: 'bg-blue-500/10 text-blue-700 border-blue-500/20', label: 'Planned', note: 'Expected route and stop sequence are shown before departure.' };
}

function pointFromSnapshot(snapshot: TripLocationSnapshot): Point {
  return [snapshot.lat, snapshot.lng];
}

function pointFromStop(stop: BusStop): Point {
  return [stop.lat, stop.lng];
}

function stopIcon(order: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:#0f766e;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,.3)">${order}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function LiveVehicleMarker({ position }: { position: Point }) {
  return (
    <CircleMarker center={position} radius={10} pathOptions={{ color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.95 }}>
      <Popup>
        <div className="text-xs">Current live vehicle position</div>
      </Popup>
    </CircleMarker>
  );
}

function MapFit({ points }: { points: Point[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(NAIROBI_CENTER, 12);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0]!, 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36] });
  }, [map, points]);

  return null;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function personLabel(person: { fullName?: string | null; email?: string | null } | null | undefined, fallback: string) {
  if (!person) return fallback;
  return person.fullName || person.email || fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function summarizeTripAudit(entry: AuditEntry): string {
  const before = (entry.before ?? {}) as Record<string, unknown>;
  const after = (entry.after ?? {}) as Record<string, unknown>;
  if (entry.action === 'trip.assignment_update') {
    const changes: string[] = [];
    const beforeVehicle = asRecord(before.vehicle);
    const afterVehicle = asRecord(after.vehicle);
    if (before.vehicleId !== after.vehicleId) {
      changes.push(`Vehicle ${asText(beforeVehicle?.registration) ?? asText(before.vehicleId) ?? '—'} → ${asText(afterVehicle?.registration) ?? asText(after.vehicleId) ?? '—'}`);
    }
    if (before.driverUserId !== after.driverUserId) {
      const beforeDriver = asRecord(before.driver) as { fullName?: string | null; email?: string | null } | null;
      const afterDriver = asRecord(after.driver) as { fullName?: string | null; email?: string | null } | null;
      changes.push(`Driver ${personLabel(beforeDriver, asText(before.driverUserId) ?? '—')} → ${personLabel(afterDriver, asText(after.driverUserId) ?? '—')}`);
    }
    if (before.assistantUserId !== after.assistantUserId) {
      const beforeAssistant = asRecord(before.assistant) as { fullName?: string | null; email?: string | null } | null;
      const afterAssistant = asRecord(after.assistant) as { fullName?: string | null; email?: string | null } | null;
      changes.push(`Assistant ${personLabel(beforeAssistant, asText(before.assistantUserId) ?? '—')} → ${personLabel(afterAssistant, asText(after.assistantUserId) ?? '—')}`);
    }
    const afterAssignmentChange = asRecord(after.assignmentChange);
    const reasonText = asText(afterAssignmentChange?.reason);
    const reason = reasonText ? `Reason: ${reasonText}` : '';
    return [...changes, reason].filter(Boolean).join(' · ') || 'Assignment updated.';
  }
  if (entry.action === 'trip.start') return 'Trip started.';
  if (entry.action === 'trip.end') return 'Trip completed.';
  if (entry.action === 'trip.cancel') return 'Trip cancelled.';
  if (entry.action === 'trip.create') return 'Trip created.';
  return `${entry.entityType} updated.`;
}

function auditWhen(value: string) {
  return `${formatDistanceToNow(new Date(value), { addSuffix: true })} · ${new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))}`;
}

export function TripDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const token = useAuthStore((s) => s.accessToken);
  const canDispatch = useAnyPermission('trips.dispatch', 'tenants.manage');
  const [liveTrail, setLiveTrail] = useState<TripLocationSnapshot[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [driverUserId, setDriverUserId] = useState('');
  const [assistantUserId, setAssistantUserId] = useState('__none__');
  const [assignmentReason, setAssignmentReason] = useState('');

  const tripQuery = useQuery({
    queryKey: ['trip', id],
    queryFn: () => getTrip(id as string),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const trip = tripQuery.data;

  useEffect(() => {
    if (!trip) return;
    setVehicleId(trip.vehicleId);
    setDriverUserId(trip.driver?.id ?? trip.driverUserId);
    setAssistantUserId(trip.assistant?.id ?? '__none__');
    setAssignmentReason('');
  }, [trip]);

  const routeStopsQuery = useQuery({
    queryKey: ['trip-route-stops', trip?.routeId],
    queryFn: () => getRouteStops(trip!.routeId),
    enabled: !!trip?.routeId,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['trip-assignment-vehicles', trip?.tenant?.id],
    queryFn: () => listVehicles({ tenantId: trip?.tenant?.id, status: 'active', pageSize: 100 }),
    enabled: !!trip && canDispatch,
  });

  const driversQuery = useQuery({
    queryKey: ['trip-assignment-drivers', trip?.tenant?.id],
    queryFn: () => listUsers({ tenantId: trip?.tenant?.id, status: 'active', roleKey: 'driver', pageSize: 100 }),
    enabled: !!trip && canDispatch,
  });

  const assistantsQuery = useQuery({
    queryKey: ['trip-assignment-assistants', trip?.tenant?.id],
    queryFn: () => listUsers({ tenantId: trip?.tenant?.id, status: 'active', roleKey: 'assistant', pageSize: 100 }),
    enabled: !!trip && canDispatch,
  });

  const auditQuery = useQuery({
    queryKey: ['trip-audit-history', trip?.id],
    queryFn: () => listAuditLogs({ entityType: 'trip', entityId: trip!.id, pageSize: 10 }),
    enabled: !!trip,
    refetchInterval: trip?.status === 'in_progress' ? 30_000 : 60_000,
  });

  const assignmentMutation = useMutation({
    mutationFn: () => updateTripAssignment(trip!.id, {
      vehicleId: vehicleId || undefined,
      driverUserId: driverUserId || undefined,
      assistantUserId: assistantUserId === '__none__' ? null : (assistantUserId || undefined),
      reason: assignmentReason.trim() || null,
    }),
    onSuccess: async () => {
      setAssignmentReason('');
      await Promise.all([tripQuery.refetch(), auditQuery.refetch()]);
    },
  });

  useEffect(() => {
    if (trip?.status !== 'in_progress') {
      setLiveTrail([]);
    }
  }, [trip?.id, trip?.status]);

  useEffect(() => {
    if (!token || !trip || trip.status !== 'in_progress') return;

    const socket: Socket = io(`${socketBaseUrl()}/ws`, {
      transports: ['websocket'],
      auth: { token },
    });

    const subscribe = () => {
      socket.emit('trip.subscribe', { tripId: trip.id });
    };

    socket.on('connect', subscribe);
    socket.on('trip.location', (payload: { tripId?: string; lat: number; lng: number; heading_degrees?: number; speed_mps?: number; timestamp: number }) => {
      if (payload.tripId !== trip.id) return;
      setLiveTrail((prev) => [
        ...prev.slice(-79),
        {
          id: `${payload.tripId}-${payload.timestamp}`,
          lat: payload.lat,
          lng: payload.lng,
          headingDeg: payload.heading_degrees ?? null,
          speedKph: typeof payload.speed_mps === 'number' ? payload.speed_mps * 3.6 : null,
          recordedAt: new Date(payload.timestamp).toISOString(),
        },
      ]);
    });

    subscribe();

    return () => {
      socket.off('connect', subscribe);
      socket.off('trip.location');
      socket.close();
    };
  }, [token, trip]);

  const routeStops = useMemo(() => routeStopsQuery.data ?? [], [routeStopsQuery.data]);
  const plannedPath = useMemo(() => routeStops.map(pointFromStop), [routeStops]);
  const actualPath = useMemo(() => {
    if (!trip) return [];
    if (trip.status === 'completed') return trip.locationSnapshots.map(pointFromSnapshot);
    if (trip.status === 'in_progress') return [...trip.locationSnapshots, ...liveTrail].map(pointFromSnapshot);
    return [];
  }, [liveTrail, trip]);
  const mapFocus = actualPath.length > 0 ? actualPath : plannedPath;
  const meta = trip ? statusMeta(trip.status) : null;
  const boardedPassengers = trip?.passengers.filter((p) => !!p.boardedAt).length ?? 0;
  const assistantValue = assistantUserId === '__none__' ? null : assistantUserId;
  const hasAssignmentChanges = trip
    ? vehicleId !== trip.vehicleId || driverUserId !== (trip.driver?.id ?? trip.driverUserId) || assistantValue !== (trip.assistant?.id ?? null)
    : false;
  const assignmentLocked = !trip || trip.status === 'completed' || trip.status === 'cancelled';
  const assignmentReasonRequired = trip?.status === 'in_progress';

  const vehicleOptions = useMemo(() => {
    const base = (vehiclesQuery.data?.data ?? []).map((vehicle: Vehicle) => ({
      value: vehicle.id,
      label: `${vehicle.registration} — ${vehicle.make} ${vehicle.model}`,
    }));
    if (trip && !base.some((option) => option.value === trip.vehicleId)) {
      base.unshift({ value: trip.vehicleId, label: `${trip.vehicle.registration} — ${trip.vehicle.make} ${trip.vehicle.model}` });
    }
    return base;
  }, [trip, vehiclesQuery.data]);

  const driverOptions = useMemo(() => {
    const base = (driversQuery.data?.data ?? []).map((user: User) => ({ value: user.id, label: personLabel(user, user.id) }));
    if (trip?.driver && !base.some((option) => option.value === trip.driver!.id)) {
      base.unshift({ value: trip.driver.id, label: personLabel(trip.driver, trip.driver.id) });
    }
    return base;
  }, [driversQuery.data, trip?.driver]);

  const assistantOptions = useMemo(() => {
    const base = [{ value: '__none__', label: 'No assistant' }, ...(assistantsQuery.data?.data ?? []).map((user: User) => ({ value: user.id, label: personLabel(user, user.id) }))];
    if (trip?.assistant && !base.some((option) => option.value === trip.assistant!.id)) {
      base.push({ value: trip.assistant.id, label: personLabel(trip.assistant, trip.assistant.id) });
    }
    return base;
  }, [assistantsQuery.data, trip?.assistant]);

  if (tripQuery.isError) {
    return <ErrorState title="Failed to load trip" error={tripQuery.error} onRetry={() => tripQuery.refetch()} />;
  }

  if (tripQuery.isLoading || !trip) {
    return (
      <div className="space-y-5">
        <PageHeader title="Trip" description="Loading trip details..." actions={<Button variant="outline" size="sm" onClick={() => navigate('/trips')}><ArrowLeft className="h-4 w-4" /> Back</Button>} />
        <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Loading trip details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={trip.route?.name ?? 'Trip detail'}
        description={`${trip.direction.replace('_', ' ')} · ${trip.vehicle.registration} · ${trip.tenant?.name ?? 'Tenant unknown'}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/trips')}>
            <ArrowLeft className="h-4 w-4" /> Back to trips
          </Button>
        }
      />

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-gradient-to-r from-surface-2/50 to-surface-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${meta?.tone ?? ''}`}>{meta?.label}</div>
              <CardTitle className="text-lg">{meta?.note}</CardTitle>
              <CardDescription>
                {trip.route?.name ?? trip.routeId} · Scheduled {formatDate(trip.scheduledStart)}
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Passengers" value={`${trip.passengers.length}`} icon={<Users className="h-3.5 w-3.5" />} />
              <Metric label="Boarded" value={`${boardedPassengers}`} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
              <Metric label="Planned stops" value={`${routeStops.length}`} icon={<RouteIcon className="h-3.5 w-3.5" />} />
              <Metric label="Telemetry" value={trip.status === 'completed' ? `${trip.locationSnapshots.length} points` : trip.status === 'in_progress' ? `${actualPath.length} points` : 'Pending'} icon={<Radio className="h-3.5 w-3.5" />} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_360px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Route map</h3>
                  <p className="text-xs text-muted-foreground">Planned route, live position and telemetry trail change automatically with trip status.</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1"> <MapPinned className="h-3 w-3" /> Planned route</span>
                  {trip.status !== 'scheduled' && <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1"><Activity className="h-3 w-3" /> Actual coverage</span>}
                </div>
              </div>
              <div className="h-[560px]">
                <MapContainer center={NAIROBI_CENTER} zoom={12} className="h-full w-full">
                  <TileLayer url={env.mapTileUrl} attribution={env.mapAttribution} />
                  <MapFit points={mapFocus} />

                  {plannedPath.length > 0 && (
                    <Polyline
                      positions={plannedPath}
                      pathOptions={{ color: '#2563eb', weight: 4, dashArray: '8 8', opacity: 0.85 }}
                    />
                  )}

                  {actualPath.length > 0 && (
                    <Polyline
                      positions={actualPath}
                      pathOptions={{ color: trip.status === 'completed' ? '#0f766e' : '#16a34a', weight: 5, opacity: 0.95 }}
                    />
                  )}

                  {routeStops.map((stop, index) => (
                    <Marker key={stop.id} position={pointFromStop(stop)} icon={stopIcon(index + 1)}>
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">{index + 1}. {stop.name}</p>
                          <p>Pickup {stop.scheduledPickupTime} · Drop-off {stop.scheduledDropoffTime}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {trip.status === 'in_progress' && actualPath.length > 0 && <LiveVehicleMarker position={actualPath[actualPath.length - 1]!} />}
                </MapContainer>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Assignment</CardTitle>
                  <CardDescription>
                    {!canDispatch
                      ? 'You need the trips.dispatch permission to update vehicle or crew assignments.'
                      : assignmentLocked
                      ? 'This trip is locked after completion or cancellation.'
                      : trip.status === 'in_progress'
                        ? 'Switch vehicle, driver or assistant mid-journey. The original assignment stays in audit history.'
                        : 'Edit the planned vehicle and crew before departure.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canDispatch && !assignmentLocked ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle</p>
                          <SearchableSelect
                            options={vehicleOptions}
                            value={vehicleId}
                            onChange={setVehicleId}
                            placeholder={vehiclesQuery.isLoading ? 'Loading vehicles...' : 'Select vehicle'}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Driver</p>
                          <SearchableSelect
                            options={driverOptions}
                            value={driverUserId}
                            onChange={setDriverUserId}
                            placeholder={driversQuery.isLoading ? 'Loading drivers...' : 'Select driver'}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Assistant</p>
                          <SearchableSelect
                            options={assistantOptions}
                            value={assistantUserId}
                            onChange={setAssistantUserId}
                            placeholder={assistantsQuery.isLoading ? 'Loading assistants...' : 'Select assistant'}
                          />
                        </div>
                      </div>

                      {assignmentReasonRequired && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason for change</p>
                          <textarea
                            value={assignmentReason}
                            onChange={(e) => setAssignmentReason(e.target.value)}
                            rows={4}
                            placeholder="e.g. Vehicle breakdown near Westlands; dispatching backup bus and driver"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      )}

                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={!hasAssignmentChanges || assignmentMutation.isPending || (assignmentReasonRequired && !assignmentReason.trim())}
                        onClick={() => assignmentMutation.mutate()}
                      >
                        {assignmentMutation.isPending ? 'Saving assignment...' : trip.status === 'in_progress' ? 'Switch assignment' : 'Update assignment'}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-border bg-background px-3 py-3 text-sm">
                      {!canDispatch && !assignmentLocked && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                          Assignment changes are read-only for your account. Required permission: trips.dispatch.
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Vehicle</span>
                        <span className="font-medium">{trip.vehicle.registration} — {trip.vehicle.make} {trip.vehicle.model}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Driver</span>
                        <span className="font-medium">{personLabel(trip.driver, trip.driverUserId)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Assistant</span>
                        <span className="font-medium">{trip.assistant ? personLabel(trip.assistant, trip.assistantUserId ?? '') : 'No assistant'}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Trip details</CardTitle>
                  <CardDescription>Core metadata and timing.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Route', trip.route?.name ?? trip.routeId],
                    ['Vehicle', `${trip.vehicle.registration}`],
                    ['Direction', trip.direction.replace('_', ' ')],
                    ['Status', trip.status.replace('_', ' ')],
                    ['Scheduled', formatDate(trip.scheduledStart)],
                    ['Started', trip.startedAt ? formatDate(trip.startedAt) : '—'],
                    ['Ended', trip.endedAt ? formatDate(trip.endedAt) : '—'],
                    ['Tenant', trip.tenant?.name ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Audit history</CardTitle>
                  <CardDescription>Recent status and assignment changes for this trip.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {auditQuery.isLoading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Loading audit history...</div>
                  ) : (auditQuery.data?.data ?? []).length === 0 ? (
                    <EmptyState icon={<Clock3 className="h-6 w-6" />} title="No trip history yet" description="Changes to this trip will appear here." />
                  ) : (
                    (auditQuery.data?.data ?? []).map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="font-medium capitalize">{entry.action.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{summarizeTripAudit(entry)}</p>
                          </div>
                          <p className="shrink-0 text-[11px] text-muted-foreground">{auditWhen(entry.createdAt)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full border border-border bg-muted/20 px-2 py-0.5">{entry.actor?.fullName ?? 'System'}</span>
                          {entry.entityId && <span className="rounded-full border border-border bg-muted/20 px-2 py-0.5 font-mono">{entry.entityId}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Planned stops</CardTitle>
                  <CardDescription>Expected route sequence used for the journey.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {routeStopsQuery.isLoading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Loading route stops...</div>
                  ) : routeStops.length === 0 ? (
                    <EmptyState icon={<RouteIcon className="h-6 w-6" />} title="No route stops" description="The route has no stop geometry yet." />
                  ) : (
                    routeStops.map((stop, index) => (
                      <div key={stop.id} className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">{index + 1}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium">{stop.name}</p>
                            <p className="shrink-0 text-[11px] text-muted-foreground">#{stop.pickupOrder}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Pickup {stop.scheduledPickupTime} · Drop-off {stop.scheduledDropoffTime}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Passengers</CardTitle>
                  <CardDescription>Expected riders linked to this trip.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trip.passengers.length === 0 ? (
                    <EmptyState icon={<Users className="h-6 w-6" />} title="No passengers yet" description="Passengers will appear once linked to the trip." />
                  ) : (
                    trip.passengers.slice(0, 6).map((passenger) => (
                      <div key={passenger.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{passenger.student.legalName}</p>
                          <p className="text-xs text-muted-foreground">{passenger.student.admissionNumber}</p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {passenger.boardedAt ? 'Boarded' : passenger.expected ? 'Expected' : 'Optional'}
                        </p>
                      </div>
                    ))
                  )}
                  {trip.passengers.length > 6 && <p className="pt-1 text-xs text-muted-foreground">+{trip.passengers.length - 6} more passengers</p>}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Planned route</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Actual coverage</span>
              {trip.status === 'in_progress' && <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Live position</span>}
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Auto-refreshes every 15 seconds; live positions stream in while the trip is in progress.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}