export type City = {
  parent: number;
  code: number;
  name: string;
};

// 城市表是进程级只读缓存, 用模块状态共享, 只拉一次
let cities = $state<City[]>([]);

// 解析 "parent,code,name" 逐行格式的城市表.
export const parseCities = (text: string): City[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [parent, code, name] = line.split(",") as [string, string, string];
      return { parent: parseInt(parent, 10), code: parseInt(code, 10), name };
    })
    .filter((city) => Number.isFinite(city.parent) && Number.isFinite(city.code) && city.name);

export const initCities = async (path: string): Promise<void> => {
  const text = await fetch(path).then((response) => response.text());
  cities = parseCities(text);
};

export const getCities = (): City[] => cities;

export const resetCities = (): void => {
  cities = [];
};

// 从末级 code 往根方向收集祖先, 返回 root -> leaf.
export const getCityPath = (code: number): City[] => {
  const path: City[] = [];
  let current = cities.find((city) => city.code === code);

  while (current) {
    path.push(current);
    const parent = current;
    current = cities.find((city) => city.code === parent.parent);
  }

  return path.reverse();
};
