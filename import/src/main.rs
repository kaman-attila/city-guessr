use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};

const ROUND_RANKS: [(usize, usize); 5] = [
    (1, 200),
    (201, 1000),
    (1001, 5000),
    (5001, 10000),
    (10001, 29691),
];
const COUNTRY_EXPONENTS: [f64; 5] = [1.0, 1.0, 0.5, 0.5, 0.5];
const UNFILTERED_RANKS: usize = 1000;
const ENGLISH_COUNTRIES: [&str; 6] = ["US", "GB", "CA", "AU", "NZ", "IE"];
const PLACE_WORD_MIN_POPULATION: u64 = 20_000;
const MILITARY_WORDS: [&str; 2] = ["air force base", "cantonment"];
const CITY_PART_TYPES: [&str; 12] = [
    "census-designated place",
    "unincorporated community",
    "neighbourhood",
    "neighborhood",
    "suburb",
    "area of london",
    "district of china",
    "district of taiwan",
    "quarter",
    "ward of japan",
    "ward of vietnam",
    "special ward",
];

#[derive(Debug)]
struct City {
    geoname_id: String,
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
        geoname_id: columns[0].to_string(),
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

fn read_sitelinks() -> std::io::Result<HashMap<String, u32>> {
    let reader = BufReader::new(File::open("data/sitelinks.tsv")?);
    let mut links = HashMap::new();
    for line in reader.lines() {
        let line = line?;
        if let Some((id, count)) = line.split_once('\t') {
            links.insert(id.to_string(), count.parse().unwrap_or(0));
        }
    }
    Ok(links)
}

struct Fame {
    name_id: u32,
    links: u32,
    population: u64,
    country: String,
    skip: Option<&'static str>,
    shown_city: String,
}

fn read_map_names() -> std::io::Result<HashMap<String, String>> {
    let Ok(file) = File::open("data/map_names.tsv") else {
        return Ok(HashMap::new());
    };
    let mut names = HashMap::new();
    for line in BufReader::new(file).lines() {
        let line = line?;
        if let Some((id, name)) = line.split_once('\t')
            && !name.is_empty()
        {
            names.insert(id.to_string(), name.to_string());
        }
    }
    Ok(names)
}

fn write_statements(prefix: &str, statements: &[String]) -> std::io::Result<()> {
    for (file_no, chunk) in statements.chunks(25_000).enumerate() {
        let path = format!("out/{prefix}_{:03}.sql", file_no + 1);
        let mut w = BufWriter::new(File::create(&path)?);
        for statement in chunk {
            writeln!(w, "{statement}")?;
        }
        w.flush()?;
        println!("wrote {path}");
    }
    Ok(())
}

struct Filters {
    types: HashMap<String, String>,
    common_words: HashSet<String>,
}

impl Filters {
    fn load(cities: &[City]) -> std::io::Result<Filters> {
        let mut types = HashMap::new();
        for line in BufReader::new(File::open("data/types.tsv")?).lines() {
            let line = line?;
            if let Some((id, labels)) = line.split_once('\t') {
                types.insert(id.to_string(), labels.to_lowercase());
            }
        }

        let place_words: HashSet<String> = cities
            .iter()
            .filter(|c| c.population >= PLACE_WORD_MIN_POPULATION && !c.ascii.contains(' '))
            .map(|c| c.ascii.to_lowercase())
            .collect();
        let mut common_words = HashSet::new();
        for line in BufReader::new(File::open("data/words/english-10000.txt")?).lines() {
            let word = line?.trim().to_lowercase();
            if word.len() > 1 && !place_words.contains(&word) {
                common_words.insert(word);
            }
        }
        Ok(Filters {
            types,
            common_words,
        })
    }

    fn skip_reason(&self, city: &City) -> Option<&'static str> {
        if city
            .name
            .split([' ', '-'])
            .any(|w| !w.is_empty() && w.chars().all(|c| c.is_ascii_digit()))
        {
            return Some("part of a city");
        }
        let lower = city.name.to_lowercase();
        if MILITARY_WORDS.iter().any(|w| lower.contains(w)) {
            return Some("military base");
        }
        if let Some(labels) = self.types.get(&city.geoname_id)
            && CITY_PART_TYPES.iter().any(|t| labels.contains(t))
            && !labels.contains("city")
        {
            return Some("part of a city");
        }
        let words: Vec<String> = city
            .ascii
            .split([' ', '-'])
            .filter(|w| !w.is_empty())
            .map(str::to_lowercase)
            .collect();
        if ENGLISH_COUNTRIES.contains(&city.country.as_str())
            && words.len() >= 2
            && words.iter().all(|w| self.common_words.contains(w))
        {
            return Some("plain English name");
        }
        None
    }
}

