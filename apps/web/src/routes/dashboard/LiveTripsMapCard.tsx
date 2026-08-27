import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { MapPin } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { env } from '@/lib/env';
import { listTrips, type Trip } from '@/lib/api/trips';
import { useAuthStore } from '@/stores/auth.store';

interface LiveLocation {
  lat: number;
  lng: number;
  heading_degrees?: number;
  speed_mps?: number;
  timestamp: number;
}

const NAIROBI_CENTER: [number, number] = [-1.2864, 36.8219];

function socketBaseUrl(): string {
  if (env.apiUrl) return env.apiUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

export function LiveTripsMapCard() {
  const token = useAuthStore((s) => s.accessToken);
  const [locations, setLocations] = useState<Record<string, LiveLocation>>({});

  const tripsQuery = useQuery({
    queryKey: ['dashboard-live-trips'],
    queryFn: () => listTrips({ status: 'in_progress', page: 1, pageSize: 25 }),
    refetchInterval: 30_000,
  });

  const activeTrips = tripsQuery.data?.data ?? [];

  useEffect(() => {
    if (!token || activeTrips.length === 0) return;

    const socket: Socket = io(`${socketBaseUrl()}/ws`, {
      transports: ['websocket'],
      auth: { token },
    });

    const subscribeAll = () => {
      for (const trip of activeTrips) {
        socket.emit('trip.subscribe', { tripId: trip.id });
      }
    };

    socket.on('connect', subscribeAll);
    socket.on('trip.location', (payload: LiveLocation & { tripId?: string }) => {
      const tripId = payload.tripId;
      if (!tripId) return;
      setLocations((prev) => ({
        ...prev,
        [tripId]: payload,
      }));
    });

    subscribeAll();

    return () => {
      socket.off('connect', subscribeAll);
      socket.off('trip.location');
      socket.close();
    };
  }, [token, activeTrips]);

  const points = useMemo(() => {
    return activeTrips
      .map((trip) => {
        const loc = locations[trip.id];
        if (!loc) return null;
        return { trip, loc };
      })
      .filter((x): x is { trip: Trip; loc: LiveLocation } => !!x);
  }, [activeTrips, locations]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Live map</CardTitle>
        <CardDescription>Vehicle locations streamed over Socket.IO for active trips.</CardDescription>
      </CardHeader>
      <CardContent>
        {tripsQuery.isLoading ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading active trips...</div>
        ) : tripsQuery.isError ? (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-7 w-7 text-muted-foreground/40" />
            Could not load active trips.
          </div>
        ) : activeTrips.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-7 w-7 text-muted-foreground/40" />
            No in-progress trips right now.
          </div>
        ) : (
          <div className="h-72 overflow-hidden rounded-md border border-border">
            <MapContainer center={NAIROBI_CENTER} zoom={12} className="h-full w-full">
              <TileLayer url={env.mapTileUrl} attribution={env.mapAttribution} />
              {points.map(({ trip, loc }) => (
                <CircleMarker
                  key={trip.id}
                  center={[loc.lat, loc.lng]}
                  radius={8}
                  pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.9 }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-semibold">{trip.vehicle?.registration ?? trip.vehicleId}</p>
                      <p>{trip.route?.name ?? trip.routeId}</p>
                      <p>Speed: {loc.speed_mps ? `${Math.round(loc.speed_mps * 3.6)} km/h` : '—'}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
