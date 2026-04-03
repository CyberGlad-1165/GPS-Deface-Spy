import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, websites, alerts, stats } = await req.json();

    if (!to) {
      return new Response(JSON.stringify({ error: 'Recipient email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalAlerts = alerts?.length || 0;
    const resolved = alerts?.filter((a: any) => a.resolved).length || 0;
    const totalSites = websites?.length || 0;

    const htmlBody = `
      <div style="font-family: 'Courier New', monospace; background: #0f172a; color: #e2e8f0; padding: 32px; max-width: 600px; margin: 0 auto;">
        <div style="border: 1px solid #1e3a5f; border-radius: 12px; padding: 24px; background: #0c1929;">
          <h1 style="color: #3b82f6; font-size: 20px; margin: 0 0 8px;">DEFACE SPY REPORT</h1>
          <p style="color: #64748b; font-size: 12px; margin: 0 0 24px;">Generated: ${new Date().toISOString()}</p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
              <p style="color: #64748b; font-size: 10px; margin: 0;">TARGETS</p>
              <p style="color: #f8fafc; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${totalSites}</p>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
              <p style="color: #64748b; font-size: 10px; margin: 0;">ALERTS</p>
              <p style="color: #f8fafc; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${totalAlerts}</p>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
              <p style="color: #64748b; font-size: 10px; margin: 0;">RESOLVED</p>
              <p style="color: #22c55e; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${resolved}</p>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
              <p style="color: #64748b; font-size: 10px; margin: 0;">PENDING</p>
              <p style="color: #ef4444; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${totalAlerts - resolved}</p>
            </div>
          </div>

          ${websites?.map((w: any) => `
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 8px;">
              <p style="color: #f8fafc; font-size: 14px; font-weight: bold; margin: 0;">${w.name}</p>
              <p style="color: #3b82f6; font-size: 11px; margin: 4px 0 0;">${w.url}</p>
              <p style="color: #64748b; font-size: 10px; margin: 4px 0 0;">Status: ${w.status?.toUpperCase()} | Frames: ${w.framesAnalyzed}</p>
            </div>
          `).join('') || ''}

          <p style="color: #475569; font-size: 10px; text-align: center; margin-top: 24px;">Deface Spy — Automated Monitoring Report</p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Deface Spy <onboarding@resend.dev>',
        to: [to],
        subject: `Deface Spy Report — ${new Date().toLocaleDateString()}`,
        html: htmlBody,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify(result));
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Send report error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
