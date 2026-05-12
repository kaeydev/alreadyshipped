// api/get-rates.js
// This file runs secretly on Vercel's servers — visitors cannot see your API key

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    fromZip, fromCity, fromState,
    toZip,   toCity,   toState,
    weight,  length,   width,   height
  } = req.body;

  if (!fromZip || !toZip || !weight) {
    return res.status(400).json({ error: "fromZip, toZip and weight are required." });
  }

  try {
    // Step 1: Create a shipment on EasyPost
    const createResp = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Your API key is stored safely in Vercel environment variables
        "Authorization": "Basic " + btoa(process.env.EASYPOST_API_KEY + ":")
      },
      body: JSON.stringify({
        shipment: {
          from_address: {
            city:    fromCity  || "New York",
            state:   fromState || "NY",
            zip:     fromZip,
            country: "US"
          },
          to_address: {
            city:    toCity  || "Los Angeles",
            state:   toState || "CA",
            zip:     toZip,
            country: "US"
          },
          parcel: {
            weight: parseFloat(weight) * 16, // EasyPost uses ounces
            length: parseFloat(length) || 6,
            width:  parseFloat(width)  || 6,
            height: parseFloat(height) || 6
          }
        }
      })
    });

    const shipment = await createResp.json();

    if (!createResp.ok) {
      throw new Error(shipment.error?.message || "EasyPost error");
    }

    // Step 2: Format rates for the frontend
    const rates = (shipment.rates || []).map(r => ({
      carrier:    r.carrier,
      service:    r.service,
      price:      parseFloat(r.rate),
      currency:   r.currency,
      delivery:   r.est_delivery_days
        ? (r.est_delivery_days === 1 ? "Next day" : `${r.est_delivery_days} days`)
        : "Varies",
      rateId:     r.id,
      shipmentId: shipment.id
    }));

    // Sort cheapest first
    rates.sort((a, b) => a.price - b.price);

    return res.status(200).json({ rates });

  } catch (err) {
    console.error("EasyPost error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to fetch rates" });
  }
}
