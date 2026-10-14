use std::fs::File;
use std::io::{BufRead, BufReader};
use std::collections::HashMap;
use std::vec;

#[derive(Debug)]
struct City {
    name: String,
    ascii: String,
    lat: f64,
    lon: f64,
    feature_code: String,
    country: String,
    population: u64,
}

fn parse_city(line: &str) -> City {
    let columns: Vec<&str> = line.split('\t').collect();

    City {
        name: columns[1].to_string(),
        ascii: columns[2].to_string(),
        lat: columns[4].parse::<f64>().unwrap(),
        lon: columns[5].parse::<f64>().unwrap(),
        feature_code: columns[7].to_string(),
        country: columns[8].to_string(),
        population: columns[14].parse::<u64>().unwrap(),
    }
}

fn main() -> std::io::Result<()> {
    let file = File::open("data/cities5000.txt")?;
    let reader = BufReader::new(file);

    let mut cities: Vec<City> = Vec::new();
    for line in reader.lines() {
        let city = parse_city(&line?);
        if city.feature_code == "PPLX" {
            continue;
        }
        cities.push(city);
    }
    println!("cities: {}", cities.len());

    let mut city_groups: HashMap<String, Vec<City>> = HashMap::new();
    for city in cities {
        let key = city.ascii.to_lowercase();
        city_groups.entry(key).or_default().push(city);
    }
    println!("groups: {}", city_groups.len());

    for list in city_groups.values_mut() {
        list.sort_by(|city_a, city_b| city_b.population.cmp(&city_a.population));
    }

    let mut sorted_cities: Vec<(String, Vec<City>)> = city_groups.into_iter().collect();

    sorted_cities.sort_by(|a, b| {
            b.1[0]
            .population
            .cmp(&a.1[0].population)
            .then_with(|| a.0.cmp(&b.0))
    });

    for (key, list) in sorted_cities.iter().take(5) {
        println!(
            "{} ({key}): {} pop, {} cities",
            list[0].name,
            list[0].population,
            list.len()
        );
    }

    Ok(())
}
