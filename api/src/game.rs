use sha2::{Digest, Sha256};

const EARTH_RADIUS_IN_METERS: f64 = 6371000.0;
const MAX_POINTS: f64 = 1000.0;
const FULL_POINTS_RADIUS_IN_METERS: f64 = 5000.0;
const DECAY_IN_METERS: f64 = 1500000.0;
pub const TOTAL_NAMES: u32 = 59383;
pub const BUCKET_SIZE: u32 = 250;
pub const BUCKETS: u32 = 20;

pub struct SplitMix64(u64);

impl SplitMix64 {
    pub fn new(seed: u64) -> Self {
        SplitMix64(seed)
    }

    pub fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
}

pub fn score(distance: f64) -> u32 {
    if distance <= FULL_POINTS_RADIUS_IN_METERS {
        return MAX_POINTS as u32;
    }

    (MAX_POINTS * (-(distance - FULL_POINTS_RADIUS_IN_METERS) / DECAY_IN_METERS).exp()).round()
        as u32
}

pub fn distance_in_meters(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let fi1 = lat1.to_radians();
    let fi2 = lat2.to_radians();
    let delta_fi: f64 = fi2 - fi1;
    let delta_lambda: f64 = lon2.to_radians() - lon1.to_radians();
    let a: f64 =
        (delta_fi / 2.0).sin().powi(2) + fi1.cos() * fi2.cos() * (delta_lambda / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_IN_METERS * a.sqrt().asin()
}

pub fn id_range_for_round(round: u32) -> Option<(u32, u32)> {
    match round {
        1 => Some((1, 200)),
        2 => Some((201, 1000)),
        3 => Some((1001, 5000)),
        4 => Some((5001, 10000)),
        5 => Some((10001, TOTAL_NAMES)),
        _ => None
    }
}

pub fn closest(lat: f64, lon: f64, points: &[(f64, f64)]) -> Option<(usize, f64)> {
    points
        .iter()
        .enumerate()
        .map(|(i, &(p_lat, p_lon))| (i, distance_in_meters(lat, lon, p_lat, p_lon)))
        .min_by(|city_a, city_b| city_a.1.total_cmp(&city_b.1))
}

pub fn daily_seed(secret: &str, date: &str) -> u64 {
    let hash = Sha256::digest(format!("{secret}:{date}"));
    u64::from_le_bytes(hash[..8].try_into().unwrap())
}

pub fn daily_name_ids(seed: u64) -> [u32; 5] {
    let mut rng = SplitMix64::new(seed);
    let mut ids = [0u32; 5];
    for round in 1..=5 {
        let (min, max) = id_range_for_round(round).unwrap();
        let count = (max - min + 1) as u64;
        let id = loop {
            let id = min + (rng.next_u64() % count) as u32;
            if !ids.contains(&id) {
                break id;
            }
        };
        ids[round as usize - 1] = id;
    }
    ids
}

pub fn bucket_for(score: u32) -> u32 {
    (score / BUCKET_SIZE).min(BUCKETS - 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vienna_to_budapest() {
        let d = distance_in_meters(48.2085, 16.3721, 47.4979, 19.0402);
        assert!((d - 214_200.0).abs() < 1_000.0, "got {d}");
    }

    #[test]
    fn same_point_is_zero() {
        assert!(distance_in_meters(10.0, 20.0, 10.0, 20.0) < 0.001);
    }

    #[test]
    fn full_points_inside_radius() {
        assert_eq!(score(0.0), 1000);
        assert_eq!(score(300.0), 1000);
    }

    #[test]
    fn daily_name_ids_are_unique_and_in_range() {
        for seed in 0..1000 {
            let ids = daily_name_ids(seed);
            for (i, &id) in ids.iter().enumerate() {
                let (min, max) = id_range_for_round(i as u32 + 1).unwrap();
                assert!(
                    (min..=max).contains(&id),
                    "seed {seed}: id {id} out of range"
                );
                assert!(!ids[..i].contains(&id), "seed {seed}: duplicate id {id}");
            }
        }
    }

    #[test]
    fn round_ranges_get_harder_and_cover_every_name() {
        let mut next_min = 1;
        for round in 1..=5 {
            let (min, max) = id_range_for_round(round).unwrap();
            assert_eq!(min, next_min, "round {round} should start right after round {}", round - 1);
            assert!(min <= max, "round {round} range is empty");
            next_min = max + 1;
        }
        assert_eq!(next_min - 1, TOTAL_NAMES);
        assert_eq!(id_range_for_round(0), None);
        assert_eq!(id_range_for_round(6), None);
    }

    #[test]
    fn daily_name_ids_are_deterministic() {
        assert_eq!(daily_name_ids(42), daily_name_ids(42));
    }

    #[test]
    fn daily_seeds_are_different() {
        assert!(daily_seed("s", "2026-10-15") != daily_seed("s", "2026-10-16"));
    }
}
