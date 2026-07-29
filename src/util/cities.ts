interface City { parent: number; code: number; name: string; }

let _cities: City[] = [];

export const getCities = () => _cities;

export const initCities = async (path: string) => {
    const str = await fetch(path).then(r => r.text());
    _cities = str.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
        const [parent, code, name] = l.split(",");
        return { parent: parseInt(parent!, 10), code: parseInt(code!, 10), name: name ?? "" };
    }).filter(c => Number.isFinite(c.parent) && Number.isFinite(c.code) && c.name);
};

export const getCityPath = (code: number): City[] => {
    const path: City[] = [];
    let current = _cities.find(c => c.code === code);
    while (current) { path.push(current); current = _cities.find(c => c.code === current!.parent); }
    return path;
};
