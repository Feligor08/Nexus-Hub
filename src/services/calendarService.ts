import { getAccessToken } from './calendarAuth';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  category?: 'ita_school' | 'atruvia' | 'homeserver' | 'exam' | 'project';
}

export const fetchCalendarEvents = async (): Promise<CalendarEvent[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google');
  }

  // Fetch from Google Calendar API
  const now = new Date();
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=50`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google Calendar API error: ${response.statusText}`);
  }

  const data = await response.json();
  const items: CalendarEvent[] = (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || 'Unbenannter Termin',
    description: item.description,
    location: item.location,
    start: item.start || {},
    end: item.end || {},
    htmlLink: item.htmlLink,
  }));

  return items;
};

export const createCalendarEvent = async (eventData: {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
}): Promise<CalendarEvent> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google');
  }

  const payload = {
    summary: eventData.summary,
    description: eventData.description,
    location: eventData.location,
    start: {
      dateTime: new Date(eventData.startDateTime).toISOString(),
    },
    end: {
      dateTime: new Date(eventData.endDateTime).toISOString(),
    },
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create calendar event');
  }

  return await response.json();
};

export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google');
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete calendar event');
  }
};
