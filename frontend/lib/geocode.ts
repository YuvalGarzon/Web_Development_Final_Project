export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
    try {
        const res = await fetch(
            `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        if (!res.ok) return null;
        const json = await res.json();
        const props = json?.features?.[0]?.properties;
        if (!props) return null;
        return props.name || props.street || props.district || props.suburb || props.city || null;
    } catch {
        return null;
    }
}
