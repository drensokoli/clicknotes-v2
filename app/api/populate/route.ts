import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '../../../lib/email-service'

// Force dynamic execution to prevent caching issues
export const dynamic = 'force-dynamic'


// Import the population functions from the cron route
// Note: In a real application, these should be moved to a shared utility file
// For now, we'll import them or duplicate the essential parts

// Helper function to send error notification emails
async function sendErrorNotification(mediaType: string, error: Error | string, operation: string) {
  try {
    const emailConfig = {
      provider: 'resend' as const,
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL || 'noreply@clicknotes.com',
      fromName: 'ClickNotes System'
    };

    if (!emailConfig.apiKey) {
      console.error('[EMAIL] RESEND_API_KEY not configured, cannot send error notification');
      return;
    }

    const subject = `🚨 ClickNotes Manual Population Failed - ${mediaType}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Manual Population Failed</h2>
        <p><strong>Media Type:</strong> ${mediaType}</p>
        <p><strong>Operation:</strong> ${operation}</p>
        <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Stack Trace:</strong></p>
        <pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto;">
          ${error instanceof Error ? error.stack : 'No stack trace available'}
        </pre>
        <p>Please check the server logs and Redis connection immediately.</p>
        <p>Best regards,<br>The ClickNotes System</p>
      </div>
    `;

    const text = `
      Manual Population Failed
      
      Media Type: ${mediaType}
      Operation: ${operation}
      Error: ${error instanceof Error ? error.message : String(error)}
      Timestamp: ${new Date().toISOString()}
      
      Please check the server logs and Redis connection immediately.
      
      Best regards,
      The ClickNotes System
    `;

    // Send to both email addresses
    const recipients = ['drensokoli@gmail.com', 'sokolidren@gmail.com'];
    
    for (const recipient of recipients) {
      await sendEmail(emailConfig, recipient, subject, html, text);
      console.log(`[EMAIL] Error notification sent to ${recipient}`);
    }
    
  } catch (emailError) {
    console.error('[EMAIL] Failed to send error notification:', emailError);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[POPULATE] Manual population request received');
    console.log('[POPULATE] Request URL:', request.url);
    console.log('[POPULATE] Request headers:', Object.fromEntries(request.headers.entries()));
    
    const body = await request.json();
    console.log('[POPULATE] Request body received:', {
      hasBody: !!body,
      bodyKeys: body ? Object.keys(body) : [],
      action: body?.action
    });
    
    const { action } = body;
    console.log(`[POPULATE] Processing action: ${action}`);
    
    // Basic authentication check - you might want to add proper auth here
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Unauthorized - Bearer token required' 
      }, { status: 401 });
    }
    
    // You can add token validation here
    // For now, just check if a token is present
    const token = authHeader.substring(7);
    if (!token) {
      return NextResponse.json({ 
        error: 'Unauthorized - Invalid token' 
      }, { status: 401 });
    }
    
    if (action === 'populate-all') {
      console.log('[POPULATE] Starting complete manual data population...');
      
      const tmdbApiKey = process.env.TMDB_API_KEY!
      const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
      const nyTimesApiKey = process.env.NYTIMES_API_KEY!
      const omdbApiKeys = [
        process.env.OMDB_API_KEY_1!,
        process.env.OMDB_API_KEY_2!,
        process.env.OMDB_API_KEY_3!,
      ]

      console.log('[POPULATE] API Keys available:', {
        tmdb: !!tmdbApiKey,
        tmdbKeyLength: tmdbApiKey?.length || 0,
        googleBooks: !!googleBooksApiKey,
        googleBooksKeyLength: googleBooksApiKey?.length || 0,
        nyTimes: !!nyTimesApiKey,
        nyTimesKeyLength: nyTimesApiKey?.length || 0,
        omdb: omdbApiKeys.filter(k => !!k).length,
        omdbKeys: omdbApiKeys.map((k, i) => ({ index: i, hasKey: !!k, keyLength: k?.length || 0 }))
      });

      // Note: The actual population functions would need to be imported from a shared utility
      // For now, return a placeholder response
      const response = { 
        message: 'Manual population endpoint created',
        note: 'Population functions need to be moved to shared utilities and imported here',
        action: action,
        timestamp: new Date().toISOString()
      };
      
      console.log('[POPULATE] Sending response:', response);
      return NextResponse.json(response);
      
    } else if (action === 'populate-movies') {
      console.log('[POPULATE] Starting manual movies-only population...');
      
      const response = { 
        message: 'Manual movies population endpoint created',
        note: 'Movies population function needs to be imported from shared utility',
        action: action,
        timestamp: new Date().toISOString()
      };
      
      console.log('[POPULATE] Sending movies response:', response);
      return NextResponse.json(response);
      
    } else if (action === 'populate-tvshows') {
      console.log('[POPULATE] Starting manual TV shows-only population...');
      
      const response = { 
        message: 'Manual TV shows population endpoint created',
        note: 'TV shows population function needs to be imported from shared utility',
        action: action,
        timestamp: new Date().toISOString()
      };
      
      console.log('[POPULATE] Sending TV shows response:', response);
      return NextResponse.json(response);
      
    } else if (action === 'populate-books') {
      console.log('[POPULATE] Starting manual books-only population...');
      
      const response = { 
        message: 'Manual books population endpoint created',
        note: 'Books population function needs to be imported from shared utility',
        action: action,
        timestamp: new Date().toISOString()
      };
      
      console.log('[POPULATE] Sending books response:', response);
      return NextResponse.json(response);
    }

    console.log('[POPULATE] Invalid action received:', action);
    console.log('[POPULATE] Valid actions are: populate-all, populate-movies, populate-tvshows, populate-books');
    
    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[POPULATE] Manual population error:', error);
    console.error('[POPULATE] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      requestUrl: request.url
    });
    
    // Send error notification email for manual population failure
    await sendErrorNotification('general', error as Error, 'Manual population process');
    
    return NextResponse.json({ 
      error: 'Failed to populate data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
