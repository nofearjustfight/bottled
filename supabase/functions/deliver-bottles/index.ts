import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function generateDeliveryEmail(bottle: {
  sender_email: string;
  message: string;
  created_at: string;
  theme: string;
  bottle_color: string;
}): string {
  const sentDate = formatDate(bottle.created_at);
  const escapedMessage = escapeHtml(bottle.message);
  
  const messageStyle = bottle.theme === "parchment"
    ? "font-family: Georgia, serif; background-color: #f5e7c9; padding: 20px; border-radius: 4px;"
    : "font-family: 'Courier New', monospace; background-color: #fff9e6; padding: 20px; border-radius: 4px;";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <svg width="40" height="40" viewBox="0 0 64 64">
          <path fill="${bottle.bottle_color}" d="M26 6h12v6c0 1.2.5 2.3 1.3 3.1l3.2 3.2c1.7 1.7 2.7 4 2.7 6.4V52c0 3.3-2.7 6-6 6H25c-3.3 0-6-2.7-6-6V28.7c0-2.4 1-4.7 2.7-6.4l3.2-3.2c.8-.8 1.3-1.9 1.3-3.1V6z"/>
        </svg>
      </div>
      <h1 style="text-align: center; color: #2c3e50; margin-bottom: 20px;">A message in a bottle has arrived</h1>
      <p style="color: #555; margin-bottom: 5px;"><strong>From:</strong> ${bottle.sender_email || "Anonymous"}</p>
      <p style="color: #888; margin-bottom: 20px;"><strong>Sent on:</strong> ${sentDate}</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <div style="${messageStyle}">
        ${escapedMessage}
      </div>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="text-align: center; color: #888; font-size: 12px;">
        This message was sent using Bottled — <a href="https://bottled.to" style="color: #3498db;">bottled.to</a>
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date().toISOString().split("T")[0];

  const { data: bottles, error: fetchError } = await supabase
    .from("bottles")
    .select("*")
    .lte("delivery_date", today)
    .eq("status", "pending");

  if (fetchError) {
    console.error("Error fetching bottles:", fetchError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch pending bottles" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!bottles || bottles.length === 0) {
    console.log("No pending bottles to deliver");
    return new Response(
      JSON.stringify({ delivered: 0, failed: 0, message: "No pending bottles" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Found ${bottles.length} bottles to deliver`);

  let delivered = 0;
  let failed = 0;

  for (const bottle of bottles) {
    try {
      const emailHtml = generateDeliveryEmail(bottle);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Bottled <noreply@bottled.to>",
          to: [bottle.recipient_email],
          subject: "A message in a bottle has arrived 🍾",
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error(`Failed to send email for bottle ${bottle.id}:`, errorText);
        
        await supabase
          .from("bottles")
          .update({ status: "failed" })
          .eq("id", bottle.id);
        
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("bottles")
        .update({ 
          status: "delivered", 
          delivered_at: new Date().toISOString() 
        })
        .eq("id", bottle.id);

      if (updateError) {
        console.error(`Failed to update bottle ${bottle.id}:`, updateError);
        failed++;
        continue;
      }

      console.log(`Delivered bottle ${bottle.id} to ${bottle.recipient_email}`);
      delivered++;

    } catch (e) {
      console.error(`Error processing bottle ${bottle.id}:`, e);
      failed++;
    }
  }

  console.log(`Delivery complete: ${delivered} delivered, ${failed} failed`);

  return new Response(
    JSON.stringify({ delivered, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
