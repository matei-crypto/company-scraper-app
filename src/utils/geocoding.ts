/**
 * Geocoding utilities for calculating distances
 */

// Central London coordinates (City of London)
const CENTRAL_LONDON_LAT = 51.5074;
const CENTRAL_LONDON_LON = -0.1278;

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get distance from Central London for a given address
 * Returns distance in kilometers, or null if geocoding fails
 */
export async function getDistanceFromLondon(
  address: string | undefined,
  structuredAddress?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    region?: string;
    country?: string;
  }
): Promise<number | null> {
  if (!address && !structuredAddress) {
    return null;
  }

  // Build address string from structured address if available
  let addressString = address || '';
  if (structuredAddress && !address) {
    const parts: string[] = [];
    if (structuredAddress.address_line_1) parts.push(structuredAddress.address_line_1);
    if (structuredAddress.address_line_2) parts.push(structuredAddress.address_line_2);
    if (structuredAddress.locality) parts.push(structuredAddress.locality);
    if (structuredAddress.postal_code) parts.push(structuredAddress.postal_code);
    if (structuredAddress.region) parts.push(structuredAddress.region);
    if (structuredAddress.country) parts.push(structuredAddress.country);
    addressString = parts.join(', ');
  }

  if (!addressString.trim()) {
    return null;
  }

  try {
    // Use Nominatim (OpenStreetMap) geocoding API (free, no API key required)
    const encodedAddress = encodeURIComponent(addressString + ', UK');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=gb`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CompanyScraper/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as Array<{ lat: string; lon: string }>;
    
    if (!data || data.length === 0) {
      return null;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    if (isNaN(lat) || isNaN(lon)) {
      return null;
    }

    const distance = calculateDistance(
      CENTRAL_LONDON_LAT,
      CENTRAL_LONDON_LON,
      lat,
      lon
    );

    return distance;
  } catch (error) {
    // Geocoding failed, return null
    return null;
  }
}

/**
 * Calculate location score based on distance from Central London
 * Returns score from 0-25 points
 * - 0-25km: 25 points (within Greater London)
 * - 25-50km: 20 points
 * - 50-100km: 15 points
 * - 100-150km: 10 points
 * - 150-200km: 5 points
 * - 200km+: 0 points
 */
export function calculateLocationScore(distanceKm: number | null): number {
  if (distanceKm === null) {
    return 0; // No location data
  }

  if (distanceKm <= 25) {
    return 25; // Within Greater London
  } else if (distanceKm <= 50) {
    return 20;
  } else if (distanceKm <= 100) {
    return 15;
  } else if (distanceKm <= 150) {
    return 10;
  } else if (distanceKm <= 200) {
    return 5;
  } else {
    return 0; // Too far
  }
}

