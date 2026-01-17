/**
 * Google Calendar Service
 * Handles Google Calendar API operations for syncing appointments
 * Copied from MCP salon-mcp-server for direct calendar sync
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

export interface CalendarServiceOptions {
  accessToken: string;
  refreshToken?: string;
  onTokenRefresh?: (tokens: TokenRefreshResult) => Promise<void>;
  // Auth method determines which client credentials to use
  authMethod?: 'ios' | 'web';
}

// iOS client ID (no secret needed - uses PKCE)
const IOS_CLIENT_ID = '93060139470-e7ruvtjjo8ntjoncsqhsj7f88n00r58l.apps.googleusercontent.com';

export class CalendarService {
  private oauth2Client: OAuth2Client;
  private onTokenRefresh?: (tokens: TokenRefreshResult) => Promise<void>;

  constructor(options: CalendarServiceOptions) {
    const { accessToken, refreshToken, onTokenRefresh, authMethod } = options;

    // Use iOS client (no secret) or web client based on auth method
    const clientId = authMethod === 'ios'
      ? IOS_CLIENT_ID
      : process.env.GOOGLE_CLIENT_ID;

    // iOS OAuth doesn't use client_secret (PKCE flow)
    const clientSecret = authMethod === 'ios'
      ? undefined
      : process.env.GOOGLE_CLIENT_SECRET;

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.onTokenRefresh = onTokenRefresh;

    console.log(`Calendar: Using ${authMethod || 'web'} OAuth client`);

    // Listen for token refresh events
    this.oauth2Client.on('tokens', async (tokens) => {
      console.log('Calendar: Token refreshed automatically');
      if (this.onTokenRefresh && tokens.access_token) {
        await this.onTokenRefresh({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiryDate: tokens.expiry_date || undefined,
        });
      }
    });
  }

  /**
   * Create calendar event
   */
  async createEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<{ eventId: string }> {
    console.log('Calendar: Creating event:', event.summary);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log('Calendar: Event created with ID:', response.data.id);
    return {
      eventId: response.data.id!,
    };
  }

  /**
   * Calculate end time from start time and duration
   */
  static calculateEndTime(startTime: string, durationMinutes: number): string {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    return end.toISOString();
  }

  /**
   * Build calendar event from booking data
   */
  static buildEventFromBooking(booking: {
    customer_name: string;
    service: string;
    appointment_time: string;
    duration_minutes: number;
    location?: string;
  }): CalendarEvent {
    const endTime = this.calculateEndTime(booking.appointment_time, booking.duration_minutes);

    return {
      summary: `${booking.service} - ${booking.customer_name}`,
      description: `StyleSeat booking\nService: ${booking.service}\nClient: ${booking.customer_name}`,
      location: booking.location,
      start: {
        dateTime: booking.appointment_time,
        timeZone: 'America/New_York', // Default timezone
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/New_York',
      },
    };
  }
}
