import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { latitude, longitude, address } = body;

    // Forward geocoding: address → lat/lng
    if (address && !latitude && !longitude) {
      return await forwardGeocode(address, corsHeaders);
    }

    // Reverse geocoding: lat/lng → address
    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude (or address) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Maps API key from secrets
    const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!googleMapsApiKey) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return await fallbackToOSM(latitude, longitude, corsHeaders);
    }

    // Use Google Maps Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapsApiKey}`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const result = data.results[0];
      const addressComponents = result.address_components || [];
      
      let streetNumber = "";
      let route = "";
      let city = "";
      let country = "";

      for (const component of addressComponents) {
        if (component.types.includes("street_number")) {
          streetNumber = component.long_name;
        } else if (component.types.includes("route")) {
          route = component.long_name;
        } else if (component.types.includes("locality")) {
          city = component.long_name;
        } else if (component.types.includes("country")) {
          country = component.short_name;
        }
      }

      const street = [streetNumber, route].filter(Boolean).join(" ");
      const shortAddress = [street, city].filter(Boolean).join(", ") || "Current location";
      
      return new Response(
        JSON.stringify({
          address: shortAddress,
          fullAddress: result.formatted_address,
          city,
          country,
          latitude,
          longitude,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return await fallbackToOSM(latitude, longitude, corsHeaders);

  } catch (error) {
    console.error("Geocoding error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to geocode location", address: "Current location" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Forward geocode: address string → lat/lng coordinates
 */
async function forwardGeocode(address: string, corsHeaders: Record<string, string>) {
  const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

  if (googleMapsApiKey) {
    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (data.status === "OK" && data.results?.length > 0) {
        const result = data.results[0];
        const location = result.geometry?.location;
        if (location) {
          return new Response(
            JSON.stringify({
              address: result.formatted_address || address,
              latitude: location.lat,
              longitude: location.lng,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (err) {
      console.warn("Google forward geocode failed, trying OSM:", err);
    }
  }

  // Fallback to OpenStreetMap Nominatim
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(osmUrl, {
      headers: { "User-Agent": "FranchiseFeasts/1.0" },
    });
    const data = await response.json();

    if (data?.length > 0) {
      return new Response(
        JSON.stringify({
          address: data[0].display_name || address,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.warn("OSM forward geocode failed:", err);
  }

  return new Response(
    JSON.stringify({ error: "Could not geocode address", address }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function fallbackToOSM(latitude: number, longitude: number, corsHeaders: Record<string, string>) {
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    const response = await fetch(osmUrl, {
      headers: { "User-Agent": "FranchiseFeasts/1.0" }
    });
    const data = await response.json();

    if (data.address) {
      const parts = [
        data.address.road || data.address.hamlet,
        data.address.city || data.address.town || data.address.village
      ].filter(Boolean);
      const addr = parts.join(", ") || "Current location";
      
      return new Response(
        JSON.stringify({
          address: addr,
          fullAddress: data.display_name,
          city: data.address.city || data.address.town || data.address.village || "",
          country: data.address.country_code?.toUpperCase() || "",
          latitude,
          longitude,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ address: "Current location", latitude, longitude }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ address: "Current location", latitude, longitude }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}