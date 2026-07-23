import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Bell, Clock, Globe2, Palette } from 'lucide-react';
import {
  DATE_FORMATS,
  DEFAULT_PREFERENCES,
  LOCALES,
  THEMES,
  type UserPreferences,
} from '@safari-shule/shared-types';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormActions } from '@/components/ui/form-actions';
import { getPreferences, updatePreferences } from '@/lib/api/me';
import { useUiStore } from '@/stores/ui.store';

const LOCALE_LABELS: Record<string, string> = {
  'en-KE': 'English (Kenya)',
  'sw-KE': 'Kiswahili',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
};

const DIGEST_OPTIONS: { value: 'off' | 'daily' | 'weekly'; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'No digest emails' },
  { value: 'daily', label: 'Daily', hint: 'Once every morning' },
  { value: 'weekly', label: 'Weekly', hint: 'Every Monday' },
];

const COMMON_TIMEZONES = [
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Dar_es_Salaam',
  'Africa/Kigali',
  'Africa/Addis_Ababa',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Kolkata',
  'America/New_York',
  'UTC',
];

/**
 * Personal preferences — appearance, locale, formatting, notification channels.
 * Persisted server-side so they follow the user across devices. Theme
 * changes update the local UI store immediately for instant feedback.
 */
export function PreferencesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setUiTheme = useUiStore((s) => s.setTheme);

  const prefsQuery = useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
  });

  const [draft, setDraft] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (prefsQuery.data) {
      setDraft(prefsQuery.data);
      setDirty(false);
    }
  }, [prefsQuery.data]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<UserPreferences>) => updatePreferences(patch),
    onSuccess: (saved) => {
      toast.success('Preferences saved.');
      setDraft(saved);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setUiTheme(saved.theme);
      navigate('/');
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? 'Could not save preferences.'
          : 'Could not save preferences.';
      toast.error(message);
    },
  });

  const patch = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const patchNotif = <K extends keyof UserPreferences['notifications']>(
    key: K,
    value: UserPreferences['notifications'][K],
  ) => {
    setDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));
    setDirty(true);
  };

  const onCancel = () => {
    if (prefsQuery.data) {
      setDraft(prefsQuery.data);
      setDirty(false);
    }
  };
  const onSave = () => mutation.mutate(draft);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Preferences"
        description="Personal appearance, locale and notification settings. Synced to your account."
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4" /> Appearance
            </CardTitle>
            <CardDescription>Theme applies immediately.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="theme">Theme</Label>
              <Select
                id="theme"
                value={draft.theme}
                onChange={(e) => patch('theme', e.target.value as UserPreferences['theme'])}
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'system' ? 'Match system' : t === 'dark' ? 'Dark' : 'Light'}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" /> Locale &amp; formatting
            </CardTitle>
            <CardDescription>Controls how dates, times and numbers are shown.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="locale">Language</Label>
              <Select
                id="locale"
                value={draft.locale}
                onChange={(e) => patch('locale', e.target.value as UserPreferences['locale'])}
              >
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_LABELS[l] ?? l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timeZone">Time zone</Label>
              <Select
                id="timeZone"
                value={draft.timeZone}
                onChange={(e) => patch('timeZone', e.target.value)}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateFormat">Date format</Label>
              <Select
                id="dateFormat"
                value={draft.dateFormat}
                onChange={(e) =>
                  patch('dateFormat', e.target.value as UserPreferences['dateFormat'])
                }
              >
                {DATE_FORMATS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end justify-between rounded-md border border-input px-3 py-2">
              <div>
                <Label htmlFor="time24h" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> 24-hour time
                </Label>
                <p className="text-xs text-muted-foreground">
                  {draft.time24h ? '14:30' : '2:30 PM'}
                </p>
              </div>
              <Switch
                id="time24h"
                checked={draft.time24h}
                onCheckedChange={(v) => patch('time24h', v)}
                aria-label="Use 24-hour time"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
            <CardDescription>
              Which channels you receive alerts on. Doesn't affect emergency SOS alerts —
              those always go through every enabled channel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Email notifications"
              hint="Trip summaries, incident recaps, admin actions"
              checked={draft.notifications.email}
              onCheckedChange={(v) => patchNotif('email', v)}
            />
            <ToggleRow
              label="SMS notifications"
              hint="Urgent-only. Charged per message on your tenant plan."
              checked={draft.notifications.sms}
              onCheckedChange={(v) => patchNotif('sms', v)}
            />
            <ToggleRow
              label="Push notifications"
              hint="Browser and mobile app push"
              checked={draft.notifications.push}
              onCheckedChange={(v) => patchNotif('push', v)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="digest">Digest frequency</Label>
              <Select
                id="digest"
                value={draft.notifications.digestFrequency}
                onChange={(e) =>
                  patchNotif(
                    'digestFrequency',
                    e.target.value as UserPreferences['notifications']['digestFrequency'],
                  )
                }
              >
                {DIGEST_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.hint}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <FormActions
        submitLabel="Save preferences"
        onCancel={onCancel}
        submitting={mutation.isPending}
        disabled={!dirty}
        submitButtonProps={{ onClick: onSave }}
        className="mt-6 rounded-xl border"
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-input px-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
