const EARTH_RADIUS_IN_METERS: f64 = 6371000.0;
const MAX_POINTS: f64 = 1000.0;
const FULL_POINTS_RADIUS_IN_METERS: f64 = 300.0;
const DECAY_IN_METERS: f64 = 1500000.0;
pub const TOTAL_NAMES: u32 = 59_383;

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
    // TODO: rounds 1 and 2 → (1, 1_000)
    //       rounds 3 and 4 → (1, 10_000)
    //       round 5        → (1, TOTAL_NAMES)
    //       anything else  → None
    match round {
        1 | 2 => Some((1 as u32, 1000 as u32)),
        3 | 4 => Some((1 as u32, 10000 as u32)),
        5 => Some((1 as u32, TOTAL_NAMES)),
        _ => None,
    }
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
}
