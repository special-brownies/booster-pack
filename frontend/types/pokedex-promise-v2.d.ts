declare module "pokedex-promise-v2" {
  export default class Pokedex {
    getPokemonByName(nameOrId: string | number): Promise<any>;
    getPokemonSpeciesByName(nameOrId: string | number): Promise<any>;
    getTypeByName(name: string): Promise<any>;
  }
}

