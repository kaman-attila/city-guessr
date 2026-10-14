use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::writeln;

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

#[derive(Debug)]
struct NameRow {
    id: u32,
    name: String,
    first_city: u32,
    city_count: u32,
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

fn sql_str(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

fn write_sql(prefix: &str, header: &str, values: &[String]) -> std::io::Result<()> {
    for (file_no, file_rows) in values.chunks(25_000).enumerate() {
        let path = format!("out/{prefix}_{:03}.sql", file_no + 1);
        let mut w = BufWriter::new(File::create(&path)?);

        for stmt_rows in file_rows.chunks(300) {
            writeln!(w, "{}", header)?;
            writeln!(w, "{};", stmt_rows.join(",\n"))?;
        }

        w.flush()?;
        println!("wrote {path}");
    }
    Ok(())
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

    let mut name_rows: Vec<NameRow> = Vec::new();
    let mut city_rows: Vec<(u32, City)> = Vec::new();
    let mut next_city_id: u32 = 1;

    for (i, (_key, list)) in sorted_cities.into_iter().enumerate() {
        let name_id = (i + 1) as u32;
        let first_city = next_city_id;
        let city_count = list.len() as u32;
        let display_name = list[0].name.clone();

        name_rows.push(NameRow {
            id: name_id,
            name: display_name,
            first_city,
            city_count,
        });

        for city in list {
            city_rows.push((next_city_id, city));
            next_city_id += 1
        }
    }

    println!("names: {}, cities: {}", name_rows.len(), city_rows.len());
    println!("last city id: {}", next_city_id - 1);

    if let Some(n) = name_rows
        .iter()
        .find(|n| n.name.to_lowercase() == "santa cruz")
    {
        println!("{:?}", n);
        let start = (n.first_city - 1) as usize;
        for (id, c) in &city_rows[start..start + n.city_count as usize] {
            println!("  {id}: {} ({})", c.name, c.country);
        }
    }

    let name_values: Vec<String> = name_rows
        .iter()
        .map(|n| {
            format!(
                "({}, {}, {}, {})",
                n.id,
                sql_str(&n.name),
                n.first_city,
                n.city_count
            )
        })
        .collect();

    let city_values: Vec<String> = city_rows
        .iter()
        .map(|(id, c)| {
            format!(
                "({}, {}, {}, {}, {}, {})",
                id,
                sql_str(&c.name),
                c.lat,
                c.lon,
                sql_str(&c.country),
                c.population
            )
        })
        .collect();

    std::fs::create_dir_all("out")?;
    write_sql(
        "names",
        "INSERT INTO names (id, name, first_city, city_count) VALUES",
        &name_values,
    )?;
    write_sql(
        "cities",
        "INSERT INTO cities (id, name, lat, lon, country, population) VALUES",
        &city_values,
    )?;
    Ok(())
}
