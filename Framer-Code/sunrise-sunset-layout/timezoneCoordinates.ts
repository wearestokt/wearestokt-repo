/**
 * Maps IANA timezone identifiers to representative [lat, lng] coordinates.
 * Used for sunrise/sunset calculation when geolocation is not available.
 * Fallback uses region-based defaults for unmapped timezones.
 */

export type Coordinates = [number, number]

/** Region fallbacks: [lat, lng] for America, Europe, Asia, etc. */
const REGION_FALLBACKS: Record<string, Coordinates> = {
    America: [40, -95],
    Europe: [50, 10],
    Asia: [35, 105],
    Africa: [0, 20],
    Australia: [-25, 135],
    Pacific: [-20, -170],
    Antarctica: [-70, 0],
    Atlantic: [30, -30],
    Indian: [20, 80],
}

/** Representative city coordinates for common timezones */
export const TIMEZONE_COORDINATES: Record<string, Coordinates> = {
    // Americas
    "America/New_York": [40.7128, -74.006],
    "America/Chicago": [41.8781, -87.6298],
    "America/Denver": [39.7392, -104.9903],
    "America/Los_Angeles": [34.0522, -118.2437],
    "America/Phoenix": [33.4484, -112.074],
    "America/Anchorage": [61.2181, -149.9003],
    "America/Toronto": [43.6532, -79.3832],
    "America/Vancouver": [49.2827, -123.1207],
    "America/Montreal": [45.5017, -73.5673],
    "America/Halifax": [44.6488, -63.5752],
    "America/St_Johns": [47.5615, -52.7126],
    "America/Winnipeg": [49.8954, -97.1385],
    "America/Edmonton": [53.5461, -113.4938],
    "America/Regina": [50.4452, -104.6189],
    "America/Sao_Paulo": [-23.5505, -46.6333],
    "America/Buenos_Aires": [-34.6037, -58.3816],
    "America/Santiago": [-33.4489, -70.6693],
    "America/Bogota": [4.711, -74.0721],
    "America/Lima": [-12.0464, -77.0428],
    "America/Mexico_City": [19.4326, -99.1332],
    "America/Cancun": [21.1619, -86.8515],
    "America/Havana": [23.1136, -82.3666],
    "America/Panama": [9.0579, -79.5199],
    "America/Caracas": [10.4806, -66.9036],
    // Europe
    "Europe/London": [51.5074, -0.1278],
    "Europe/Paris": [48.8566, 2.3522],
    "Europe/Berlin": [52.52, 13.405],
    "Europe/Amsterdam": [52.3676, 4.9041],
    "Europe/Rome": [41.9028, 12.4964],
    "Europe/Madrid": [40.4168, -3.7038],
    "Europe/Brussels": [50.8503, 4.3517],
    "Europe/Vienna": [48.2082, 16.3738],
    "Europe/Zurich": [47.3769, 8.5417],
    "Europe/Stockholm": [59.3293, 18.0686],
    "Europe/Oslo": [59.9139, 10.7522],
    "Europe/Copenhagen": [55.6761, 12.5683],
    "Europe/Helsinki": [60.1695, 24.9355],
    "Europe/Dublin": [53.3498, -6.2603],
    "Europe/Lisbon": [38.7223, -9.1393],
    "Europe/Athens": [37.9838, 23.7275],
    "Europe/Warsaw": [52.2297, 21.0122],
    "Europe/Prague": [50.0755, 14.4378],
    "Europe/Budapest": [47.4979, 19.0402],
    "Europe/Bucharest": [44.4268, 26.1025],
    "Europe/Moscow": [55.7558, 37.6173],
    "Europe/Istanbul": [41.0082, 28.9784],
    // Asia
    "Asia/Tokyo": [35.6762, 139.6503],
    "Asia/Shanghai": [31.2304, 121.4737],
    "Asia/Hong_Kong": [22.3193, 114.1694],
    "Asia/Singapore": [1.3521, 103.8198],
    "Asia/Seoul": [37.5665, 126.978],
    "Asia/Bangkok": [13.7563, 100.5018],
    "Asia/Jakarta": [-6.2088, 106.8456],
    "Asia/Manila": [14.5995, 120.9842],
    "Asia/Kolkata": [28.6139, 77.209],
    "Asia/Dubai": [25.2048, 55.2708],
    "Asia/Jerusalem": [31.7683, 35.2137],
    "Asia/Riyadh": [24.7136, 46.6753],
    "Asia/Tehran": [35.6892, 51.389],
    "Asia/Almaty": [43.222, 76.8512],
    "Asia/Yekaterinburg": [56.8389, 60.6057],
    "Asia/Vladivostok": [43.1198, 131.8869],
    // Australia & Pacific
    "Australia/Sydney": [-33.8688, 151.2093],
    "Australia/Melbourne": [-37.8136, 144.9631],
    "Australia/Perth": [-31.9505, 115.8605],
    "Australia/Brisbane": [-27.4698, 153.0251],
    "Australia/Adelaide": [-34.9285, 138.6007],
    "Pacific/Auckland": [-36.8509, 174.7645],
    "Pacific/Fiji": [-17.7134, 178.065],
    "Pacific/Honolulu": [21.3099, -157.8581],
    "Pacific/Guam": [13.4443, 144.7937],
    // Africa
    "Africa/Cairo": [30.0444, 31.2357],
    "Africa/Johannesburg": [-26.2041, 28.0473],
    "Africa/Lagos": [6.5244, 3.3792],
    "Africa/Nairobi": [-1.2921, 36.8219],
    "Africa/Casablanca": [33.5731, -7.5898],
}

/**
 * Get [lat, lng] for a timezone. Uses mapped coordinates or region fallback.
 */
export function getCoordinatesForTimezone(timezone: string): Coordinates {
    const mapped = TIMEZONE_COORDINATES[timezone]
    if (mapped) return mapped

    const region = timezone.split("/")[0]
    return REGION_FALLBACKS[region] ?? [0, 0]
}