fn round_name_values(mut fame: Vec<Fame>) -> (Vec<String>, Vec<String>) {
    fame.sort_by(|a, b| {
        b.links
            .cmp(&a.links)
            .then(b.population.cmp(&a.population))
            .then(a.name_id.cmp(&b.name_id))
    });

    let mut skipped: HashMap<&str, usize> = HashMap::new();
    let fame: Vec<Fame> = fame
        .into_iter()
        .enumerate()
        .filter(|(rank, name)| match name.skip {
            Some(reason) if *rank >= UNFILTERED_RANKS => {
                *skipped.entry(reason).or_default() += 1;
                false
            }
            _ => true,
        })
        .map(|(_, name)| name)
        .collect();
    println!("left out of the rounds: {skipped:?}");

    let mut values = Vec::new();
    let mut shown_cities = Vec::new();
    for (round, (&(first, last), &exponent)) in
        ROUND_RANKS.iter().zip(&COUNTRY_EXPONENTS).enumerate()
    {
        let pool = &fame[first - 1..last.min(fame.len())];
        let mut per_country: HashMap<&str, usize> = HashMap::new();
        for name in pool {
            *per_country.entry(name.country.as_str()).or_default() += 1;
        }
        let total: f64 = per_country
            .values()
            .map(|&n| (n as f64).powf(exponent))
            .sum();

        let mut cum = 0.0;
        for (i, name) in pool.iter().enumerate() {
            let n = per_country[name.country.as_str()] as f64;
            cum += n.powf(exponent) / total / n;
            let point = if i + 1 == pool.len() { 1.0 } else { cum };
            values.push(format!("({}, {point}, {})", round + 1, name.name_id));
            shown_cities.push(name.shown_city.clone());
        }
        println!(
            "round {}: {} names from {} countries",
            round + 1,
            pool.len(),
            per_country.len()
        );
    }
    (values, shown_cities)
}

fn write_sql(prefix: &str, header: &str, values: &[String]) -> std::io::Result<()> {
    write_sql_after(prefix, None, header, values)
}

fn write_sql_after(
    prefix: &str,
    preamble: Option<&str>,
    header: &str,
    values: &[String],
) -> std::io::Result<()> {
    for (file_no, file_rows) in values.chunks(25_000).enumerate() {
        let path = format!("out/{prefix}_{:03}.sql", file_no + 1);
        let mut w = BufWriter::new(File::create(&path)?);
        if let (0, Some(preamble)) = (file_no, preamble) {
            writeln!(w, "{preamble}")?;
        }

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

    let map_names = read_map_names()?;
    let mut renamed: HashSet<String> = HashSet::new();
    let mut cities: Vec<City> = Vec::new();
    for line in reader.lines() {
        let mut city = parse_city(&line?);
        if city.feature_code == "PPLX" {
            continue;
        }
        if let Some(name) = map_names.get(&city.geoname_id)
            && *name != city.name
        {
            city.name = name.clone();
            renamed.insert(city.geoname_id.clone());
        }
        cities.push(city);
    }
    println!("names spelled like the map: {}", renamed.len());
    println!("cities: {}", cities.len());

    let filters = Filters::load(&cities)?;
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

    let sitelinks = read_sitelinks()?;
    let mut name_rows: Vec<NameRow> = Vec::new();
    let mut city_rows: Vec<(u32, City)> = Vec::new();
    let mut fame: Vec<Fame> = Vec::new();
    let mut next_city_id: u32 = 1;
    let mut renames: Vec<String> = Vec::new();

    for (i, (_key, list)) in sorted_cities.into_iter().enumerate() {
        let name_id = (i + 1) as u32;
        let first_city = next_city_id;
        let city_count = list.len() as u32;
        let display_name = list[0].name.clone();

        let famous = list
            .iter()
            .max_by_key(|c| {
                (
                    sitelinks.get(&c.geoname_id).copied().unwrap_or(0),
                    c.population,
                )
            })
            .unwrap();
        fame.push(Fame {
            name_id,
            links: sitelinks.get(&famous.geoname_id).copied().unwrap_or(0),
            population: famous.population,
            country: famous.country.clone(),
            skip: filters.skip_reason(famous),
            shown_city: format!(
                "{}\t{}\t{}\t{}",
                list[0].geoname_id, list[0].lat, list[0].lon, list[0].name
            ),
        });
        if renamed.contains(&list[0].geoname_id) {
            renames.push(format!(
                "UPDATE names SET name = {} WHERE id = {name_id};",
                sql_str(&display_name)
            ));
        }

        name_rows.push(NameRow {
            id: name_id,
            name: display_name,
            first_city,
            city_count,
        });

        for city in list {
            if renamed.contains(&city.geoname_id) {
                renames.push(format!(
                    "UPDATE cities SET name = {} WHERE id = {next_city_id};",
                    sql_str(&city.name)
                ));
            }
            city_rows.push((next_city_id, city));
            next_city_id += 1
        }
    }

    println!("names: {}, cities: {}", name_rows.len(), city_rows.len());
    println!("last city id: {}", next_city_id - 1);

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
        "INSERT OR IGNORE INTO names (id, name, first_city, city_count) VALUES",
        &name_values,
    )?;
    write_sql(
        "cities",
        "INSERT OR IGNORE INTO cities (id, name, lat, lon, country, population) VALUES",
        &city_values,
    )?;
    let (round_values, shown_cities) = round_name_values(fame);
    write_sql_after(
        "round_names",
        Some("DELETE FROM round_names;"),
        "INSERT INTO round_names (round, cum, name_id) VALUES",
        &round_values,
    )?;
    std::fs::write("out/round_cities.tsv", shown_cities.join("\n") + "\n")?;
    println!("wrote out/round_cities.tsv");
    write_statements("renames", &renames)?;
    Ok(())
}
