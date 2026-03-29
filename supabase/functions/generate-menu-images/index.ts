import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get menu items without images (null or empty string)
    const { data: menuItems, error } = await supabaseClient
      .from('menu_items')
      .select('id, name, description')
      .or('image_url.is.null,image_url.eq.');

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    console.log(`Found ${menuItems?.length || 0} items without images`);

    if (!menuItems || menuItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All menu items already have images',
          processed: 0,
          results: [] 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const results = [];
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY is not set');
      throw new Error('API key not configured');
    }

    // Process up to 5 items at a time to avoid timeout
    const itemsToProcess = menuItems.slice(0, 5);

    for (const item of itemsToProcess) {
      try {
        console.log(`Generating image for: ${item.name}`);

        // Generate image using Lovable AI
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: `Generate a high-quality, appetizing food photography image of ${item.name}. ${item.description ? `Description: ${item.description}` : ''}. The image should be professional, well-lit, and make the food look delicious. Restaurant menu style, top-down or 45-degree angle view.`,
              },
            ],
            modalities: ['image', 'text'],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        console.log('AI response received for:', item.name);
        
        const imageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageBase64) {
          console.error('No image data received from AI for:', item.name);
          throw new Error('No image generated');
        }

        // Convert base64 to blob
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Upload to Supabase Storage
        const fileName = `menu/${item.id}-${Date.now()}.png`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient
          .storage
          .from('restaurant-images')
          .upload(fileName, binaryData, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseClient
          .storage
          .from('restaurant-images')
          .getPublicUrl(fileName);

        // Update menu item with image URL
        const { error: updateError } = await supabaseClient
          .from('menu_items')
          .update({ image_url: publicUrl })
          .eq('id', item.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }

        results.push({ id: item.id, name: item.name, success: true, url: publicUrl });
        console.log(`Successfully generated image for: ${item.name}`);
      } catch (itemError) {
        const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
        console.error(`Error generating image for ${item.name}:`, errorMessage);
        results.push({ id: item.id, name: item.name, success: false, error: errorMessage });
      }
    }

    const remaining = menuItems.length - itemsToProcess.length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        remaining: remaining,
        message: remaining > 0 ? `${remaining} more items need images. Run again to continue.` : 'All done!',
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate images',
        details: 'Check edge function logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
